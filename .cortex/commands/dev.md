Start the local development environment with Docker Compose.

Steps:
1. Run `make up-detach` (or `./dev-start.sh` which also opens Docker Desktop if needed)
2. Wait for containers to be healthy: `make status`
3. Verify backend: `curl -s http://localhost:8000/health/ready`
4. Verify frontend: open http://localhost:3001

If containers fail to start:
- Check `make logs` for errors
- If `sh: next: not found` → `make clean && make up` (stale node_modules volume)
- If ECONNREFUSED on API calls → check `INTERNAL_API_URL=http://backend:8000` in docker-compose.yml

To stop: `make down`
To full reset: `make clean && make up`
