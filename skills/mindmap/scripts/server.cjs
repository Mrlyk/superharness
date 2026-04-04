/**
 * Mindmap visualization server for superharness.
 * Fork of Superpowers Visual Companion (MIT License, Jesse Vincent).
 *
 * Architecture:
 *   AI writes .mmd file (pure Mermaid text) to content_dir
 *   → server detects via fs.watch
 *   → reads .mmd content
 *   → pushes via WebSocket {type:'update', mermaid:'...'}
 *   → client renders with mermaid.render() (no page reload)
 */

const crypto = require('crypto');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ========== WebSocket Protocol (RFC 6455) ==========

const OPCODES = { TEXT: 0x01, CLOSE: 0x08, PING: 0x09, PONG: 0x0A };
const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function computeAcceptKey(clientKey) {
  return crypto.createHash('sha1').update(clientKey + WS_MAGIC).digest('base64');
}

function encodeFrame(opcode, payload) {
  const fin = 0x80;
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = fin | opcode;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = fin | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = fin | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function decodeFrame(buffer) {
  if (buffer.length < 2) return null;
  const secondByte = buffer[1];
  const opcode = buffer[0] & 0x0F;
  const masked = (secondByte & 0x80) !== 0;
  let payloadLen = secondByte & 0x7F;
  let offset = 2;
  if (!masked) throw new Error('Client frames must be masked');
  if (payloadLen === 126) {
    if (buffer.length < 4) return null;
    payloadLen = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    if (buffer.length < 10) return null;
    payloadLen = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }
  const maskOffset = offset;
  const dataOffset = offset + 4;
  const totalLen = dataOffset + payloadLen;
  if (buffer.length < totalLen) return null;
  const mask = buffer.slice(maskOffset, dataOffset);
  const data = Buffer.alloc(payloadLen);
  for (let i = 0; i < payloadLen; i++) {
    data[i] = buffer[dataOffset + i] ^ mask[i % 4];
  }
  return { opcode, payload: data, bytesConsumed: totalLen };
}

// ========== Configuration ==========

const PORT = process.env.MINDMAP_PORT || (49152 + Math.floor(Math.random() * 16383));
const HOST = process.env.MINDMAP_HOST || '127.0.0.1';
const URL_HOST = process.env.MINDMAP_URL_HOST || (HOST === '127.0.0.1' ? 'localhost' : HOST);
const SESSION_DIR = process.env.MINDMAP_DIR || '/tmp/superharness-mindmap';
const CONTENT_DIR = path.join(SESSION_DIR, 'content');
const MMD_FILE = path.join(CONTENT_DIR, 'current.mmd');

// ========== Templates ==========

const framePath = path.join(__dirname, '..', 'templates', 'frame-template.html');
const helperPath = path.join(__dirname, '..', 'templates', 'helper.js');
const frameTemplate = fs.readFileSync(framePath, 'utf-8');
const helperScript = fs.readFileSync(helperPath, 'utf-8');

// Build the single page served at /
function buildPage() {
  return frameTemplate.replace('<!-- HELPER_SCRIPT -->', '<script>\n' + helperScript + '\n</script>');
}

const PAGE = buildPage();

// ========== HTTP ==========

function handleRequest(req, res) {
  touchActivity();
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(PAGE);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
}

// ========== WebSocket ==========

const clients = new Set();

function handleUpgrade(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + computeAcceptKey(key) + '\r\n\r\n'
  );

  let buffer = Buffer.alloc(0);
  clients.add(socket);

  // Send current mermaid content immediately on connect
  if (fs.existsSync(MMD_FILE)) {
    const content = fs.readFileSync(MMD_FILE, 'utf-8').trim();
    if (content) {
      const msg = JSON.stringify({ type: 'update', markdown: content });
      socket.write(encodeFrame(OPCODES.TEXT, Buffer.from(msg)));
    }
  }

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length > 0) {
      let result;
      try { result = decodeFrame(buffer); } catch (e) {
        socket.end(encodeFrame(OPCODES.CLOSE, Buffer.alloc(0)));
        clients.delete(socket);
        return;
      }
      if (!result) break;
      buffer = buffer.slice(result.bytesConsumed);
      if (result.opcode === OPCODES.CLOSE) {
        socket.end(encodeFrame(OPCODES.CLOSE, Buffer.alloc(0)));
        clients.delete(socket);
        return;
      }
      if (result.opcode === OPCODES.PING) {
        socket.write(encodeFrame(OPCODES.PONG, result.payload));
      }
    }
  });
  socket.on('close', () => clients.delete(socket));
  socket.on('error', () => clients.delete(socket));
}

function broadcast(msg) {
  const frame = encodeFrame(OPCODES.TEXT, Buffer.from(JSON.stringify(msg)));
  for (const socket of clients) {
    try { socket.write(frame); } catch (e) { clients.delete(socket); }
  }
}

// ========== Activity Tracking ==========

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
let lastActivity = Date.now();
function touchActivity() { lastActivity = Date.now(); }

// ========== Server ==========

function startServer() {
  if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR, { recursive: true });

  const server = http.createServer(handleRequest);
  server.on('upgrade', handleUpgrade);

  // Watch for .mmd file changes
  let debounceTimer = null;
  const watcher = fs.watch(CONTENT_DIR, (eventType, filename) => {
    if (!filename || !filename.endsWith('.mmd')) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (!fs.existsSync(MMD_FILE)) return;
      touchActivity();
      const content = fs.readFileSync(MMD_FILE, 'utf-8').trim();
      if (content) {
        console.log(JSON.stringify({ type: 'content-updated', length: content.length }));
        broadcast({ type: 'update', markdown: content });
      }
    }, 100);
  });
  watcher.on('error', (err) => console.error('fs.watch error:', err.message));

  function shutdown(reason) {
    console.log(JSON.stringify({ type: 'server-stopped', reason }));
    watcher.close();
    clearInterval(lifecycleCheck);
    server.close(() => process.exit(0));
  }

  const lifecycleCheck = setInterval(() => {
    if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) shutdown('idle timeout');
  }, 30 * 1000);
  lifecycleCheck.unref();

  server.listen(PORT, HOST, () => {
    const info = JSON.stringify({
      type: 'server-started', port: Number(PORT),
      url: 'http://' + URL_HOST + ':' + PORT,
      content_dir: CONTENT_DIR
    });
    console.log(info);
  });
}

if (require.main === module) {
  startServer();
}
