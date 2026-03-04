#!/usr/bin/env python3
"""
Run the Lexie backend server.
"""
import uvicorn
from app.config import settings

if __name__ == "__main__":
    print(f"""
    ╔═══════════════════════════════════════════════════╗
    ║           LEXIE - Legal AI Assistant              ║
    ║         Powered by Gemini Live API                ║
    ╠═══════════════════════════════════════════════════╣
    ║  Server:  http://{settings.host}:{settings.port}              ║
    ║  Model:   {settings.gemini_model}                  ║
    ║  Project: {settings.gcp_project_id}                       ║
    ╚═══════════════════════════════════════════════════╝
    """)
    
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="debug" if settings.debug else "info",
    )
