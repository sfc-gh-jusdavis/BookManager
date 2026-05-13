Quick BookManager pipeline observability — health check + inventory in one command.

## Steps

1. **Run the health check SP** (zero FAIL rows is the goal):
   ```sql
   USE WAREHOUSE SE_XS_WH;
   CALL TEMP.JUSDAVIS.SP_BKMNG_PIPELINE_HEALTH_CHECK();
   ```
   Use connection: `SNOWHOUSE_AWS_US_WEST_2`.

2. **List task state** (which tasks are started/suspended, last run):
   ```sql
   SELECT
     NAME,
     STATE,
     SCHEDULE,
     LAST_SUSPENDED_ON,
     CONDITION
   FROM TEMP.INFORMATION_SCHEMA.TASKS
   WHERE NAME LIKE 'TK_BKMNG_%'
   ORDER BY NAME;
   ```

3. **Recent task executions** (last 24h):
   ```sql
   SELECT
     NAME,
     STATE,
     SCHEDULED_TIME,
     COMPLETED_TIME,
     ERROR_MESSAGE
   FROM TABLE(TEMP.INFORMATION_SCHEMA.TASK_HISTORY(
     SCHEDULED_TIME_RANGE_START => DATEADD('hour', -24, CURRENT_TIMESTAMP())
   ))
   WHERE NAME LIKE 'TK_BKMNG_%'
   ORDER BY SCHEDULED_TIME DESC
   LIMIT 50;
   ```

4. **Inventory** (table row counts, last refresh, on-demand vs scheduled):
   ```sql
   CALL TEMP.JUSDAVIS.SP_BKMNG_PIPELINE_INVENTORY();
   ```

5. **Print summary** for the user:
   - Health check FAIL count (must be 0; flag any non-zero)
   - Task count: started vs suspended
   - Recent failures (state=FAILED in last 24h)
   - Stale tables (last refresh > expected interval)

## When to use

- Before any DDL on a `BKMNG_` table or task — establish baseline.
- After any DDL on a `BKMNG_` table or task — verify zero FAIL rows.
- Mornings during heavy pipeline iteration (catch overnight task failures).
- When investigating "why is data stale" or "did the task run last night".

## Notes

- `TASK_HISTORY()` max lookback is 7 days; `SCHEDULED_TIME_RANGE_START` is required.
- Ghost-started tasks (state=started but zero executions): SUSPEND then RESUME.
- For full pipeline reference: [`snowflake/PIPELINE.md`](snowflake/PIPELINE.md).
- `make pipeline-status` runs the same two SPs from the CLI if a Snowflake connection is configured.
