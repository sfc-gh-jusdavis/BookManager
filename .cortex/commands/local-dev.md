Start the local dev stack with Docker Compose hot-reload.

## Steps

1. **Pre-flight: stop any existing local stack** to avoid port collisions:
   ```bash
   cd ~/projects/BookManager
   docker compose ps --format json 2>/dev/null | grep -q running && docker compose down
   ```

2. **Start in detached mode**:
   ```bash
   make up-detach
   ```
   This chains `sync-flags` (best-effort) and brings up `backend` (port 8000) + `frontend` (port 3001) with hot-reload.

3. **Wait for backend health** (up to 60s):
   ```bash
   for i in {1..30}; do
     curl -sf http://localhost:8000/health > /dev/null && break
     sleep 2
   done
   curl -sf http://localhost:8000/health || echo "Backend health check timed out"
   ```

4. **Wait for frontend** (Next.js startup is ~10s):
   ```bash
   for i in {1..30}; do
     curl -sf http://localhost:3001 > /dev/null && break
     sleep 2
   done
   ```

5. **Open the app in the user's browser**:
   ```bash
   open http://localhost:3001
   ```

6. **Tail logs** in the foreground (user can Ctrl-C to detach):
   ```bash
   make logs
   ```

## Notes

- Only one worktree at a time can run this — port 8000/3001 are hardcoded in `docker-compose.yml`.
- If startup fails with `lightningcss` or `next: not found`: run `/docker-reset`.
- For backend-only iteration: `make logs-backend`. Frontend-only: `make logs-frontend`.
- To exec into a container: `make shell-backend` or `make shell-frontend`.
