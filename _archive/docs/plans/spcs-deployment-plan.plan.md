---
name: "spcs-deployment-plan"
created: "2026-04-02T18:31:26.716Z"
status: pending
---

# Plan: Deploy BookManager to SPCS with Cost Monitoring and Security

## Context

- **Repo**: Cloned to `/Users/jusdavis/.snowflake/cortex/playground/workspace/BookManager`
- **Stack**: React 19 + Vite 6 + TailwindCSS 4 (frontend), FastAPI + Uvicorn (backend)
- **Current state**: Mock data only, frontend imports mocks directly (never calls backend)
- **Target**: Running in SPCS with mock data, admin-gated cost monitoring, security hardening

## Snowflake Object Inventory

| Object                | Type             | Scope   | Full Name                               |
| --------------------- | ---------------- | ------- | --------------------------------------- |
| `BKMNG_REPO`          | Image Repository | Schema  | `SNOWHOUSE.TEMP.JUSDAVIS.BKMNG_REPO`    |
| `BKMNG_STAGE`         | Stage            | Schema  | `SNOWHOUSE.TEMP.JUSDAVIS.BKMNG_STAGE`   |
| `BKMNG_SERVICE`       | Service          | Schema  | `SNOWHOUSE.TEMP.JUSDAVIS.BKMNG_SERVICE` |
| `JUSDAVIS_BKMNG_POOL` | Compute Pool     | Account | `JUSDAVIS_BKMNG_POOL`                   |

No application data tables in Phase 1. Role mapping uses env var allowlist.

## Architecture

```
flowchart TD
    subgraph SPCS["SPCS: JUSDAVIS_BKMNG_POOL"]
        subgraph Container["Single Container"]
            Nginx["nginx :80 + security headers"]
            React["React Static Build"]
            FastAPI["FastAPI :8000"]
        end
    end

    User["Browser User"] -->|"HTTPS public endpoint"| SPCS
    SPCS -->|"Sf-Context-Current-User header"| Nginx
    Nginx -->|"/ static files"| React
    Nginx -->|"/api/* proxy_pass"| FastAPI
    FastAPI -->|"Mock data"| MockService["MockDataService"]
    FastAPI -->|"/api/costs/* admin-only"| CostViews["Mock Cost Data"]

    ServiceRole["BKMNG_SERVICE!APP_USER"] -.->|"Controls who can access"| SPCS
```

---

## Task 1: Create Snowflake Infrastructure Objects

Using `SE_XS_WH` for all DDL.

```
USE WAREHOUSE SE_XS_WH;
USE SCHEMA SNOWHOUSE.TEMP.JUSDAVIS;

CREATE IMAGE REPOSITORY IF NOT EXISTS BKMNG_REPO;
CREATE STAGE IF NOT EXISTS BKMNG_STAGE ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE');

CREATE COMPUTE POOL IF NOT EXISTS JUSDAVIS_BKMNG_POOL
  MIN_NODES = 1
  MAX_NODES = 1
  INSTANCE_FAMILY = CPU_X64_XS
  AUTO_SUSPEND_SECS = 300
  AUTO_RESUME = TRUE;
```

---

## Task 2: Wire Frontend to Call Backend API

Replace all direct mock imports in pages with TanStack Query + axios calls to `/api` endpoints.

**Files to modify:**

- frontend/src/pages/Accounts.tsx
- frontend/src/pages/AccountDetail.tsx
- frontend/src/pages/Forecasts.tsx
- frontend/src/pages/TMRs.tsx
- frontend/src/pages/ACEDashboard.tsx
- frontend/src/pages/ACEMDashboard.tsx
- frontend/src/context/AuthContext.tsx

**Pattern:**

```
// Before
import { MOCK_ACCOUNTS } from '../mocks/accounts'
const accounts = MOCK_ACCOUNTS

// After
const { data: accounts = [] } = useQuery({
  queryKey: ['accounts'],
  queryFn: () => axios.get('/api/accounts').then(r => r.data),
})
```

---

## Task 3: SPCS Auth Integration

**File**: backend/app/auth/dependencies.py

When `APP_ENV=spcs`:

- Read `Sf-Context-Current-User` header to get the authenticated Snowflake username
- Check against `ADMIN_USERS` env var to determine if user has admin privileges
- Return `CurrentUser` with role derived from env mapping
- Keep mock mode (`APP_ENV=development`) working for local dev

**Admin gating**: New FastAPI dependency `require_admin` that checks if current user is in the `ADMIN_USERS` list. Applied to all `/costs/*` endpoints.

---

## Task 4: Build Unified Dockerfile for SPCS

**New files:**

- `BookManager/Dockerfile.spcs` -- Multi-stage: build React, then combine with Python + nginx in a single image
- `BookManager/deploy/nginx-spcs.conf` -- Serves static React at `/`, proxies `/api/` to FastAPI, adds security headers
- `BookManager/deploy/start.sh` -- Starts uvicorn (background) then nginx (foreground)

### Security Headers (in nginx config)

```
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

Also: strip server version headers, disable directory listing.

---

## Task 5: Create SPCS Service Spec YAML

**New file**: `BookManager/deploy/bkmng-spec.yaml`

```
spec:
  containers:
    - name: bkmng
      image: /SNOWHOUSE/TEMP/JUSDAVIS/BKMNG_REPO/bkmng:latest
      env:
        APP_ENV: spcs
        MOCK_DATA: "true"
        ADMIN_USERS: JUSDAVIS
      readinessProbe:
        port: 80
        path: /health
      resources:
        requests:
          memory: 512M
          cpu: 0.5
        limits:
          memory: 1G
          cpu: 1
  endpoints:
    - name: app
      port: 80
      public: true
  platformMonitor:
    metricConfig:
      groups:
        - system.all
serviceRoles:
  - name: app_user
    endpoints:
      - app
```

**Service role access control**: Only users granted `BKMNG_SERVICE!APP_USER` can access the public endpoint. Others get denied at the Snowflake layer before reaching the app.

```
-- Grant access to specific roles
GRANT SERVICE ROLE SNOWHOUSE.TEMP.JUSDAVIS.BKMNG_SERVICE!APP_USER TO ROLE <target_role>;
```

---

## Task 6: Add Admin-Gated Cost Monitoring

### 6a. Backend

**New file**: `backend/app/routers/costs.py`

| Endpoint                   | Guard           | Description                                 |
| -------------------------- | --------------- | ------------------------------------------- |
| `GET /costs/compute-pool`  | `require_admin` | SPCS credit consumption (mock data Phase 1) |
| `GET /costs/query-history` | `require_admin` | App query costs (mock data Phase 1)         |
| `GET /costs/summary`       | `require_admin` | Daily cost summary (mock data Phase 1)      |

**New file**: `backend/app/mocks/costs.py` -- 30 days of synthetic SPCS credit data.

Register router in backend/app/main.py.

### 6b. Frontend

**New file**: `frontend/src/pages/CostMonitoring.tsx`

- Credit burn rate line chart (Recharts)
- Compute pool status card
- Cost breakdown table
- Budget threshold indicators

**Admin gating in UI**: The `/costs` route and nav item only appear if the user's role includes admin privileges. Non-admin users never see the link or page.

**File changes:**

- frontend/src/App.tsx -- Add `/costs` route (wrapped in admin guard)
- frontend/src/components/layout/Sidebar.tsx -- Conditionally show "Cost Monitor" nav item

---

## Task 7: Build, Push, and Deploy to SPCS

### 7a. Build

```
cd /Users/jusdavis/.snowflake/cortex/playground/workspace/BookManager
docker build --platform linux/amd64 -f Dockerfile.spcs -t bkmng:latest .
```

### 7b. Push to Snowflake registry

```
docker tag bkmng:latest <repo_url>/bkmng:latest
docker login <registry_url>
docker push <repo_url>/bkmng:latest
```

### 7c. Deploy

```
USE WAREHOUSE SE_XS_WH;

PUT file:///path/to/bkmng-spec.yaml @SNOWHOUSE.TEMP.JUSDAVIS.BKMNG_STAGE
  AUTO_COMPRESS=FALSE OVERWRITE=TRUE;

CREATE SERVICE SNOWHOUSE.TEMP.JUSDAVIS.BKMNG_SERVICE
  IN COMPUTE POOL JUSDAVIS_BKMNG_POOL
  FROM @SNOWHOUSE.TEMP.JUSDAVIS.BKMNG_STAGE
  SPECIFICATION_FILE = 'bkmng-spec.yaml'
  MIN_INSTANCES = 1
  MAX_INSTANCES = 1;
```

### 7d. Validate

```
SELECT SYSTEM$GET_SERVICE_STATUS('SNOWHOUSE.TEMP.JUSDAVIS.BKMNG_SERVICE');
SHOW ENDPOINTS IN SERVICE SNOWHOUSE.TEMP.JUSDAVIS.BKMNG_SERVICE;
CALL SYSTEM$GET_SERVICE_LOGS('SNOWHOUSE.TEMP.JUSDAVIS.BKMNG_SERVICE', 0, 'bkmng', 100);
```

### 7e. Grant access

```
GRANT SERVICE ROLE SNOWHOUSE.TEMP.JUSDAVIS.BKMNG_SERVICE!APP_USER TO ROLE <your_role>;
```

---

## Security Summary

| Feature                 | Implementation                                | Phase           |
| ----------------------- | --------------------------------------------- | --------------- |
| **SPCS auth**           | `Sf-Context-Current-User` header for identity | 1 (this deploy) |
| **Admin gating**        | `ADMIN_USERS` env var allowlist               | 1 (this deploy) |
| **Service role access** | `BKMNG_SERVICE!APP_USER` service role grants  | 1 (this deploy) |
| **Security headers**    | CSP, X-Frame-Options, HSTS, etc. in nginx     | 1 (this deploy) |
| **Role management UI**  | `BKMNG_USER_ROLES` table + admin UI           | 2 (follow-up)   |
| **Caller's rights**     | `executeAsCaller: true` for real data queries | 2 (follow-up)   |
| **Audit logging**       | Action tracking table                         | 2 (follow-up)   |

## Risks

1. **Permissions**: Need CREATE COMPUTE POOL, CREATE IMAGE REPOSITORY, CREATE SERVICE privileges.
2. **Build time**: `--platform linux/amd64` on Apple Silicon uses QEMU (\~5-10 min).
3. **Auto-suspend**: Compute pool suspends after 5 min idle to minimize costs.
