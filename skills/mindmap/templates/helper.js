// WebSocket client: receives Markdown data → renders with Markmap (no page reload).
(function() {
  var ws;
  var statusEl = document.getElementById('status');
  var container = document.getElementById('mindmap-container');
  var mm = null; // Markmap instance
  var svgEl = null;

  function initSvg() {
    container.innerHTML = '';
    svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.style.width = '100%';
    svgEl.style.height = '100%';
    container.appendChild(svgEl);
  }

  function renderMarkmap(markdown) {
    if (!svgEl) initSvg();

    var transformer = new markmap.Transformer();
    var result = transformer.transform(markdown);
    var root = result.root;

    if (!mm) {
      mm = markmap.Markmap.create(svgEl, {
        autoFit: true,
        duration: 300
      }, root);
    } else {
      mm.setData(root);
      mm.fit();
    }
  }

  function connect() {
    ws = new WebSocket('ws://' + window.location.host);
    ws.onopen = function() {
      if (statusEl) statusEl.textContent = 'connected';
    };
    ws.onmessage = function(event) {
      try {
        var msg = JSON.parse(event.data);
        if (msg.type === 'update' && msg.markdown) {
          renderMarkmap(msg.markdown);
          if (statusEl) statusEl.textContent = 'updated';
        }
      } catch (e) {
        console.error('render error:', e);
      }
    };
    ws.onclose = function() {
      if (statusEl) statusEl.textContent = 'reconnecting...';
      setTimeout(connect, 1000);
    };
    ws.onerror = function() {
      ws.close();
    };
  }

  connect();
})();
