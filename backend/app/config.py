"""
Application configuration for Lexie Backend.

Uses environment variables for configuration, with ADK-specific settings
for Vertex AI integration.
"""

import os
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # Ignore extra env vars
    )
    
    # Google Cloud / ADK settings
    google_genai_use_vertexai: bool = Field(default=True, alias="GOOGLE_GENAI_USE_VERTEXAI")
    gcp_project_id: str = Field(default="lexie-489222", alias="GOOGLE_CLOUD_PROJECT")
    gcp_location: str = Field(default="us-central1", alias="GOOGLE_CLOUD_LOCATION")
    google_application_credentials: str = Field(
        default="./credentials/gcp-service-account.json",
        alias="GOOGLE_APPLICATION_CREDENTIALS"
    )
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True
    
    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    def setup_credentials(self) -> bool:
        """
        Set up Google Cloud credentials environment variable.
        
        ADK uses GOOGLE_APPLICATION_CREDENTIALS for service account auth
        when GOOGLE_GENAI_USE_VERTEXAI is True.
        """
        # Set Vertex AI flag
        os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = str(self.google_genai_use_vertexai).upper()
        os.environ["GOOGLE_CLOUD_PROJECT"] = self.gcp_project_id
        os.environ["GOOGLE_CLOUD_LOCATION"] = self.gcp_location
        
        # Set credentials path
        credentials_path = Path(__file__).parent.parent / self.google_application_credentials
        if credentials_path.exists():
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(credentials_path.resolve())
            return True
        return False


settings = Settings()
