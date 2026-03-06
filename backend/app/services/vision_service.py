"""
Vision Service

Handles image analysis using Gemini Vision (gemini-2.5-flash-image).
"""

import base64
from pathlib import Path
from typing import Optional

from google import genai
from google.genai import types

from app.config import settings

# Vision model
VISION_MODEL = "gemini-2.5-flash-image"


class VisionService:
    """Service for analyzing images using Gemini Vision."""
    
    def __init__(self):
        self._client: Optional[genai.Client] = None
    
    @property
    def client(self) -> genai.Client:
        """Lazy-initialize the Gemini client."""
        if self._client is None:
            settings.setup_credentials()
            self._client = genai.Client(
                vertexai=True,
                project=settings.gcp_project_id,
                location="us-central1"
            )
        return self._client
    
    def analyze(
        self,
        image_path: str,
        prompt: str = "Describe what you see in this image.",
        mime_type: Optional[str] = None
    ) -> str:
        """
        Analyze an image with a prompt.
        
        Args:
            image_path: Path to the image file
            prompt: What to analyze (agent provides context)
            mime_type: Optional mime type (auto-detected if not provided)
            
        Returns:
            Analysis text from the model
        """
        path = Path(image_path)
        
        if not path.exists():
            raise FileNotFoundError(f"Image not found: {path}")
        
        # Load image as base64
        with open(path, "rb") as f:
            image_data = base64.b64encode(f.read()).decode("utf-8")
        
        # Auto-detect mime type
        if mime_type is None:
            mime_types = {
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".gif": "image/gif",
                ".webp": "image/webp"
            }
            mime_type = mime_types.get(path.suffix.lower(), "image/png")
        
        # Call Gemini Vision
        response = self.client.models.generate_content(
            model=VISION_MODEL,
            contents=[
                types.Part.from_text(text=prompt),
                types.Part.from_bytes(
                    data=base64.b64decode(image_data),
                    mime_type=mime_type
                ),
            ],
        )
        
        return response.text


# Singleton instance
vision_service = VisionService()

__all__ = ["VisionService", "vision_service", "VISION_MODEL"]
