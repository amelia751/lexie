"""
Gemini Live API Service using Google ADK

Uses the Agent Development Kit (ADK) for bidirectional streaming with
the Gemini Live API. Supports real-time voice conversations with
interruption handling.

Based on: https://google.github.io/adk-docs/get-started/streaming/quickstart-streaming/
"""

import asyncio
import base64
import json
import logging
from typing import Optional, AsyncGenerator
from contextlib import asynccontextmanager

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.agents import LiveRequestQueue
from google.genai import types

from app.agents import root_agent
from app.agents.intake_agent import LIVE_MODEL, CHAT_MODEL
from app.config import settings

logger = logging.getLogger(__name__)


class GeminiLiveService:
    """
    Service for managing Gemini Live API sessions using ADK.
    
    Uses ADK's LiveRequestQueue for upstream messages and run_live() for
    bidirectional streaming with the Gemini Live API.
    """
    
    def __init__(self):
        self.session_service = InMemorySessionService()
        self.active_sessions: dict[str, dict] = {}
        
    def get_session_info(self) -> dict:
        """Get information about the Gemini Live configuration."""
        return {
            "chat_model": CHAT_MODEL,
            "live_model": LIVE_MODEL,
            "agent_name": root_agent.name,
            "project": settings.gcp_project_id,
            "location": settings.gcp_location,
            "capabilities": [
                "text_input",
                "text_output", 
                "audio_input",
                "audio_output",
                "video_input",
                "real_time_streaming",
                "interruption",
                "tool_calling",
                "google_search",
            ],
            "audio_config": {
                "input_format": "audio/pcm",
                "input_sample_rate": 16000,
                "output_format": "audio/pcm",
                "output_sample_rate": 24000,
                "channels": 1,
            },
        }
    
    async def test_connection(self) -> dict:
        """Test the ADK agent configuration."""
        try:
            # Just verify the agent is configured correctly
            return {
                "status": "configured",
                "agent": root_agent.name,
                "model": root_agent.model,
                "description": root_agent.description,
                "tools": [t.__name__ if hasattr(t, '__name__') else str(t) for t in (root_agent.tools or [])],
            }
        except Exception as e:
            logger.error(f"Configuration test failed: {e}")
            return {
                "status": "error",
                "error": str(e),
            }
    
    async def chat(self, message: str, history: list = None) -> str:
        """
        Simple text chat (non-streaming) for testing.
        
        Note: For full streaming, use run_live_session().
        """
        try:
            # Create a runner for non-streaming chat
            runner = Runner(
                agent=root_agent,
                app_name="lexie_chat",
                session_service=self.session_service,
            )
            
            # Create or get session
            session = await self.session_service.create_session(
                app_name="lexie_chat",
                user_id="test_user",
            )
            
            # Run the agent
            response_text = ""
            async for event in runner.run_async(
                user_id="test_user",
                session_id=session.id,
                new_message=types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=message)]
                ),
            ):
                if event.is_final_response() and event.content:
                    for part in event.content.parts:
                        if part.text:
                            response_text += part.text
            
            return response_text
            
        except Exception as e:
            logger.error(f"Chat error: {e}")
            raise
    
    @asynccontextmanager
    async def create_live_session(self, client_id: str):
        """
        Create a live streaming session for a client.
        
        Yields:
            tuple: (runner, session, live_request_queue)
        """
        try:
            # Create runner with the intake agent
            runner = Runner(
                agent=root_agent,
                app_name="lexie_live",
                session_service=self.session_service,
            )
            
            # Create session for this client
            session = await self.session_service.create_session(
                app_name="lexie_live",
                user_id=client_id,
            )
            
            # Create the LiveRequestQueue for sending messages to Gemini
            live_request_queue = LiveRequestQueue()
            
            # Store session info
            self.active_sessions[client_id] = {
                "runner": runner,
                "session": session,
                "queue": live_request_queue,
            }
            
            logger.info(f"Created live session for client: {client_id}")
            
            yield runner, session, live_request_queue
            
        finally:
            # Cleanup
            if client_id in self.active_sessions:
                del self.active_sessions[client_id]
            logger.info(f"Closed live session for client: {client_id}")
    
    async def run_live_session(self, websocket, client_id: str):
        """
        Run a full live streaming session.
        
        This bridges the client WebSocket to Gemini Live API using ADK.
        Handles bidirectional audio/text streaming with interruption support.
        
        Args:
            websocket: FastAPI WebSocket connection
            client_id: Unique identifier for this client
        """
        async with self.create_live_session(client_id) as (runner, session, live_request_queue):
            try:
                # Configure run for live streaming
                run_config = types.RunConfig(
                    response_modalities=["AUDIO", "TEXT"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                voice_name="Puck",  # Friendly, professional voice
                            )
                        )
                    ),
                )
                
                # Task to receive from client and send to Gemini
                async def receive_from_client():
                    """Receive audio/text from WebSocket and queue to Gemini."""
                    try:
                        while True:
                            data = await websocket.receive()
                            
                            if "bytes" in data:
                                # Raw PCM audio from client
                                audio_bytes = data["bytes"]
                                # Send audio to Gemini via LiveRequestQueue
                                live_request_queue.send_realtime(
                                    types.Blob(
                                        mime_type="audio/pcm;rate=16000",
                                        data=audio_bytes,
                                    )
                                )
                                
                            elif "text" in data:
                                # JSON message from client
                                msg = json.loads(data["text"])
                                msg_type = msg.get("type")
                                
                                if msg_type == "text":
                                    # Text message
                                    content = msg.get("content", "")
                                    live_request_queue.send_content(
                                        types.Content(
                                            role="user",
                                            parts=[types.Part.from_text(text=content)]
                                        )
                                    )
                                    
                                elif msg_type == "audio":
                                    # Base64 encoded audio
                                    audio_b64 = msg.get("data", "")
                                    audio_bytes = base64.b64decode(audio_b64)
                                    live_request_queue.send_realtime(
                                        types.Blob(
                                            mime_type="audio/pcm;rate=16000",
                                            data=audio_bytes,
                                        )
                                    )
                                    
                                elif msg_type == "end_turn":
                                    # User finished speaking
                                    live_request_queue.send_realtime(
                                        types.LiveClientRealtimeInput(
                                            turn_complete=True
                                        )
                                    )
                                    
                                elif msg_type == "end":
                                    # End the session
                                    live_request_queue.close()
                                    return
                                    
                    except Exception as e:
                        logger.error(f"Error receiving from client {client_id}: {e}")
                        live_request_queue.close()
                        raise
                
                # Task to receive from Gemini and send to client
                async def send_to_client():
                    """Process events from run_live() and send to client."""
                    try:
                        async for event in runner.run_live(
                            session=session,
                            live_request_queue=live_request_queue,
                            run_config=run_config,
                        ):
                            # Handle different event types
                            if event.server_content:
                                content = event.server_content
                                
                                # Model's turn with audio/text
                                if content.model_turn and content.model_turn.parts:
                                    for part in content.model_turn.parts:
                                        if part.inline_data:
                                            # Audio output - send as binary
                                            await websocket.send_bytes(
                                                part.inline_data.data
                                            )
                                        elif part.text:
                                            # Text/transcript output
                                            await websocket.send_json({
                                                "type": "transcript",
                                                "role": "assistant",
                                                "content": part.text,
                                            })
                                
                                # Turn complete notification
                                if content.turn_complete:
                                    await websocket.send_json({
                                        "type": "turn_complete",
                                    })
                                
                                # Interrupted by user
                                if content.interrupted:
                                    await websocket.send_json({
                                        "type": "interrupted",
                                    })
                            
                            # Tool call events (Google Search, etc.)
                            if event.actions and event.actions.tool_code_execution:
                                await websocket.send_json({
                                    "type": "tool_call",
                                    "content": "Searching for information...",
                                })
                            
                            # User speech transcription
                            if hasattr(event, 'user_content') and event.user_content:
                                for part in event.user_content.parts:
                                    if part.text:
                                        await websocket.send_json({
                                            "type": "transcript",
                                            "role": "user",
                                            "content": part.text,
                                        })
                                        
                    except Exception as e:
                        logger.error(f"Error in send_to_client for {client_id}: {e}")
                        raise
                
                # Send initial greeting
                await websocket.send_json({
                    "type": "status",
                    "content": "connected",
                    "message": "Connected to Lexie. I'm ready to help with your intake.",
                    "config": self.get_session_info()["audio_config"],
                })
                
                # Run both tasks concurrently
                receive_task = asyncio.create_task(receive_from_client())
                send_task = asyncio.create_task(send_to_client())
                
                try:
                    # Wait for either task to complete (usually receive_task on disconnect)
                    done, pending = await asyncio.wait(
                        [receive_task, send_task],
                        return_when=asyncio.FIRST_COMPLETED,
                    )
                    
                    # Cancel remaining tasks
                    for task in pending:
                        task.cancel()
                        try:
                            await task
                        except asyncio.CancelledError:
                            pass
                            
                except Exception as e:
                    logger.error(f"Session error for {client_id}: {e}")
                    receive_task.cancel()
                    send_task.cancel()
                    raise
                    
            except Exception as e:
                logger.error(f"Live session error for {client_id}: {e}")
                try:
                    await websocket.send_json({
                        "type": "error",
                        "content": str(e),
                    })
                except:
                    pass
                raise


# Singleton instance
gemini_service = GeminiLiveService()
