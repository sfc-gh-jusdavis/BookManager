# Plan: Add Activation Team Profiles

## Overview
Add the remaining 15 ACE members to the activation team roster. Local dev uses `MOCK_USERS` in `dependencies.py`; SPCS uses `BKMNG_USERS` in Snowhouse. Both need updating.

## Final Team (19 total)

| Username Key | Display Name | Email | Role |
|---|---|---|---|
| jusdavis | Justin Davis | redacted@example.com | ACE |
| ufitolo | Ufi Olakpe | redacted@example.com | ACEM |
| gilee | Gilbert Lee | redacted@example.com | ACEM |
| dbaccus | Daunte Baccus | redacted@example.com | ACEM |
| aardestani | Ali Ardestani | redacted@example.com | ACE |
| aflors | Allison Flors | redacted@example.com | ACE |
| awickman | Andy Wickman | redacted@example.com | ACE |
| cfriend | Cody Friend | redacted@example.com | ACE |
| dhkim | David H. Kim | redacted@example.com | ACE |
| edelatorre | Emma Delatorre | redacted@example.com | ACE |
| jkirshenbaum | Joe Kirshenbaum | redacted@example.com | ACE |
| jfarinacci | Jorge Farinacci | redacted@example.com | ACE |
| mkeeter | Max Keeter | redacted@example.com | ACE |
| mvandersteen | Micah Vandersteen | redacted@example.com | ACE |
| nessner | Nick Essner | redacted@example.com | ACE |
| pcanciari | Paolo Canciari | redacted@example.com | ACE |
| ppatel | Paragi Patel | redacted@example.com | ACE |
| pmonteiro | Paulo Monteiro | redacted@example.com | ACE |
| sbwilliams | Steven B. Williams | redacted@example.com | ACE |

## Task 1 — Update `MOCK_USERS` in [`backend/app/auth/dependencies.py`](BookManager/backend/app/auth/dependencies.py)

- Remove the `jusdavis-acem` synthetic entry (not a real user)
- Add 15 new `CurrentUser` entries with `role=UserRole.ACE`
- All new users: `is_admin=False`

```python
MOCK_USERS: dict[str, CurrentUser] = {
    "jusdavis": CurrentUser(user_id="jusdavis", email="redacted@example.com",
        display_name="Justin Davis", role=UserRole.ACE, is_admin=True),
    "ufitolo": CurrentUser(user_id="ufitolo", email="redacted@example.com",
        display_name="Ufi Olakpe", role=UserRole.ACEM),
    "gilee": CurrentUser(user_id="gilee", email="redacted@example.com",
        display_name="Gilbert Lee", role=UserRole.ACEM),
    "dbaccus": CurrentUser(user_id="dbaccus", email="redacted@example.com",
        display_name="Daunte Baccus", role=UserRole.ACEM),
    # ... 15 new ACEs ...
    "aardestani": CurrentUser(user_id="aardestani", email="redacted@example.com",
        display_name="Ali Ardestani", role=UserRole.ACE),
    # etc.
}
```

Note: `team_id` will be removed from existing entries — it's an unused field and not in the DB schema.

## Task 2 — Insert into `BKMNG_USERS` in Snowhouse

```sql
INSERT INTO TEMP.JUSDAVIS.BKMNG_USERS
    (snowflake_username, display_name, email, role, is_admin)
VALUES
    ('aardestani', 'Ali Ardestani', 'redacted@example.com', 'ace', false),
    ('aflors', 'Allison Flors', 'redacted@example.com', 'ace', false),
    ('awickman', 'Andy Wickman', 'redacted@example.com', 'ace', false),
    ('cfriend', 'Cody Friend', 'redacted@example.com', 'ace', false),
    ('dhkim', 'David H. Kim', 'redacted@example.com', 'ace', false),
    ('edelatorre', 'Emma Delatorre', 'redacted@example.com', 'ace', false),
    ('jkirshenbaum', 'Joe Kirshenbaum', 'redacted@example.com', 'ace', false),
    ('jfarinacci', 'Jorge Farinacci', 'redacted@example.com', 'ace', false),
    ('mkeeter', 'Max Keeter', 'redacted@example.com', 'ace', false),
    ('mvandersteen', 'Micah Vandersteen', 'redacted@example.com', 'ace', false),
    ('nessner', 'Nick Essner', 'redacted@example.com', 'ace', false),
    ('pcanciari', 'Paolo Canciari', 'redacted@example.com', 'ace', false),
    ('ppatel', 'Paragi Patel', 'redacted@example.com', 'ace', false),
    ('pmonteiro', 'Paulo Monteiro', 'redacted@example.com', 'ace', false),
    ('sbwilliams', 'Steven B. Williams', 'redacted@example.com', 'ace', false);
```

> **Note on Snowflake usernames**: The username keys (`aardestani`, `aflors`, etc.) are best-guess derivations from email prefixes. These will need to match actual Snowflake login usernames for the SPCS `Sf-Context-Current-User` header to resolve correctly. They can be corrected before pushing to SPCS.
