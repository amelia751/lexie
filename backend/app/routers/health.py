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
    
    # On Cloud Run, ADC works via metadata server (no file needed)
    adc_available = credentials_ok or os.environ.get("K_SERVICE")  # K_SERVICE is set on Cloud Run
    
    return {
        "status": "ready" if adc_available else "not_ready",
        "checks": {
            "google_credentials": credentials_ok,
            "cloud_run_adc": bool(os.environ.get("K_SERVICE")),
            "project_id": settings.gcp_project_id,
        }
    }
