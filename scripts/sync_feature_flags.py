#!/usr/bin/env python3
"""Sync feature flag registry to Snowflake.

Reads backend/app/feature_flags/registry.py and idempotently MERGEs into
TEMP.JUSDAVIS.BKMNG_FEATURE_FLAGS plus seeds per-user/per-role overrides
from each flag's enable_for_users / enable_for_roles lists.

Safe to run repeatedly. Reports orphaned DB flags as warnings (does not delete).

Usage:
    python3 scripts/sync_feature_flags.py
    SNOWFLAKE_CONNECTION_NAME=SNOWHOUSE_AWS_US_WEST_2 python3 scripts/sync_feature_flags.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "backend"))

try:
    from app.feature_flags.registry import FEATURE_FLAGS
except Exception as e:
    print(f"ERROR: cannot import flag registry: {e}", file=sys.stderr)
    sys.exit(1)

try:
    import snowflake.connector
except ImportError:
    print("WARNING: snowflake-connector-python not installed; skipping sync.", file=sys.stderr)
    sys.exit(0)


CONNECTION_NAME = os.getenv("SNOWFLAKE_CONNECTION_NAME", "SNOWHOUSE_AWS_US_WEST_2")
FLAGS_TBL = "TEMP.JUSDAVIS.BKMNG_FEATURE_FLAGS"
OVERRIDES_TBL = "TEMP.JUSDAVIS.BKMNG_FEATURE_FLAG_OVERRIDES"


def main() -> int:
    try:
        conn = snowflake.connector.connect(connection_name=CONNECTION_NAME)
    except Exception as e:
        print(f"WARNING: could not connect to {CONNECTION_NAME}: {e}", file=sys.stderr)
        print("Skipping sync (treat as best-effort).", file=sys.stderr)
        return 0

    try:
        cur = conn.cursor()
        upserted = 0
        ov_upserted = 0

        for key, defn in FEATURE_FLAGS.items():
            cur.execute(
                f"""
                MERGE INTO {FLAGS_TBL} t
                USING (SELECT %s AS k) s ON t.FLAG_KEY = s.k
                WHEN MATCHED THEN UPDATE SET
                    DESCRIPTION = %s,
                    CATEGORY = %s,
                    DEFAULT_ENABLED = %s,
                    UPDATED_AT = CURRENT_TIMESTAMP()
                WHEN NOT MATCHED THEN INSERT (FLAG_KEY, DESCRIPTION, CATEGORY, DEFAULT_ENABLED)
                    VALUES (%s, %s, %s, %s)
                """,
                (
                    key,
                    defn.get("description"),
                    defn.get("category"),
                    bool(defn.get("default_enabled", False)),
                    key,
                    defn.get("description"),
                    defn.get("category"),
                    bool(defn.get("default_enabled", False)),
                ),
            )
            upserted += 1

            for uid in defn.get("enable_for_users", []) or []:
                cur.execute(
                    f"""
                    MERGE INTO {OVERRIDES_TBL} t
                    USING (SELECT %s AS k, %s AS tt, %s AS tv) s
                      ON t.FLAG_KEY = s.k AND t.TARGET_TYPE = s.tt AND t.TARGET_VALUE = s.tv
                    WHEN MATCHED THEN UPDATE SET ENABLED = TRUE
                    WHEN NOT MATCHED THEN INSERT (FLAG_KEY, TARGET_TYPE, TARGET_VALUE, ENABLED)
                        VALUES (%s, %s, %s, TRUE)
                    """,
                    (key, "user", uid, key, "user", uid),
                )
                ov_upserted += 1

            for role in defn.get("enable_for_roles", []) or []:
                cur.execute(
                    f"""
                    MERGE INTO {OVERRIDES_TBL} t
                    USING (SELECT %s AS k, %s AS tt, %s AS tv) s
                      ON t.FLAG_KEY = s.k AND t.TARGET_TYPE = s.tt AND t.TARGET_VALUE = s.tv
                    WHEN MATCHED THEN UPDATE SET ENABLED = TRUE
                    WHEN NOT MATCHED THEN INSERT (FLAG_KEY, TARGET_TYPE, TARGET_VALUE, ENABLED)
                        VALUES (%s, %s, %s, TRUE)
                    """,
                    (key, "role", role, key, "role", role),
                )
                ov_upserted += 1

        cur.execute(f"SELECT FLAG_KEY FROM {FLAGS_TBL}")
        db_keys = {r[0] for r in cur.fetchall()}
        orphans = db_keys - set(FEATURE_FLAGS.keys())
        if orphans:
            print(f"WARNING: {len(orphans)} flag(s) in DB not in registry (kept, not deleted):")
            for k in sorted(orphans):
                print(f"  - {k}")

        print(f"sync-flags: upserted {upserted} flag(s), {ov_upserted} override(s) into {CONNECTION_NAME}")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
