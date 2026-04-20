Run the Snowflake pipeline health check and report any failures.

Steps:
1. Execute: `CALL TEMP.JUSDAVIS.SP_BKMNG_PIPELINE_HEALTH_CHECK();`
2. Report the results — zero FAIL rows required
3. If any tables show FAIL or WARN, diagnose and suggest fixes
4. Check task execution history: `SELECT * FROM TABLE(TEMP.INFORMATION_SCHEMA.TASK_HISTORY(SCHEDULED_TIME_RANGE_START => DATEADD('hour', -24, CURRENT_TIMESTAMP()))) WHERE DATABASE_NAME = 'TEMP' AND SCHEMA_NAME = 'JUSDAVIS' AND NAME LIKE 'TASK_%BKMNG%' ORDER BY SCHEDULED_TIME DESC LIMIT 30;`

Use connection SNOWHOUSE_AWS_US_WEST_2 and warehouse SE_XS_WH.
