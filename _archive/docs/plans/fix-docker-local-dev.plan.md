# Plan: Fix Docker Local Dev

## Root Cause Diagnosis

```
COPY . .  (no .dockerignore)
    │
    ▼
darwin node_modules baked into Linux image
    │
    ▼
anonymous volume seeded with darwin packages
    │
    ▼
Cannot find module 'lightningcss.linux-arm64-musl.node'
```

There are two compounding bugs:

**Bug 1 — No `.dockerignore`**: [`bkmng-next/Dockerfile`](BookManager/bkmng-next/Dockerfile) runs `RUN npm ci` (installs Linux packages) and then `COPY . .`. Without a `.dockerignore`, `COPY . .` copies the host's `bkmng-next/node_modules` (macOS darwin packages) **on top of** the freshly-installed Linux packages. The image ends up with darwin binaries. Every volume that gets seeded from this image gets darwin binaries.

**Bug 2 — Anonymous volume re-seeds from bind mount**: The current [`docker-compose.yml`](BookManager/docker-compose.yml) uses `- /app/node_modules` (anonymous volume). On macOS Docker Desktop, when a bind mount (`./bkmng-next:/app`) and an anonymous volume (`/app/node_modules`) overlap, the volume is seeded from the bind-mounted content — the host's `node_modules` directory — rather than the image layer. This means Linux packages from the image are never used.

The `next: not found` crash was a direct consequence: the anonymous volume was re-seeded from an empty host `node_modules` directory (after we deleted it), leaving the volume with no packages at all.

---

## The Fix

### Step 1 — Add `bkmng-next/.dockerignore`

Create [`BookManager/bkmng-next/.dockerignore`](BookManager/bkmng-next/.dockerignore):

```
node_modules
node_modules_darwin_backup
.next
.git
*.log
```

This ensures `COPY . .` in the Dockerfile never copies darwin packages into the image. After this fix, the image's `/app/node_modules` will only ever contain what `RUN npm ci` produced: correct Linux ARM64 musl packages.

---

### Step 2 — Switch to named volume in `docker-compose.yml`

Named volumes differ from anonymous volumes:
- Seeded **once** from the image at creation time, then they are **never re-seeded**
- Persist across `docker compose down` (unless `-v` is passed)
- Completely independent from the bind mount — host changes to `bkmng-next/node_modules` do not affect them

**Change in [`docker-compose.yml`](BookManager/docker-compose.yml)**:

```yaml
# Before
volumes:
  - ./bkmng-next:/app
  - /app/node_modules          # anonymous volume — re-seeds from bind mount

# After
volumes:
  - ./bkmng-next:/app
  - frontend_node_modules:/app/node_modules   # named volume — seeded once from image
```

Add a top-level `volumes:` section at the bottom of the file:

```yaml
volumes:
  frontend_node_modules:
```

The `serverExternalPackages: ["lightningcss", "@tailwindcss/node"]` already added to [`next.config.ts`](BookManager/bkmng-next/next.config.ts) stays — it prevents Turbopack from trying to bundle the native `.node` binary directly and instead falls back to Node's require, which finds the correct Linux binary in the named volume.

---

### Step 3 — Wipe and rebuild clean

```bash
cd BookManager

# Remove all containers, named + anonymous volumes
docker compose down -v

# Rebuild frontend image from scratch (no layer cache)
# This time: npm ci installs Linux packages, COPY . . skips node_modules
docker compose build --no-cache frontend

# Start everything
docker compose up -d
```

After this, the named volume `bookmanager_frontend_node_modules` is seeded from the freshly-built Linux image and never overwritten by the host.

---

### Step 4 — Verify

- `docker compose ps` → both services healthy/running
- `curl http://localhost:8000/health` → `{"status":"healthy"}`
- `http://localhost:3001` → app loads, no lightningcss error

---

## Updating packages going forward

If `package.json` changes (new dependency added):

```bash
# Rebuild image and recreate the named volume
docker compose down -v
docker compose build --no-cache frontend
docker compose up -d
```

Or to only reinstall without full rebuild:

```bash
docker compose run --rm frontend npm ci
```
