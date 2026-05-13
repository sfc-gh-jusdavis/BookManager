Build and deploy the BookManager image to Snowpark Container Services.

## Steps

1. **Pre-flight: verify PAT is valid**:
   ```bash
   cd ~/projects/BookManager
   if [ ! -f backend/.env ] || ! grep -q "^BKMNG_DEPLOY_PAT=" backend/.env; then
     echo "ERROR: BKMNG_DEPLOY_PAT not set in backend/.env. Cannot deploy."
     exit 1
   fi
   ```
   If missing or expired (401 errors during deploy), rotate:
   ```sql
   ALTER USER JUSDAVIS ROTATE PROGRAMMATIC ACCESS TOKEN BKMNG_DEPLOY_PAT;
   ```
   Then update `BKMNG_DEPLOY_PAT` in `backend/.env` with the new `token_secret`.

2. **Pre-flight: verify connection profile**:
   ```bash
   grep -q "^\[connections.bkmng_deploy\]" ~/.snowflake/connections.toml || \
     echo "ERROR: bkmng_deploy connection missing in ~/.snowflake/connections.toml"
   ```

3. **Sanity build (no push)** to catch Dockerfile errors fast:
   ```bash
   make test-spcs-build
   ```
   Aborts on failure. Saves the round-trip of pushing a broken image.

4. **Full deploy** (build + push + ALTER SERVICE):
   ```bash
   make deploy
   ```

5. **Verify service rolled**:
   ```bash
   make logs-spcs
   ```
   Should show the bkmng container booting fresh. Look for the FastAPI startup log line.

6. **Smoke test the URL**:
   ```bash
   curl -sf https://ar7vvu-sfsenorthamerica-jdavis-aws1.snowflakecomputing.app/health || echo "SPCS service health check failed"
   ```

## Failure modes

| Symptom | Fix |
|---|---|
| 401 / "user differs from access token" | PAT expired -> rotate (see step 1) |
| `make deploy` hangs on push | Check Docker daemon + network connectivity to SPCS registry |
| Service starts but 502 | Check `make logs-spcs` for app crash; usually missing env var |
| Network rule errors after deploy | Re-check `BKMNG_SNOWHOUSE_RULE` allowed hosts; SUSPEND + RESUME |

## Notes

- Never use the OAuth `snow` connection for deploy — errors with "user differs from access token". Use the dedicated `bkmng_deploy` PAT profile.
- After updating network rules: `make restart-service` to roll containers without rebuilding the image.
