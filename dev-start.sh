#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "BookManager — starting..."

if ! docker info >/dev/null 2>&1; then
  echo "Starting Docker Desktop..."
  open -a Docker
  echo "Waiting for Docker daemon (up to 60s)..."
  for i in $(seq 1 30); do
    sleep 2
    docker info >/dev/null 2>&1 && break
    if [ "$i" -eq 30 ]; then
      echo "ERROR: Docker failed to start after 60s."
      exit 1
    fi
  done
  echo "Docker ready."
fi

cd "$SCRIPT_DIR"
docker compose up --build -d

echo ""
echo "App started."
echo "  Frontend: http://localhost:3001"
echo "  Backend:  http://localhost:8000/health"
echo "  Logs:     cd BookManager && make logs"
echo "  Stop:     ./stop.sh"
