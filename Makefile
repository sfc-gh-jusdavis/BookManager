.PHONY: up down logs logs-backend logs-frontend rebuild shell-backend shell-frontend clean up-detach setup test-spcs-build deploy

SPCS_REGISTRY := sfsenorthamerica-jdavis-aws1.registry.snowflakecomputing.com
SPCS_IMAGE    := $(SPCS_REGISTRY)/bookmanager/demo/bkmng_repo/bkmng:latest
SPCS_SPEC     := bkmng-spec-demo.yaml
SNOW_CONN     := JDAVIS_AWS1

# First-time setup
setup:
	@cp -n .env.example .env 2>/dev/null || true
	@echo "Environment file ready. Run 'make up' to start the app."

# Start the app with logs visible
up: setup
	docker compose up --build

# Start the app in background
up-detach: setup
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

# Build, push, and update SPCS service
deploy: test-spcs-build
	@echo "Tagging and pushing to SPCS registry..."
	docker tag bkmng:spcs-test $(SPCS_IMAGE)
	docker push $(SPCS_IMAGE)
	@echo "Image pushed. Updating SPCS service..."
	snow sql -c $(SNOW_CONN) -q "ALTER SERVICE BOOKMANAGER.DEMO.BKMNG_SERVICE FROM SPECIFICATION \$$\$$$$(cat $(SPCS_SPEC))\$$\$$"
	@echo "Service updated: https://ar7vvu-sfsenorthamerica-jdavis-aws1.snowflakecomputing.app"
