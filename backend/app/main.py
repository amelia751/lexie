"""
Lexie Backend - Gemini Live API Integration with ADK

This FastAPI application provides WebSocket endpoints for real-time
voice conversations using Google's ADK (Agent Development Kit) and
Gemini Live API.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

# Configure logging early
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Setup credentials before importing anything that uses them
settings.setup_credentials()

# Now import routers (which may use ADK)
from app.routers import gemini_live, health, intake


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown events."""
    # Startup
    logger.info("Starting Lexie Backend with ADK...")
    logger.info(f"✓ Vertex AI enabled: {settings.google_genai_use_vertexai}")
    logger.info(f"✓ Project ID: {settings.gcp_project_id}")
    logger.info(f"✓ Location: {settings.gcp_location}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Lexie Backend...")


# Create FastAPI app
app = FastAPI(
    title="Lexie - Legal AI Assistant",
    description="Real-time voice conversation backend powered by ADK and Gemini Live API",
    version="0.2.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins + ["*"],  # Allow all for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(gemini_live.router, prefix="/api/v1", tags=["Gemini Live"])
app.include_router(intake.router, prefix="/api/v1", tags=["Intake"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "Lexie Backend",
        "version": "0.2.0",
        "status": "running",
        "framework": "Google ADK",
        "project": settings.gcp_project_id,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
