# Plan: Add Team Profiles + Remove Mock Data

## Overview

Two goals: (1) disable mock data so real Snowflake data flows everywhere, (2) add the 15 remaining activation team ACEs to both local dev and SPCS user lists.

---

## Task 1 — Disable Mock Data in [`backend/app/config.py`](BookManager/backend/app/config.py)

Change the default so `SnowflakeDataService` is used everywhere:

```python
# Line 10 — change from:
mock_data: bool = True
# to:
mock_data: bool = False
```

This single change switches `get_data_service()` in [`backend/app/services/__init__.py`](BookManager/backend/app/services/__init__.py) to return `SnowflakeDataService()` for all API routes. The frontend already calls real API endpoints — no frontend changes needed to disable mock data.

---

## Task 2 — Update `MOCK_USERS` in [`backend/app/auth/dependencies.py`](BookManager/backend/app/auth/dependencies.py)

`MOCK_USERS` is used by the `/auth/mock-users` endpoint in local dev mode (non-SPCS) to populate the sidebar user switcher. Replace the existing 3-entry dict with all 19 activation team members.

**Remove:** `jusdavis-acem` (synthetic test entry) and `team_id` fields (unused)

**Final MOCK_USERS (19 entries):**

| Key | Display Name | Email | Role |
|---|---|---|---|
| jusdavis | Justin Davis | j.davis@snowflake.com | ACE |
| ufitolo | Ufi Olakpe | ufi.olakpe@snowflake.com | ACEM |
| gilee | Gilbert Lee | gilbert.lee@snowflake.com | ACEM |
| dbaccus | Daunte Baccus | daunte.baccus@snowflake.com | ACEM |
| aardestani | Ali Ardestani | ali.ardestani@snowflake.com | ACE |
| aflors | Allison Flors | allison.flors@snowflake.com | ACE |
| awickman | Andy Wickman | andy.wickman@snowflake.com | ACE |
| cfriend | Cody Friend | cody.friend@snowflake.com | ACE |
| dhkim | David H. Kim | david.h.kim@snowflake.com | ACE |
| edelatorre | Emma Delatorre | emma.delatorre@snowflake.com | ACE |
| jkirshenbaum | Joe Kirshenbaum | joe.kirshenbaum@snowflake.com | ACE |
| jfarinacci | Jorge Farinacci | jorge.farinacci@snowflake.com | ACE |
| mkeeter | Max Keeter | max.keeter@snowflake.com | ACE |
| mvandersteen | Micah Vandersteen | micah.vandersteen@snowflake.com | ACE |
| nessner | Nick Essner | nick.essner@snowflake.com | ACE |
| pcanciari | Paolo Canciari | paolo.canciari@snowflake.com | ACE |
| ppatel | Paragi Patel | paragi.patel@snowflake.com | ACE |
| pmonteiro | Paulo Monteiro | paulo.monteiro@snowflake.com | ACE |
| sbwilliams | Steven B. Williams | steven.b.williams@snowflake.com | ACE |

> **Note on Snowflake usernames**: Keys follow `{first_initial}{last_name}` convention. Actual Snowflake login usernames may differ — correct them before pushing to SPCS if needed. For local dev, the key is just the `X-Mock-User` header value.

---

## Task 3 — Insert 15 rows into `BKMNG_USERS` (Snowhouse)

```sql
INSERT INTO TEMP.JUSDAVIS.BKMNG_USERS (snowflake_username, display_name, email, role, is_admin)
VALUES
    ('aardestani', 'Ali Ardestani',       'ali.ardestani@snowflake.com',     'ace', false),
    ('aflors',     'Allison Flors',        'allison.flors@snowflake.com',     'ace', false),
    ('awickman',   'Andy Wickman',         'andy.wickman@snowflake.com',      'ace', false),
    ('cfriend',    'Cody Friend',          'cody.friend@snowflake.com',       'ace', false),
    ('dhkim',      'David H. Kim',         'david.h.kim@snowflake.com',       'ace', false),
    ('edelatorre', 'Emma Delatorre',       'emma.delatorre@snowflake.com',    'ace', false),
    ('jkirshenbaum','Joe Kirshenbaum',     'joe.kirshenbaum@snowflake.com',   'ace', false),
    ('jfarinacci', 'Jorge Farinacci',      'jorge.farinacci@snowflake.com',   'ace', false),
    ('mkeeter',    'Max Keeter',           'max.keeter@snowflake.com',        'ace', false),
    ('mvandersteen','Micah Vandersteen',   'micah.vandersteen@snowflake.com', 'ace', false),
    ('nessner',    'Nick Essner',          'nick.essner@snowflake.com',       'ace', false),
    ('pcanciari',  'Paolo Canciari',       'paolo.canciari@snowflake.com',    'ace', false),
    ('ppatel',     'Paragi Patel',         'paragi.patel@snowflake.com',      'ace', false),
    ('pmonteiro',  'Paulo Monteiro',       'paulo.monteiro@snowflake.com',    'ace', false),
    ('sbwilliams', 'Steven B. Williams',   'steven.b.williams@snowflake.com', 'ace', false);
```

---

## Task 4 — Remove Backend Mock Files

Delete the entire [`backend/app/mocks/`](BookManager/backend/app/mocks/) directory (`data.py`, `service.py`, `__init__.py`). These are dead code once `mock_data=False`.

Update [`backend/app/services/__init__.py`](BookManager/backend/app/services/__init__.py) — remove the `MockDataService` branch (the lazy import `from app.mocks.service import MockDataService`):

```python
from app.services.snowflake_service import SnowflakeDataService

def get_data_service():
    return SnowflakeDataService()
```

---

## Task 5 — Remove Frontend Mock Files

The only runtime dependency on [`frontend/src/mocks/`](BookManager/frontend/src/mocks/) is one `import type` in [`frontend/src/api/hooks.ts`](BookManager/frontend/src/api/hooks.ts):

```ts
import type { CreditDailyEntry } from '../mocks/credits'
```

Move the `CreditDailyEntry` type definition into [`frontend/src/types.ts`](BookManager/frontend/src/types.ts), update the import in `hooks.ts`, then delete the entire `src/mocks/` directory.
