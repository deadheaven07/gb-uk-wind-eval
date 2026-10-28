"""
Gridbricks / REint AI - UK Wind Decision Intelligence Platform
=============================================================

Main FastAPI Application Entrypoint.
Production-grade setup with CORS, health monitoring, and data pre-warming.
"""

from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.api.v1.routes import router as api_v1_router
from app.services.elexon_service import elexon_service

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s]: %(message)s"
)
logger = logging.getLogger("gridbricks.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Pre-warm dataset cache on startup to ensure instant UI responsiveness."""
    logger.info("Initializing Gridbricks REint AI Decision Platform...")
    try:
        df, status = elexon_service.get_aligned_data()
        logger.info(f"Pre-warmed dataset with {len(df)} settlement periods. Status: {status}")
    except Exception as e:
        logger.error(f"Error during data pre-warming: {e}")
    yield
    logger.info("Shutting down Gridbricks REint AI Decision Platform.")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Production-grade Decision Intelligence Platform for UK Wholesale Electricity Traders. "
        "Evaluates Day-Ahead Wind Forecast accuracy (Elexon BMRS) and calculates risk-buffered "
        "dispatchable thermal power procurement to prevent asymmetric imbalance penalties."
    ),
    lifespan=lifespan
)

# CORS middleware for seamless local Vite development and cloud deployments
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:[0-9]+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["Health"])
def health_check():
    """Health check endpoint for container orchestrators (Kubernetes / Docker Compose / Render)."""
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "market": "GB Balancing & Settlement Code (BSC)",
        "gateClosureRule": f"{settings.GATE_CLOSURE_HOUR_UTC:02d}:{settings.GATE_CLOSURE_MINUTE_UTC:02d} UTC D-1"
    }


@app.get("/", tags=["Root"])
def root():
    """Root redirect / information endpoint."""
    return {
        "platform": settings.APP_NAME,
        "docsUrl": "/docs",
        "apiPrefix": settings.API_V1_PREFIX,
        "evaluationWindow": "January 2026 (1,488 Half-Hour Settlement Periods)"
    }

