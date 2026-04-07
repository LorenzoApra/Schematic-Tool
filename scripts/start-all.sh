#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-4173}"
PID_FILE=".dev-server.pid"
LOG_FILE=".dev-server.log"

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE")"
  if kill -0 "$PID" 2>/dev/null; then
    echo "Dev server already running (pid $PID)."
    echo "URL: http://$HOST:$PORT/"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT is already in use. Run ./scripts/stop-all.sh first or set PORT=<other>."
  exit 1
fi

npm run dev -- --host "$HOST" --port "$PORT" >"$LOG_FILE" 2>&1 &
PID=$!
echo "$PID" > "$PID_FILE"

echo "Started dev server (pid $PID)"
echo "URL: http://$HOST:$PORT/"
echo "Logs: $LOG_FILE"
