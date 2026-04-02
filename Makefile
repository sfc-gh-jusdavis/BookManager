.PHONY: up down logs logs-backend logs-frontend rebuild shell-backend shell-frontend clean up-detach setup

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
