#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR" && pwd)"

echo "BookManager — launching..."

for port in 8000 3001; do
  pid=$(lsof -ti :"$port" 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "Clearing port $port (PID $pid)..."
    kill -9 $pid 2>/dev/null || true
    sleep 1
  fi
done

if ! docker info >/dev/null 2>&1; then
  echo "Starting Docker Desktop..."
  open -a Docker
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

cd "$PROJECT_DIR"
docker compose down 2>/dev/null || true
docker compose up --build -d

echo "Waiting for app to become healthy..."
for i in $(seq 1 30); do
  backend=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health 2>/dev/null || echo "000")
  frontend=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 2>/dev/null || echo "000")
  if [ "$backend" = "200" ] && [ "$frontend" = "200" ]; then
    echo "App is healthy."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "WARNING: App may not be fully ready yet. Opening browser anyway."
  fi
  sleep 2
done

open http://localhost:3001

osascript -e 'tell application "Terminal" to close front window' &>/dev/null &
