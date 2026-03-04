"""Health check endpoints."""

from fastapi import APIRouter
from app.config import settings

router = APIRouter()


@router.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "service": "lexie-backend",
    }


@router.get("/health/ready")
async def readiness_check():
    """Readiness check - verifies all dependencies are available."""
    import os
    
    credentials_ok = os.path.exists(
        os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
    )
    
    return {
        "status": "ready" if credentials_ok else "not_ready",
        "checks": {
            "google_credentials": credentials_ok,
            "gemini_model": settings.gemini_model,
            "project_id": settings.gcp_project_id,
        }
    }
