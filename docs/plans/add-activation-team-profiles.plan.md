# Plan: Add Activation Team Profiles

## Overview
Add the remaining 15 ACE members to the activation team roster. Local dev uses `MOCK_USERS` in `dependencies.py`; SPCS uses `BKMNG_USERS` in Snowhouse. Both need updating.

## Final Team (19 total)

| Username Key | Display Name | Email | Role |
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

## Task 1 — Update `MOCK_USERS` in [`backend/app/auth/dependencies.py`](BookManager/backend/app/auth/dependencies.py)

- Remove the `jusdavis-acem` synthetic entry (not a real user)
- Add 15 new `CurrentUser` entries with `role=UserRole.ACE`
- All new users: `is_admin=False`

```python
MOCK_USERS: dict[str, CurrentUser] = {
    "jusdavis": CurrentUser(user_id="jusdavis", email="j.davis@snowflake.com",
        display_name="Justin Davis", role=UserRole.ACE, is_admin=True),
    "ufitolo": CurrentUser(user_id="ufitolo", email="ufi.olakpe@snowflake.com",
        display_name="Ufi Olakpe", role=UserRole.ACEM),
    "gilee": CurrentUser(user_id="gilee", email="gilbert.lee@snowflake.com",
        display_name="Gilbert Lee", role=UserRole.ACEM),
    "dbaccus": CurrentUser(user_id="dbaccus", email="daunte.baccus@snowflake.com",
        display_name="Daunte Baccus", role=UserRole.ACEM),
    # ... 15 new ACEs ...
    "aardestani": CurrentUser(user_id="aardestani", email="ali.ardestani@snowflake.com",
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
    ('aardestani', 'Ali Ardestani', 'ali.ardestani@snowflake.com', 'ace', false),
    ('aflors', 'Allison Flors', 'allison.flors@snowflake.com', 'ace', false),
    ('awickman', 'Andy Wickman', 'andy.wickman@snowflake.com', 'ace', false),
    ('cfriend', 'Cody Friend', 'cody.friend@snowflake.com', 'ace', false),
    ('dhkim', 'David H. Kim', 'david.h.kim@snowflake.com', 'ace', false),
    ('edelatorre', 'Emma Delatorre', 'emma.delatorre@snowflake.com', 'ace', false),
    ('jkirshenbaum', 'Joe Kirshenbaum', 'joe.kirshenbaum@snowflake.com', 'ace', false),
    ('jfarinacci', 'Jorge Farinacci', 'jorge.farinacci@snowflake.com', 'ace', false),
    ('mkeeter', 'Max Keeter', 'max.keeter@snowflake.com', 'ace', false),
    ('mvandersteen', 'Micah Vandersteen', 'micah.vandersteen@snowflake.com', 'ace', false),
    ('nessner', 'Nick Essner', 'nick.essner@snowflake.com', 'ace', false),
    ('pcanciari', 'Paolo Canciari', 'paolo.canciari@snowflake.com', 'ace', false),
    ('ppatel', 'Paragi Patel', 'paragi.patel@snowflake.com', 'ace', false),
    ('pmonteiro', 'Paulo Monteiro', 'paulo.monteiro@snowflake.com', 'ace', false),
    ('sbwilliams', 'Steven B. Williams', 'steven.b.williams@snowflake.com', 'ace', false);
```

> **Note on Snowflake usernames**: The username keys (`aardestani`, `aflors`, etc.) are best-guess derivations from email prefixes. These will need to match actual Snowflake login usernames for the SPCS `Sf-Context-Current-User` header to resolve correctly. They can be corrected before pushing to SPCS.
