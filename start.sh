#!/bin/sh
set -e

cd /app/backend
uvicorn app.main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --workers 2 \
    --log-level info &

cd /app/frontend
PORT=8080 HOSTNAME=0.0.0.0 node server.js &

trap 'kill $(jobs -p) 2>/dev/null; exit 0' TERM INT
wait
