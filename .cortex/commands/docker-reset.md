Full Docker reset for BookManager local dev. Use when the stack is broken in ways that `make restart-service` can't fix.

## When to use

- `sh: next: not found` (exit 127) on container start
- `lightningcss.linux-arm64-musl.node` errors
- Stale `node_modules` after major dep changes
- `.env` changes that compose isn't picking up
- Frontend build hangs / weird PostCSS errors
- Anytime "did you `make clean`?" comes to mind

## Steps

1. **Stop and wipe volumes**:
   ```bash
   cd ~/projects/BookManager
   make clean
   ```
   This is `docker compose down -v`. Wipes named volumes including `node_modules`.

2. **Verify `.dockerignore` exists** (critical):
   ```bash
   test -f bkmng-next/.dockerignore || echo "WARNING: bkmng-next/.dockerignore is missing — host node_modules will leak into the Linux container and lightningcss will crash"
   ```
   If missing: do NOT proceed. Restore from git first.

3. **Verify `.env` is correct**:
   ```bash
   grep -q "^SNOWFLAKE_DATABASE=TEMP$" backend/.env || echo "WARNING: backend/.env missing SNOWFLAKE_DATABASE=TEMP"
   grep -q "^SNOWFLAKE_SCHEMA=JUSDAVIS$" backend/.env || echo "WARNING: backend/.env missing SNOWFLAKE_SCHEMA=JUSDAVIS"
   ```

4. **Bring the stack up cleanly**:
   ```bash
   make up
   ```
   Foreground; you'll see fresh container output. Ctrl-C to stop. Or use `make up-detach` for background.

5. **Smoke check**:
   ```bash
   curl -sf http://localhost:8000/health
   curl -sf http://localhost:3001 > /dev/null && echo "frontend ok"
   ```

## Notes

- This wipes volumes, not images. Image rebuild only happens if `Dockerfile` or `bkmng-next/package.json` changed.
- Force a full image rebuild: `docker compose build --no-cache && make up`.
- If `make clean` hangs: `docker compose kill` first.
