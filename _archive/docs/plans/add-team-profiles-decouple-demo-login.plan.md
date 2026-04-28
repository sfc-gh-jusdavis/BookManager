# Plan: Add Team Profiles + Decouple Demo Login

## Overview

After these changes, anyone who logs into the JDAVIS_AWS1 account as `BKMNG_DEMO` (shared credentials) will land on the default profile and can freely switch to any of the 19 activation team perspectives. Personal Snowflake users (JUSDAVIS, GILEE, etc.) will still auto-resolve to their own profile.

```
flowchart TD
    A[User visits app URL] --> B[Snowflake OAuth login]
    B --> C{Sf-Context-Current-User}
    C -->|recognized in BKMNG_USERS| D[Load their profile directly]
    C -->|unrecognized, e.g. BKMNG_DEMO| E[Load default profile: jusdavis]
    D --> F[User switcher shows all 19 team members]
    E --> F
    F -->|X-Mock-User header| G[Scope all data to selected profile]
```

---

## Task 1 — Disable Mock Data: [`backend/app/config.py`](BookManager/backend/app/config.py)

```python
mock_data: bool = False   # was: True
```

---

## Task 2 — Update Auth: [`backend/app/auth/dependencies.py`](BookManager/backend/app/auth/dependencies.py)

Two changes:

**A) Replace MOCK_USERS with full 19-member roster** (remove `jusdavis-acem`, remove `team_id`, add 15 new ACEs):

```python
MOCK_USERS: dict[str, CurrentUser] = {
    "jusdavis":      CurrentUser(user_id="jusdavis",      email="redacted@example.com",             display_name="Justin Davis",       role=UserRole.ACE,  is_admin=True),
    "ufitolo":       CurrentUser(user_id="ufitolo",       email="redacted@example.com",           display_name="Ufi Olakpe",         role=UserRole.ACEM),
    "gilee":         CurrentUser(user_id="gilee",         email="redacted@example.com",          display_name="Gilbert Lee",        role=UserRole.ACEM),
    "dbaccus":       CurrentUser(user_id="dbaccus",       email="redacted@example.com",        display_name="Daunte Baccus",      role=UserRole.ACEM),
    "aardestani":    CurrentUser(user_id="aardestani",    email="redacted@example.com",        display_name="Ali Ardestani",      role=UserRole.ACE),
    "aflors":        CurrentUser(user_id="aflors",        email="redacted@example.com",        display_name="Allison Flors",      role=UserRole.ACE),
    "awickman":      CurrentUser(user_id="awickman",      email="redacted@example.com",         display_name="Andy Wickman",       role=UserRole.ACE),
    "cfriend":       CurrentUser(user_id="cfriend",       email="redacted@example.com",          display_name="Cody Friend",        role=UserRole.ACE),
    "dhkim":         CurrentUser(user_id="dhkim",         email="redacted@example.com",          display_name="David H. Kim",       role=UserRole.ACE),
    "edelatorre":    CurrentUser(user_id="edelatorre",    email="redacted@example.com",       display_name="Emma Delatorre",     role=UserRole.ACE),
    "jkirshenbaum":  CurrentUser(user_id="jkirshenbaum",  email="redacted@example.com",      display_name="Joe Kirshenbaum",    role=UserRole.ACE),
    "jfarinacci":    CurrentUser(user_id="jfarinacci",    email="redacted@example.com",      display_name="Jorge Farinacci",    role=UserRole.ACE),
    "mkeeter":       CurrentUser(user_id="mkeeter",       email="redacted@example.com",           display_name="Max Keeter",         role=UserRole.ACE),
    "mvandersteen":  CurrentUser(user_id="mvandersteen",  email="redacted@example.com",    display_name="Micah Vandersteen",  role=UserRole.ACE),
    "nessner":       CurrentUser(user_id="nessner",       email="redacted@example.com",          display_name="Nick Essner",        role=UserRole.ACE),
    "pcanciari":     CurrentUser(user_id="pcanciari",     email="redacted@example.com",       display_name="Paolo Canciari",     role=UserRole.ACE),
    "ppatel":        CurrentUser(user_id="ppatel",        email="redacted@example.com",         display_name="Paragi Patel",       role=UserRole.ACE),
    "pmonteiro":     CurrentUser(user_id="pmonteiro",     email="redacted@example.com",       display_name="Paulo Monteiro",     role=UserRole.ACE),
    "sbwilliams":    CurrentUser(user_id="sbwilliams",    email="redacted@example.com",    display_name="Steven B. Williams", role=UserRole.ACE),
}
```

**B) Fix SPCS fallback** — when logged-in Snowflake user isn't in `BKMNG_USERS`, load the default profile instead of synthesizing a fake user:

```python
# In get_current_user(), SPCS branch — change the fallback:
if settings.spcs_mode:
    selected = x_mock_user or (sf_context_current_user or "").strip()
    user = _fetch_user_from_table(selected)
    if user:
        return user
    # Unrecognized login (e.g. BKMNG_DEMO) → load default profile
    default = _fetch_user_from_table(settings.spcs_default_user_id)
    if default:
        return default
    # Ultimate fallback (shouldn't occur if table is healthy)
    return CurrentUser(user_id="anonymous", email="redacted@example.com",
                       display_name="Demo User", role=UserRole.ACE, is_admin=False)
```

---

## Task 3 — Fix Stale Default User: [`bkmng-spec-demo.yaml`](BookManager/bkmng-spec-demo.yaml)

```yaml
SPCS_DEFAULT_USER_ID: "jusdavis"   # was: "ace-jane" (stale mock ID)
```

---

## Task 4 — Insert 15 rows into `BKMNG_USERS` (Snowhouse)

```sql
INSERT INTO TEMP.JUSDAVIS.BKMNG_USERS (snowflake_username, display_name, email, role, is_admin)
VALUES
    ('aardestani',   'Ali Ardestani',       'redacted@example.com',     'ace', false),
    ('aflors',       'Allison Flors',        'redacted@example.com',     'ace', false),
    ('awickman',     'Andy Wickman',         'redacted@example.com',      'ace', false),
    ('cfriend',      'Cody Friend',          'redacted@example.com',       'ace', false),
    ('dhkim',        'David H. Kim',         'redacted@example.com',       'ace', false),
    ('edelatorre',   'Emma Delatorre',       'redacted@example.com',    'ace', false),
    ('jkirshenbaum', 'Joe Kirshenbaum',      'redacted@example.com',   'ace', false),
    ('jfarinacci',   'Jorge Farinacci',      'redacted@example.com',   'ace', false),
    ('mkeeter',      'Max Keeter',           'redacted@example.com',        'ace', false),
    ('mvandersteen', 'Micah Vandersteen',    'redacted@example.com', 'ace', false),
    ('nessner',      'Nick Essner',          'redacted@example.com',       'ace', false),
    ('pcanciari',    'Paolo Canciari',       'redacted@example.com',    'ace', false),
    ('ppatel',       'Paragi Patel',         'redacted@example.com',      'ace', false),
    ('pmonteiro',    'Paulo Monteiro',       'redacted@example.com',    'ace', false),
    ('sbwilliams',   'Steven B. Williams',   'redacted@example.com', 'ace', false);
```

---

## Task 5 — Provision Demo User/Role in JDAVIS_AWS1

Run via `snow sql --connection JDAVIS_AWS1`:

```sql
CREATE ROLE IF NOT EXISTS BKMNG_DEMO_ROLE;
GRANT ROLE BKMNG_DEMO_ROLE TO ROLE ACCOUNTADMIN;

GRANT USAGE ON DATABASE BOOKMANAGER TO ROLE BKMNG_DEMO_ROLE;
GRANT USAGE ON SCHEMA BOOKMANAGER.DEMO TO ROLE BKMNG_DEMO_ROLE;
GRANT ALL_ENDPOINTS_USAGE ON SERVICE BOOKMANAGER.DEMO.BKMNG_SERVICE TO ROLE BKMNG_DEMO_ROLE;

CREATE USER IF NOT EXISTS BKMNG_DEMO
    PASSWORD = '<to_be_set>'
    DEFAULT_ROLE = BKMNG_DEMO_ROLE
    MUST_CHANGE_PASSWORD = FALSE
    COMMENT = 'Shared demo account for BookManager app';
GRANT ROLE BKMNG_DEMO_ROLE TO USER BKMNG_DEMO;
```

> The password will be generated and noted for sharing. Anyone given these credentials can log into the app and freely switch between all 19 team profiles.

---

## Task 6 — Remove Backend Mock Files

Delete [`backend/app/mocks/`](BookManager/backend/app/mocks/) directory. Simplify [`backend/app/services/__init__.py`](BookManager/backend/app/services/__init__.py):

```python
from app.services.snowflake_service import SnowflakeDataService

def get_data_service():
    return SnowflakeDataService()
```

---

## Task 7 — Remove Frontend Mock Files

Move `CreditDailyEntry` type from [`frontend/src/mocks/credits.ts`](BookManager/frontend/src/mocks/credits.ts) into [`frontend/src/types.ts`](BookManager/frontend/src/types.ts), update the import in [`frontend/src/api/hooks.ts`](BookManager/frontend/src/api/hooks.ts) (line 18), then delete the entire [`frontend/src/mocks/`](BookManager/frontend/src/mocks/) directory.
