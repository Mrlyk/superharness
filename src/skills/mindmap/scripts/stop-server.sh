#!/usr/bin/env bash
# Stop the mindmap visualization server.
# Usage: stop-server.sh [--dir /path/to/session-dir]
#
# If --dir is not provided, kills all node processes running server.cjs.

set -euo pipefail

SESSION_DIR=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --dir) SESSION_DIR="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [[ -n "$SESSION_DIR" ]]; then
  LOG_FILE="$SESSION_DIR/server.log"
  if [[ -f "$LOG_FILE" ]]; then
    # Extract PID from log (nohup writes it)
    PID=$(ps aux | grep "server.cjs" | grep "$SESSION_DIR" | grep -v grep | awk '{print $2}' | head -1)
    if [[ -n "$PID" ]]; then
      kill "$PID" 2>/dev/null && echo "Stopped mindmap server (PID $PID)" || echo "Server already stopped"
    else
      echo "No running server found for $SESSION_DIR"
    fi
  fi
else
  # Kill all mindmap servers
  pkill -f "superharness.*server.cjs" 2>/dev/null && echo "Stopped all mindmap servers" || echo "No running servers"
fi
