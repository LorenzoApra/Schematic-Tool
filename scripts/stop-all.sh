#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PORT="${PORT:-4173}"
PID_FILE=".dev-server.pid"

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE")"
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" || true
    sleep 0.2
    if kill -0 "$PID" 2>/dev/null; then
      kill -9 "$PID" || true
    fi
    echo "Stopped dev server pid $PID"
  fi
  rm -f "$PID_FILE"
fi

PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN || true)"
if [[ -n "$PIDS" ]]; then
  while IFS= read -r PID; do
    [[ -n "$PID" ]] && kill "$PID" || true
  done <<< "$PIDS"
  sleep 0.2
  PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN || true)"
  if [[ -n "$PIDS" ]]; then
    while IFS= read -r PID; do
      [[ -n "$PID" ]] && kill -9 "$PID" || true
    done <<< "$PIDS"
  fi
  echo "Stopped process(es) on port $PORT"
fi

echo "Stop complete."
