#!/usr/bin/env bash
# Start the mindmap visualization server.
# Usage: start-server.sh [--project-dir /path/to/project]
#
# Outputs JSON on success:
#   {"type":"server-started","port":52341,"url":"http://localhost:52341","content_dir":"..."}

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PROJECT_DIR=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --project-dir) PROJECT_DIR="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# Session directory
SESSION_ID="$$-$(date +%s)"
if [[ -n "$PROJECT_DIR" ]]; then
  SESSION_DIR="$PROJECT_DIR/.superharness/visualize/$SESSION_ID"
else
  SESSION_DIR="/tmp/superharness-mindmap-$SESSION_ID"
fi

mkdir -p "$SESSION_DIR/content"

# Detect platform
FOREGROUND=false
case "${OSTYPE:-}" in
  msys*|cygwin*|mingw*) FOREGROUND=true ;;
esac
[[ -n "${MSYSTEM:-}" ]] && FOREGROUND=true
[[ -n "${CODEX_CI:-}" ]] && FOREGROUND=true

export MINDMAP_DIR="$SESSION_DIR"

if $FOREGROUND; then
  node "$SCRIPT_DIR/server.cjs"
else
  LOG_FILE="$SESSION_DIR/server.log"
  nohup node "$SCRIPT_DIR/server.cjs" > "$LOG_FILE" 2>&1 &
  SERVER_PID=$!
  disown $SERVER_PID 2>/dev/null || true

  # Wait for startup (max 5 seconds)
  for i in $(seq 1 50); do
    if grep -q "server-started" "$LOG_FILE" 2>/dev/null; then
      STARTUP_JSON=$(grep "server-started" "$LOG_FILE" | head -1)
      # stdout: JSON for AI consumption
      echo "$STARTUP_JSON"
      # stderr: human-readable banner
      URL=$(echo "$STARTUP_JSON" | sed 's/.*"url":"\([^"]*\)".*/\1/')
      echo "" >&2
      echo "  ┌─────────────────────────────────────────┐" >&2
      echo "  │  Superharness Mindmap 已启动             │" >&2
      echo "  │                                         │" >&2
      printf "  │  %-37s │\n" "$URL" >&2
      echo "  │                                         │" >&2
      echo "  │  空闲 5 分钟后自动关闭                   │" >&2
      echo "  └─────────────────────────────────────────┘" >&2
      echo "" >&2
      exit 0
    fi
    sleep 0.1
  done

  # Check if server is still alive
  if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo '{"type":"error","message":"Server failed to start"}' >&2
    cat "$LOG_FILE" >&2
    exit 1
  fi

  echo '{"type":"error","message":"Server startup timeout"}' >&2
  exit 1
fi
