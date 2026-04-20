Build the SPCS Docker image, push to the registry, and update the running service.

Steps:
1. Run `make test-spcs-build` to verify the image builds locally
2. If successful, run `make deploy` to tag, push, and ALTER SERVICE
3. After deploy, verify the service is running: `snow sql -c JDAVIS_AWS1 -q "SHOW SERVICES IN SCHEMA BOOKMANAGER.DEMO"`
4. Check the endpoint: https://ar7vvu-sfsenorthamerica-jdavis-aws1.snowflakecomputing.app/api/health/ready

If the compute pool is suspended, resume it first:
```sql
ALTER COMPUTE POOL BKMNG_POOL RESUME;
```
