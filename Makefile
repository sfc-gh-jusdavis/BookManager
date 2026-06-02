.PHONY: up down logs logs-backend logs-frontend rebuild shell-backend shell-frontend clean up-detach setup test-spcs-build deploy logs-spcs restart-service sync-flags create-service-snowhouse deploy-snowhouse logs-snowhouse restart-snowhouse

SPCS_REGISTRY := sfsenorthamerica-jdavis-aws1.registry.snowflakecomputing.com
SPCS_IMAGE    := $(SPCS_REGISTRY)/bookmanager/demo/bkmng_repo/bkmng:latest
SPCS_SPEC     := bkmng-spec-demo.yaml
SPCS_SERVICE  := BOOKMANAGER.DEMO.BKMNG_SERVICE
SNOW_CONN     := bkmng_deploy

# Snowhouse SPCS deployment — uses SE_ENABLEMENT_POOL, SPCS token auth (no PAT)
SNOWHOUSE_REGISTRY := sfcogsops-snowhouse-aws-us-west-2.registry.snowflakecomputing.com
SNOWHOUSE_IMAGE    := $(SNOWHOUSE_REGISTRY)/temp/jusdavis/bkmng_repo/bkmng:latest
SNOWHOUSE_SPEC     := bkmng-spec-snowhouse.yaml
SNOWHOUSE_SERVICE  := TEMP.JUSDAVIS.BKMNG_SERVICE
SNOWHOUSE_CONN     := SNOWHOUSE_AWS_US_WEST_2
ENV_FILE      := backend/.env

# Load BKMNG_DEPLOY_PAT from .env into SNOWFLAKE_PASSWORD for snow CLI
DEPLOY_PAT = $(shell grep -E '^BKMNG_DEPLOY_PAT=' $(ENV_FILE) | cut -d= -f2-)

# First-time setup
setup:
	@cp -n .env.example .env 2>/dev/null || true
	@echo "Environment file ready. Run 'make up' to start the app."

# Start the app with logs visible
up: setup
	docker compose up --build

# Sync code-defined feature flag registry into Snowflake. Idempotent.
# Best-effort: warns and exits 0 if Snowflake creds aren't available.
sync-flags:
	@python3 scripts/sync_feature_flags.py || true

# Start the app in background
up-detach: setup sync-flags
	docker compose up --build -d

# Stop the app
down:
	docker compose down

# View all logs
logs:
	docker compose logs -f

# View backend logs only
logs-backend:
	docker compose logs -f backend

# View frontend logs only
logs-frontend:
	docker compose logs -f frontend

# Rebuild after dependency changes
rebuild:
	docker compose down
	docker compose up --build

# Open shell in backend container
shell-backend:
	docker compose exec backend /bin/bash

# Open shell in frontend container
shell-frontend:
	docker compose exec frontend /bin/sh

# Full reset — remove containers, volumes, and rebuild
clean:
	docker compose down -v --rmi local
	@echo "Cleaned. Run 'make up' to start fresh."

# Build the SPCS production image locally (no push)
test-spcs-build:
	@echo "Building SPCS image locally (linux/amd64)..."
	docker build --platform linux/amd64 -f Dockerfile.spcs -t bkmng:spcs-test .
	@echo "SPCS build succeeded."

# Build, push, and update SPCS service. Auth via PAT (no interactive SSO needed).
deploy: test-spcs-build sync-flags
	@if [ -z "$(DEPLOY_PAT)" ]; then echo "ERROR: BKMNG_DEPLOY_PAT not set in $(ENV_FILE). See AGENTS.md for PAT setup."; exit 1; fi
	@echo "Logging in to SPCS image registry..."
	SNOWFLAKE_PASSWORD='$(DEPLOY_PAT)' snow spcs image-registry login --connection $(SNOW_CONN)
	@echo "Tagging and pushing image..."
	docker tag bkmng:spcs-test $(SPCS_IMAGE)
	docker push $(SPCS_IMAGE)
	@echo "Updating SPCS service..."
	SNOWFLAKE_PASSWORD='$(DEPLOY_PAT)' snow sql -c $(SNOW_CONN) -q "ALTER SERVICE $(SPCS_SERVICE) FROM SPECIFICATION \$$\$$$$(cat $(SPCS_SPEC))\$$\$$"
	@echo "Deployed: https://ar7vvu-sfsenorthamerica-jdavis-aws1.snowflakecomputing.app"

# Force a container roll without pushing a new image (e.g. after spec/secret changes)
restart-service:
	@if [ -z "$(DEPLOY_PAT)" ]; then echo "ERROR: BKMNG_DEPLOY_PAT not set in $(ENV_FILE)."; exit 1; fi
	SNOWFLAKE_PASSWORD='$(DEPLOY_PAT)' snow sql -c $(SNOW_CONN) -q "ALTER SERVICE $(SPCS_SERVICE) SUSPEND;"
	SNOWFLAKE_PASSWORD='$(DEPLOY_PAT)' snow sql -c $(SNOW_CONN) -q "ALTER SERVICE $(SPCS_SERVICE) RESUME;"
	@echo "Service restarted."

# Tail SPCS container logs (last 200 lines from bkmng container)
logs-spcs:
	@if [ -z "$(DEPLOY_PAT)" ]; then echo "ERROR: BKMNG_DEPLOY_PAT not set in $(ENV_FILE)."; exit 1; fi
	SNOWFLAKE_PASSWORD='$(DEPLOY_PAT)' snow sql -c $(SNOW_CONN) -q "SELECT SYSTEM\$$GET_SERVICE_LOGS('$(SPCS_SERVICE)', '0', 'bkmng', 200);"

# Run pipeline health check + inventory snapshot. Uses SNOWHOUSE_AWS_US_WEST_2 (TEMP.JUSDAVIS).
# See snowflake/PIPELINE.md for full pipeline reference.
pipeline-status:
	@echo "=== Pipeline Health Check ==="
	@snow sql -c SNOWHOUSE_AWS_US_WEST_2 -q "USE WAREHOUSE SE_XS_WH; CALL TEMP.JUSDAVIS.SP_BKMNG_PIPELINE_HEALTH_CHECK();"
	@echo ""
	@echo "=== Pipeline Task Inventory ==="
	@snow sql -c SNOWHOUSE_AWS_US_WEST_2 -q "USE WAREHOUSE SE_XS_WH; CALL TEMP.JUSDAVIS.SP_BKMNG_PIPELINE_INVENTORY();"

# Deploy the BKMNG_PIPELINE_MONITOR Streamlit-in-Snowflake app from snowflake/streamlit/pipeline_monitor/
deploy-pipeline-monitor:
	@cd snowflake/streamlit/pipeline_monitor && \
	  snow sql -c SNOWHOUSE_AWS_US_WEST_2 -q "PUT file://$$PWD/streamlit_app.py @TEMP.JUSDAVIS.BKMNG_STREAMLIT_STAGE/pipeline_monitor/ AUTO_COMPRESS=FALSE OVERWRITE=TRUE;" && \
	  snow sql -c SNOWHOUSE_AWS_US_WEST_2 -q "PUT file://$$PWD/environment.yml @TEMP.JUSDAVIS.BKMNG_STREAMLIT_STAGE/pipeline_monitor/ AUTO_COMPRESS=FALSE OVERWRITE=TRUE;"
	@echo "Pipeline monitor source uploaded. Refresh the SiS app in Snowsight to pick up changes."

# ─── Snowhouse SPCS targets ────────────────────────────────────────────────────
# Registry login opens a browser (externalbrowser SSO) — run on the host Mac.

# One-time: build, push, and CREATE the Snowhouse service. Run once, then use deploy-snowhouse.
create-service-snowhouse: test-spcs-build
	@echo "Logging in to Snowhouse image registry (browser will open)..."
	snow spcs image-registry login --connection $(SNOWHOUSE_CONN)
	docker tag bkmng:spcs-test $(SNOWHOUSE_IMAGE)
	docker push $(SNOWHOUSE_IMAGE)
	@echo "Creating Snowhouse SPCS service..."
	snow sql -c $(SNOWHOUSE_CONN) -q "CREATE SERVICE IF NOT EXISTS $(SNOWHOUSE_SERVICE) IN COMPUTE POOL SE_ENABLEMENT_POOL FROM SPECIFICATION \$$\$$$$(cat $(SNOWHOUSE_SPEC))\$$\$$ MIN_INSTANCES=1 MAX_INSTANCES=1;"
	@echo "Endpoint URL:"
	snow sql -c $(SNOWHOUSE_CONN) -q "SHOW ENDPOINTS IN SERVICE $(SNOWHOUSE_SERVICE);"

# Ongoing: build, push, and ALTER the Snowhouse service spec.
deploy-snowhouse: test-spcs-build sync-flags
	@echo "Logging in to Snowhouse image registry (browser will open)..."
	snow spcs image-registry login --connection $(SNOWHOUSE_CONN)
	docker tag bkmng:spcs-test $(SNOWHOUSE_IMAGE)
	docker push $(SNOWHOUSE_IMAGE)
	@echo "Updating Snowhouse SPCS service..."
	snow sql -c $(SNOWHOUSE_CONN) -q "ALTER SERVICE $(SNOWHOUSE_SERVICE) FROM SPECIFICATION \$$\$$$$(cat $(SNOWHOUSE_SPEC))\$$\$$"
	@echo "Deployed. Check endpoint with: make logs-snowhouse"

# Tail container logs from Snowhouse SPCS.
logs-snowhouse:
	snow sql -c $(SNOWHOUSE_CONN) -q "SELECT SYSTEM\$$GET_SERVICE_LOGS('$(SNOWHOUSE_SERVICE)', '0', 'bkmng', 200);"

# Suspend + resume without pushing a new image (e.g. after spec changes).
restart-snowhouse:
	snow sql -c $(SNOWHOUSE_CONN) -q "ALTER SERVICE $(SNOWHOUSE_SERVICE) SUSPEND;"
	snow sql -c $(SNOWHOUSE_CONN) -q "ALTER SERVICE $(SNOWHOUSE_SERVICE) RESUME;"
	@echo "Snowhouse service restarted."
