"""
Extract live DDL from TEMP.JUSDAVIS and write organized .sql files.

Usage:
    SNOWFLAKE_CONNECTION_NAME=SNOWHOUSE_AWS_US_WEST_2 python3 snowflake/extract_ddl.py

Outputs:
    snowflake/tables/        -- BKMNG_* tables
    snowflake/analytics/     -- T_* and ROI_* tables
    snowflake/procedures/    -- user-defined stored procedures
    snowflake/tasks/         -- all tasks
    snowflake/views/         -- all views
    snowflake/README.md      -- auto-generated inventory
"""

import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import snowflake.connector

DATABASE = "TEMP"
SCHEMA = "JUSDAVIS"
FQSCHEMA = f"{DATABASE}.{SCHEMA}"

BASE = Path(__file__).parent
DIRS = {
    "tables": BASE / "tables",
    "analytics": BASE / "analytics",
    "procedures": BASE / "procedures",
    "tasks": BASE / "tasks",
    "views": BASE / "views",
}
for d in DIRS.values():
    d.mkdir(exist_ok=True)


def connect():
    conn_name = os.getenv("SNOWFLAKE_CONNECTION_NAME", "SNOWHOUSE_AWS_US_WEST_2")
    return snowflake.connector.connect(connection_name=conn_name)


def run(cur, sql, *args):
    cur.execute(sql, args)
    cols = [c[0] for c in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def get_ddl(cur, obj_type, fq_name):
    cur.execute(f"SELECT GET_DDL('{obj_type}', '{fq_name}')")
    return cur.fetchone()[0]


def sp_signature(arguments_col):
    """
    Convert SHOW PROCEDURES 'arguments' value to the form needed by GET_DDL.
    e.g. "SP_COMPUTE_USE_CASE_BREAKDOWNS(DEFAULT BOOLEAN) RETURN VARCHAR"
         -> "SP_COMPUTE_USE_CASE_BREAKDOWNS(BOOLEAN)"
    e.g. "SP_CHECK_MEETING_REMINDERS() RETURN VARCHAR"
         -> "SP_CHECK_MEETING_REMINDERS()"
    """
    m = re.match(r"^(\S+)\(([^)]*)\)", arguments_col.strip())
    if not m:
        return arguments_col.split(" ")[0] + "()"
    name, params = m.group(1), m.group(2)
    if not params.strip():
        return f"{name}()"
    cleaned = []
    for p in params.split(","):
        p = p.strip()
        p = re.sub(r"^DEFAULT\s+", "", p, flags=re.IGNORECASE)
        cleaned.append(p.strip())
    return f"{name}({', '.join(cleaned)})"


def write_sql(path, ddl, header=""):
    content = ""
    if header:
        content = f"-- {header}\n\n"
    content += ddl.rstrip() + "\n"
    path.write_text(content, encoding="utf-8")
    return path


def extract_tables(cur, inventory):
    rows = run(cur, f"SHOW TABLES IN SCHEMA {FQSCHEMA}")
    print(f"  Found {len(rows)} tables")
    for row in rows:
        name = row["name"]
        created = str(row.get("created_on", ""))
        try:
            ddl = get_ddl(cur, "TABLE", f"{FQSCHEMA}.{name}")
        except Exception as e:
            print(f"    WARN: could not get DDL for table {name}: {e}")
            continue

        prefix = name.upper()
        if prefix.startswith("BKMNG_"):
            dest = DIRS["tables"] / f"{name.lower()}.sql"
            category = "tables"
        else:
            dest = DIRS["analytics"] / f"{name.lower()}.sql"
            category = "analytics"

        write_sql(dest, ddl, header=f"TABLE: {FQSCHEMA}.{name}  |  created: {created}")
        inventory.append(("TABLE", category, name, created))
        print(f"    -> {dest.relative_to(BASE.parent)}")


def extract_procedures(cur, inventory):
    rows = run(cur, f"SHOW PROCEDURES IN SCHEMA {FQSCHEMA}")
    user_rows = [r for r in rows if r.get("is_builtin") == "N"]
    print(f"  Found {len(user_rows)} user-defined procedures")
    for row in user_rows:
        arguments = row["arguments"]
        created = str(row.get("created_on", ""))
        sig = sp_signature(arguments)
        fq_sig = f"{FQSCHEMA}.{sig}"
        try:
            ddl = get_ddl(cur, "PROCEDURE", fq_sig)
        except Exception as e:
            print(f"    WARN: could not get DDL for procedure {sig}: {e}")
            continue

        sp_name = sig.split("(")[0].lower()
        dest = DIRS["procedures"] / f"{sp_name}.sql"
        write_sql(dest, ddl, header=f"PROCEDURE: {FQSCHEMA}.{sig}  |  created: {created}")
        inventory.append(("PROCEDURE", "procedures", sig.split("(")[0], created))
        print(f"    -> {dest.relative_to(BASE.parent)}")


def extract_tasks(cur, inventory):
    rows = run(cur, f"SHOW TASKS IN SCHEMA {FQSCHEMA}")
    print(f"  Found {len(rows)} tasks")
    for row in rows:
        name = row["name"]
        created = str(row.get("created_on", ""))
        try:
            ddl = get_ddl(cur, "TASK", f"{FQSCHEMA}.{name}")
        except Exception as e:
            print(f"    WARN: could not get DDL for task {name}: {e}")
            continue

        dest = DIRS["tasks"] / f"{name.lower()}.sql"
        write_sql(dest, ddl, header=f"TASK: {FQSCHEMA}.{name}  |  created: {created}")
        inventory.append(("TASK", "tasks", name, created))
        print(f"    -> {dest.relative_to(BASE.parent)}")


def extract_views(cur, inventory):
    rows = run(cur, f"SHOW VIEWS IN SCHEMA {FQSCHEMA}")
    print(f"  Found {len(rows)} views")
    for row in rows:
        name = row["name"]
        created = str(row.get("created_on", ""))
        try:
            ddl = get_ddl(cur, "VIEW", f"{FQSCHEMA}.{name}")
        except Exception as e:
            print(f"    WARN: could not get DDL for view {name}: {e}")
            continue

        dest = DIRS["views"] / f"{name.lower()}.sql"
        write_sql(dest, ddl, header=f"VIEW: {FQSCHEMA}.{name}  |  created: {created}")
        inventory.append(("VIEW", "views", name, created))
        print(f"    -> {dest.relative_to(BASE.parent)}")


def write_readme(inventory):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "# Snowflake DDL — TEMP.JUSDAVIS",
        "",
        f"Auto-generated by `snowflake/extract_ddl.py` on {now}.",
        "Re-run any time after making changes in Snowflake to keep this in sync.",
        "",
        "## Summary",
        "",
    ]

    by_type = {}
    for obj_type, category, name, created in inventory:
        by_type.setdefault(obj_type, []).append((category, name, created))

    counts = {t: len(v) for t, v in by_type.items()}
    for t, c in sorted(counts.items()):
        lines.append(f"- **{t}**: {c}")
    lines.append("")

    for obj_type in ["TABLE", "PROCEDURE", "TASK", "VIEW"]:
        if obj_type not in by_type:
            continue
        lines.append(f"## {obj_type}S")
        lines.append("")
        lines.append("| Name | Directory | Created |")
        lines.append("|------|-----------|---------|")
        for category, name, created in sorted(by_type[obj_type], key=lambda x: x[1]):
            lines.append(f"| `{name}` | `snowflake/{category}/` | {created[:19]} |")
        lines.append("")

    readme = BASE / "README.md"
    readme.write_text("\n".join(lines), encoding="utf-8")
    print(f"  -> snowflake/README.md")


def main():
    print(f"Connecting to Snowflake ({os.getenv('SNOWFLAKE_CONNECTION_NAME', 'SNOWHOUSE_AWS_US_WEST_2')})...")
    conn = connect()
    cur = conn.cursor()
    cur.execute(f"USE DATABASE {DATABASE}")
    cur.execute(f"USE SCHEMA {SCHEMA}")

    inventory = []

    print("\nExtracting tables...")
    extract_tables(cur, inventory)

    print("\nExtracting procedures...")
    extract_procedures(cur, inventory)

    print("\nExtracting tasks...")
    extract_tasks(cur, inventory)

    print("\nExtracting views...")
    extract_views(cur, inventory)

    print("\nWriting README...")
    write_readme(inventory)

    cur.close()
    conn.close()

    total = len(inventory)
    print(f"\nDone. {total} objects extracted.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
