# Plan: BKMNG User Table + Demo User Switcher

## Overview
Create `TEMP.JUSDAVIS.BKMNG_USERS` in SNOWHOUSE, update the backend to resolve user profiles from the table, expose the full user list via the existing `/api/auth/mock-users` endpoint in SPCS mode, and un-hide the sidebar switcher so demo attendees can switch into any profile.

## How It Works (End-to-End)

1. Any Snowflake user visits the demo URL → `Sf-Context-Current-User` header identifies them
2. Sidebar shows a **"Switch User"** dropdown populated from `BKMNG_USERS`
3. User picks "Ufi Olakpe (ACEM)" → frontend stores `ufitolo` in `localStorage`, sends `X-Mock-User: ufitolo` on every request
4. Backend: `get_current_user()` checks `X-Mock-User` first → looks up row in `BKMNG_USERS` → returns profile with correct email (`ufi.olakpe@snowflake.com`) and role (`acem`)
5. All data queries use the real email → correct team book of business shown

---

## Task 1 — Create BKMNG_USERS Table in SNOWHOUSE

```sql
CREATE OR REPLACE TABLE TEMP.JUSDAVIS.BKMNG_USERS (
    snowflake_username VARCHAR NOT NULL,
    display_name       VARCHAR NOT NULL,
    email              VARCHAR NOT NULL,
    role               VARCHAR NOT NULL,   -- 'ace' or 'acem'
    is_admin           BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (snowflake_username)
);

INSERT INTO TEMP.JUSDAVIS.BKMNG_USERS VALUES
    ('ufitolo',  'Ufi Olakpe',     'ufi.olakpe@snowflake.com',     'acem', false),
    ('gilee',    'Gilbert Lee',    'gilbert.lee@snowflake.com',    'acem', false),
    ('dbaccus',  'Daunte Baccus',  'daunte.baccus@snowflake.com',  'acem', false),
    ('jusdavis', 'Justin Davis',   'j.davis@snowflake.com',        'ace',  false);
```

---

## Task 2 — Update `backend/app/auth/dependencies.py`

Add table lookup helper and update SPCS resolution to check `X-Mock-User` first:

```python
def _fetch_user_from_table(username: str) -> Optional[CurrentUser]:
    from app.db.connection import get_snowflake_connection
    from snowflake.connector import DictCursor
    conn = get_snowflake_connection()
    cur = conn.cursor(DictCursor)
    cur.execute(
        "SELECT * FROM TEMP.JUSDAVIS.BKMNG_USERS WHERE LOWER(snowflake_username) = %s",
        (username.lower(),)
    )
    row = cur.fetchone()
    if not row:
        return None
    return CurrentUser(
        user_id=row["SNOWFLAKE_USERNAME"],
        email=row["EMAIL"],
        display_name=row["DISPLAY_NAME"],
        role=UserRole.ACEM if row["ROLE"] == "acem" else UserRole.ACE,
        is_admin=bool(row["IS_ADMIN"]),
    )
```

SPCS mode in `get_current_user()`:
```python
if settings.spcs_mode:
    # X-Mock-User (from switcher) takes priority
    selected = x_mock_user or (sf_context_current_user or "ANONYMOUS").strip()
    user = _fetch_user_from_table(selected)
    if user:
        return user
    # Fallback for unknown users — ACE, synthesized email
    return CurrentUser(
        user_id=selected.lower(),
        email=f"{selected.lower()}@snowflake.com",
        display_name=selected.replace("_", " ").title(),
        role=UserRole.ACE,
        is_admin=False,
    )
```

---

## Task 3 — Update `backend/app/routers/auth.py`

Change `/mock-users` to serve `BKMNG_USERS` in SPCS mode instead of returning 404:

```python
@router.get("/mock-users", response_model=list[MockUserSummary])
async def list_mock_users() -> list[MockUserSummary]:
    if settings.spcs_mode:
        users = _fetch_all_users_from_table()   # new helper: SELECT * FROM BKMNG_USERS
        return [MockUserSummary(...) for u in users]
    return [MockUserSummary(...) for u in MOCK_USERS.values()]
```

---

## Task 4 — Update `bkmng-next/components/layout/Sidebar.tsx`

Two changes:
1. Remove the `{!isSpcs && ...}` guard so the switcher renders in SPCS mode
2. Replace hardcoded `USER_SWITCHER_OPTIONS` with dynamic `mockUsers` from `useAuth()` — the context already fetches `/api/auth/mock-users` and stores results in `mockUsers`

```tsx
// Before (hardcoded + hidden in SPCS):
{!isSpcs && (
  <select ...>
    {USER_SWITCHER_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
  </select>
)}

// After (dynamic, always shown):
{mockUsers && mockUsers.length > 0 && (
  <select value={mockUserId} onChange={e => switchUser(e.target.value)} ...>
    {mockUsers.map(u => (
      <option key={u.user_id} value={u.user_id}>
        {u.display_name} ({u.role.toUpperCase()})
      </option>
    ))}
  </select>
)}
```

---

## Task 5 — Update `bkmng-spec-demo.yaml`

Clear `ADMIN_USERS` (role/admin now table-driven):
```yaml
ADMIN_USERS: ""
```

---

## Task 6 — Rebuild Docker Image and Push

```bash
cd BookManager
docker build --platform linux/amd64 -f Dockerfile.spcs -t bkmng:demo .
docker tag bkmng:demo sfsenorthamerica-jdavis-aws1.registry.snowflakecomputing.com/bookmanager/demo/bkmng_repo/bkmng:latest
docker push sfsenorthamerica-jdavis-aws1.registry.snowflakecomputing.com/bookmanager/demo/bkmng_repo/bkmng:latest
```

---

## Task 7 — Redeploy via ALTER SERVICE (JDAVIS_AWS1)

```sql
ALTER SERVICE BOOKMANAGER.DEMO.BKMNG_SERVICE FROM SPECIFICATION $$ ... $$;
```
