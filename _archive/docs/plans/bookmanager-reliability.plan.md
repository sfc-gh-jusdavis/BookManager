# Plan: BookManager Reliability — Production-Grade Local Deployment

## Root Cause Analysis

The recurring outages share a single root cause: **the app is being run natively (bare macOS processes) instead of Docker**. This means:

| Problem | Native Mode | Docker Mode |
|---|---|---|
| venv wiped by macOS cleanup | App dies | Not applicable — deps are in image |
| `node_modules` missing | App dies | Not applicable — deps are in image |
| Python 3.9 vs 3.10+ syntax | Crashes at import | Not applicable — Docker uses Python 3.11 |
| Process crash → stays down | Manual restart | Auto-restart with `restart: unless-stopped` |
| System reboot | Manual restart | LaunchAgent restarts Docker Desktop |

Docker Desktop is **already installed** (`docker --version` = 29.3.1). The Dockerfiles and `docker-compose.yml` are already in place. The `lightningcss-linux-arm64-musl` problem in `bkmng-next/package.json` is already fixed. **The fix is to start using Docker and harden it.**

---

## Gap Analysis vs First Draft

| Issue | First Draft | Corrected |
|---|---|---|
| `curl` not in `python:3.11-slim` | `CMD curl` healthcheck | Use `python3 -c urllib.request` |
| `/health/ready` can hang | No timeout | `asyncio.wait_for` 5s timeout |
| Docker logs grow unbounded | Not addressed | Add `logging` config with max-size |
| LaunchAgent PATH is minimal | Bare `ProgramArguments` | Add `EnvironmentVariables` PATH |
| LaunchAgent restart loops | No throttle | Add `ThrottleInterval` |

---

## Architecture (Current vs Target)

```mermaid
flowchart LR
  subgraph current [Current — Fragile]
    A[macOS Python 3.9] -->|hangs or crashes| B[uvicorn process]
    C[macOS node_modules] -->|wiped| D[next dev process]
  end

  subgraph target [Target — Resilient]
    E[LaunchAgent] -->|on login| F[Docker Desktop]
    F -->|restart: unless-stopped| G[backend container Python 3.11]
    F -->|restart: unless-stopped| H[frontend container Node 20]
    G -->|python healthcheck| I[/health]
    H -->|depends_on healthy| G
  end
```

---

## Task 1 — `docker-compose.yml`: Restart Policies + Health Checks + Log Rotation

**File**: [`BookManager/docker-compose.yml`](BookManager/docker-compose.yml)

Key decisions:
- `restart: unless-stopped` — auto-recovery on crash; does NOT restart when you deliberately `docker compose down`
- Healthcheck uses `python3 -c urllib.request` — avoids installing `curl` in the slim image
- `logging` with `max-size: 10m, max-file: 3` — prevents Docker logs from filling disk over time
- `depends_on: condition: service_healthy` — frontend won't start until backend passes its health check

```yaml
services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: development
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
      - ~/.snowflake:/root/.snowflake:ro
    env_file:
      - .env
    environment:
      - APP_ENV=development
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "python3 -c \"import urllib.request; urllib.request.urlopen('http://localhost:8000/health')\""]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  frontend:
    build:
      context: ./bkmng-next
      dockerfile: Dockerfile
      target: development
    ports:
      - "3001:3001"
    volumes:
      - ./bkmng-next:/app
      - /app/node_modules
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
      - INTERNAL_API_URL=http://backend:8000
    depends_on:
      backend:
        condition: service_healthy
    restart: unless-stopped
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

---

## Task 2 — Improve `/health` Endpoint (with timeout guard)

**File**: [`BookManager/backend/app/main.py`](BookManager/backend/app/main.py)

Currently `/health` always returns `{"status": "healthy"}` — the very bug that caused the 153s hang is invisible to it. Add `/health/ready` which checks Snowflake but with a strict 5-second `asyncio.wait_for` timeout. Keep `/health` as a fast liveness probe (used by Docker healthcheck — it must never block).

```python
import asyncio
from fastapi import HTTPException
from app.db.connection import get_snowflake_connection

@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "healthy"}

@app.get("/health/ready")
async def health_ready() -> dict[str, str]:
    async def _check():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            def _query():
                conn = get_snowflake_connection()
                conn.cursor().execute("SELECT 1")
            await asyncio.get_event_loop().run_in_executor(pool, _query)

    try:
        await asyncio.wait_for(_check(), timeout=5.0)
        return {"status": "ready", "snowflake": "connected"}
    except asyncio.TimeoutError:
        raise HTTPException(status_code=503, detail="Snowflake check timed out after 5s")
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Snowflake unavailable: {e}")
```

`/health` = liveness (Docker healthcheck, always fast)
`/health/ready` = readiness (manual check, verifies Snowflake with timeout)

---

## Task 3 — `start.sh` and `stop.sh`

**File**: [`BookManager/start.sh`](BookManager/start.sh) (new, chmod +x)

```bash
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
    [ "$i" -eq 30 ] && { echo "Docker failed to start."; exit 1; }
  done
  echo "Docker ready."
fi

cd "$SCRIPT_DIR"
docker compose up --build -d

echo ""
echo "App started — http://localhost:3001"
echo "Backend:   http://localhost:8000/health"
echo "Logs:      cd BookManager && make logs"
echo "Stop:      ./stop.sh"
```

**File**: [`BookManager/stop.sh`](BookManager/stop.sh) (new, chmod +x)

```bash
#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
docker compose down
echo "BookManager stopped."
```

---

## Task 4 — macOS LaunchAgent (with PATH and throttle)

**File**: `~/Library/LaunchAgents/com.bookmanager.start.plist` (new)

Two gaps from first draft corrected:
- **`EnvironmentVariables`**: LaunchAgents launch with a bare environment; Docker CLI won't be found without an explicit PATH
- **`ThrottleInterval: 10`**: Prevents a rapid restart loop if `start.sh` exits with an error

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.bookmanager.start</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/jusdavis/.snowflake/cortex/playground/workspace/BookManager/start.sh</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>/tmp/bookmanager-start.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/bookmanager-start.log</string>
</dict>
</plist>
```

Activate with: `launchctl load ~/Library/LaunchAgents/com.bookmanager.start.plist`

**Note**: Also enable "Start at Login" in Docker Desktop → Settings → General. This ensures the Docker daemon is up before the LaunchAgent script runs. The `start.sh` script also handles the case where Docker is not yet running (with the 60s wait loop).

---

## Task 5 — Makefile Additions

**File**: [`BookManager/Makefile`](BookManager/Makefile)

```makefile
# Check running status and health
status:
	docker compose ps
	@echo ""
	@curl -sf http://localhost:8000/health | python3 -m json.tool || echo "Backend not responding"

# Restart without rebuild (picks up code changes via volume mounts)
restart:
	docker compose restart

# Check Snowflake connectivity
health:
	@echo "=== liveness ===" && curl -sf http://localhost:8000/health | python3 -m json.tool
	@echo "=== readiness ===" && curl -sf http://localhost:8000/health/ready | python3 -m json.tool

# Tail recent logs
logs-recent:
	docker compose logs --tail=100
```

---

## Task 6 — Verify Docker Build

One-time test before loading the LaunchAgent to confirm the macOS-regenerated `package-lock.json` works in the Linux Docker build:

```bash
cd BookManager
docker compose build --no-cache   # fresh build — catches any npm ci issues
docker compose up -d
sleep 20                          # wait for healthcheck start_period
curl http://localhost:8000/health
docker compose ps                 # should show backend as "healthy"
```

If this passes: load the LaunchAgent. If the npm build fails (Linux platform resolution issue): run `docker compose run --rm frontend npm install` to regenerate the lockfile inside a Linux container.

---

## What This Does NOT Change

- Snowflake connection setup, credentials, or query logic
- All application code and features
- SPCS deployment path

## Summary of Files Changed

| File | Type | Change |
|---|---|---|
| `docker-compose.yml` | Modified | `restart`, `healthcheck` (python3), `depends_on: healthy`, `logging` |
| `backend/app/main.py` | Modified | Add `/health/ready` with `asyncio.wait_for` 5s timeout |
| `start.sh` | New | One-command startup with Docker wait loop |
| `stop.sh` | New | Clean shutdown |
| `Makefile` | Modified | Add `status`, `restart`, `health`, `logs-recent` |
| `~/Library/LaunchAgents/com.bookmanager.start.plist` | New | Auto-start at login, with PATH + throttle |
