from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware

from app.config import settings
from app.routers import accounts, auth, forecasts, tmr, misc, credit_series, admin, agent, nba, alerts, assessments, user

app = FastAPI(
    title="BookManager API",
    description="Account book management and forecasting",
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(forecasts.router)
app.include_router(tmr.router)
app.include_router(misc.router)
app.include_router(credit_series.router)
app.include_router(admin.router)
app.include_router(agent.router)
app.include_router(nba.router)
app.include_router(alerts.router)
app.include_router(assessments.router)
app.include_router(user.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "healthy"}


@app.get("/")
async def root() -> dict[str, str]:
    return {"status": "ok", "app": "BookManager"}
