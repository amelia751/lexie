"""
Gemini Live WebSocket Router

Handles WebSocket connections for real-time voice conversations
with the Gemini Multimodal Live API.

Based on: https://github.com/GoogleCloudPlatform/generative-ai/tree/main/gemini/multimodal-live-api
"""

import asyncio
import base64
import json
import logging
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel

from app.services.gemini_live_service import gemini_service

logger = logging.getLogger(__name__)

router = APIRouter()


class TextMessage(BaseModel):
    """Text message request model."""
    text: str
    history: list = []


class ConnectionManager:
    """Manages active WebSocket connections."""
    
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str):
        """Accept a new WebSocket connection."""
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"Client {client_id} connected")
    
    async def disconnect(self, client_id: str):
        """Handle client disconnection."""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        logger.info(f"Client {client_id} disconnected")
    
    async def send_json(self, client_id: str, data: dict):
        """Send JSON to a specific client."""
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_json(data)
    
    async def send_bytes(self, client_id: str, data: bytes):
        """Send bytes to a specific client."""
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_bytes(data)


# Global connection manager
manager = ConnectionManager()


@router.websocket("/gemini-live/{client_id}")
async def gemini_live_websocket(websocket: WebSocket, client_id: str):
    """
    WebSocket endpoint for Gemini Live conversations.
    
    This connects directly to the Gemini Multimodal Live API for
    real-time bidirectional audio streaming.
    
    Audio Format:
    - Input: 16-bit PCM, 16kHz, mono
    - Output: 16-bit PCM, 24kHz, mono
    
    Message Protocol:
    
    Client -> Server (binary):
    - Raw PCM audio bytes
    
    Client -> Server (text/JSON):
    - {"type": "text", "content": "<text_message>"}
    - {"type": "end_turn"} - Signal end of user's turn
    - {"type": "end"} - End session
    
    Server -> Client (binary):
    - Raw PCM audio bytes (Gemini's voice response)
    
    Server -> Client (text/JSON):
    - {"type": "transcript", "content": "<text>"}
    - {"type": "turn_complete"}
    - {"type": "status", "content": "<status>"}
    - {"type": "error", "content": "<error>"}
    """
    await manager.connect(websocket, client_id)
    
    # Send welcome status
    await manager.send_json(client_id, {
        "type": "status",
        "content": "connected",
        "message": "Connected",
        "audio_config": {
            "input_sample_rate": 16000,
            "output_sample_rate": 24000,
            "format": "pcm_s16le",
        }
    })
    
    try:
        # Run the live session - this handles all bidirectional streaming
        await gemini_service.run_live_session(websocket, client_id)
        
    except WebSocketDisconnect:
        logger.info(f"Client {client_id} disconnected")
    except Exception as e:
        logger.error(f"Error in WebSocket handler for {client_id}: {e}")
        try:
            await manager.send_json(client_id, {
                "type": "error",
                "content": str(e)
            })
        except:
            pass  # Client may already be disconnected
    finally:
        await manager.disconnect(client_id)


@router.post("/chat")
async def chat_endpoint(message: TextMessage):
    """
    Simple HTTP endpoint for text-based chat (non-streaming).
    Useful for testing or simple integrations.
    
    This does NOT use the Live API - just standard Gemini chat.
    """
    try:
        response = await gemini_service.chat(message.text, message.history)
        
        return {
            "response": response,
            "model": gemini_service.get_session_info()["chat_model"],
        }
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/test-connection")
async def test_connection():
    """
    Test the Gemini API connection.
    
    Returns connection status and a test response from the model.
    """
    try:
        result = await gemini_service.test_connection()
        return result
    except Exception as e:
        logger.error(f"Connection test error: {e}")
        return {
            "status": "error",
            "error": str(e),
        }


@router.get("/session/info")
async def session_info():
    """Get information about the Gemini Live configuration."""
    info = gemini_service.get_session_info()
    info["active_connections"] = len(manager.active_connections)
    return info
