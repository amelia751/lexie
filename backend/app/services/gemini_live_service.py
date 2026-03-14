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

from google.adk.runners import Runner, RunConfig
from google.adk.sessions import InMemorySessionService
from google.adk.agents import LiveRequestQueue
from google.genai import types
from google.genai.types import (
    SpeechConfig, 
    VoiceConfig, 
    PrebuiltVoiceConfig,
)

from app.agents import root_agent, live_agent
from app.agents.live_agent import LIVE_MODEL, CHAT_MODEL
from app.services.evidence_hub import evidence_hub
from app.config import settings

logger = logging.getLogger(__name__)


def get_live_data_snapshot() -> dict:
    """Get current state of all live data from evidence hub."""
    facts = evidence_hub.get_facts()
    checklist = evidence_hub.checklist
    
    # Extract nested facts safely
    plaintiff = facts.get("plaintiff", {})
    employer = facts.get("employer", {})
    incident = facts.get("incident", {})
    injuries = facts.get("injuries", {})
    medical = facts.get("medical", {})
    employment = facts.get("employment_impact", {})
    witnesses = facts.get("witnesses", [])
    safety = facts.get("safety", {})
    insurance = facts.get("insurance", {})
    damages = facts.get("damages", {})
    
    # Build evidence items list
    evidence_items = []
    for item in checklist:
        evidence_items.append({
            "id": item.id,
            "type": item.type,
            "description": item.description,
            "status": item.status.value,
            "priority": item.priority.value,
        })
    
    # Build timeline from facts - include source document for provenance
    # source_files maps category -> frontend file ID for click-to-highlight
    source_files = facts.get("source_files", {})
    
    timeline_events = []
    if incident.get("date"):
        timeline_events.append({
            "id": "incident-1",
            "date": incident.get("date", "Unknown"),
            "event": "Workplace Injury",
            "description": incident.get("description", ""),
            "category": "incident",
            "source": "Incident Report",
            "sourceFileId": source_files.get("incident"),  # Links to file in explorer
        })
    
    # Build medical records
    medical_records = []
    medical_expense = medical.get("expenses")
    if medical_expense:
        timeline_events.append({
            "id": "medical-1",
            "date": incident.get("date", "Unknown"),
            "event": "Medical Treatment",
            "description": f"Medical expenses: ${medical_expense:,}",
            "category": "medical",
            "source": "Medical Records",
            "sourceFileId": source_files.get("medical"),  # Links to file in explorer
        })
        medical_records.append({
            "id": "medical-1",
            "date": incident.get("date", "Unknown"),
            "provider": "Medical Treatment",
            "service": "Total Medical Expenses",
            "amount": medical_expense,
        })
    
    # Build damages estimate
    damages_estimate = {}
    if damages.get("total_estimate"):
        settlement = damages.get("settlement_range", {})
        damages_estimate = {
            "pastMedical": medical.get("expenses"),
            "futureMedical": medical.get("future_estimate"),
            "lostWages": employment.get("lost_wages"),
            "settlementLow": settlement.get("low"),
            "settlementHigh": settlement.get("high"),
        }
    
    # Get the currently requested document (if any)
    current_request = evidence_hub.get_currently_requested()
    current_doc_request = None
    if current_request:
        current_doc_request = {
            "id": current_request.id,
            "type": current_request.type,
            "description": current_request.description,
            "priority": current_request.priority.value,
        }
    
    return {
        "caseFacts": {
            "plaintiffName": plaintiff.get("name"),
            "plaintiffAge": plaintiff.get("age"),
            "plaintiffOccupation": plaintiff.get("occupation"),
            "employerName": employer.get("name"),
            "incidentDate": incident.get("date"),
            "incidentLocation": incident.get("location"),
            "incidentDescription": incident.get("description"),
            "incidentType": incident.get("type"),
            "caseType": evidence_hub._case_type,
            "injuries": injuries.get("list", []),
            "injurySeverity": injuries.get("severity"),
            "medicalExpenses": medical.get("expenses"),
            "daysMissedWork": employment.get("days_missed"),
            "lostWages": employment.get("lost_wages"),
            "witnesses": witnesses,
            "safetyViolations": safety.get("violations", []),
            "workersCompFiled": insurance.get("workers_comp_filed"),
        },
        "evidenceItems": evidence_items,
        "timelineEvents": timeline_events,
        "medicalRecords": medical_records,
        "damagesEstimate": damages_estimate,
        "checklistStatus": evidence_hub.get_checklist_status(),
        "currentDocumentRequest": current_doc_request,  # Document being requested (shows UI card)
    }


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
            # Create runner with the LIVE agent (uses live-capable model)
            runner = Runner(
                agent=live_agent,
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
            
            # Reset evidence hub for new session
            evidence_hub.reset()
            
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
                # Configure run for live streaming with ADK RunConfig
                # Note: Live API only allows ONE response modality
                # We use AUDIO and enable transcription for text
                run_config = RunConfig(
                    response_modalities=["AUDIO"],  # Voice output only
                    speech_config=SpeechConfig(
                        voice_config=VoiceConfig(
                            prebuilt_voice_config=PrebuiltVoiceConfig(
                                voice_name="Puck",  # Friendly, professional voice
                            )
                        ),
                    ),
                    # Enable transcription for both input and output
                    output_audio_transcription=types.AudioTranscriptionConfig(),
                    input_audio_transcription=types.AudioTranscriptionConfig(),
                    # Note: realtime_input_config not supported in RunConfig
                    # Interruption handling is done via ADK's built-in mechanisms
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
                                    # Text message - increment message counter
                                    turn_state["user_msg_count"] += 1
                                    content = msg.get("content", "")
                                    
                                    # INTERCEPT: Detect [DOCUMENT UPLOADED] and auto-process
                                    if content.startswith("[DOCUMENT UPLOADED]"):
                                        logger.info(f"[INTERCEPT] Document upload detected")
                                        
                                        # Extract file IDs from the message for source tracking
                                        import re
                                        file_ids_match = re.search(r'\[FILE_IDS:\s*([^\]]+)\]', content)
                                        file_ids = []
                                        current_item = evidence_hub.get_currently_requested()
                                        doc_type = current_item.type if current_item else "document"
                                        
                                        if file_ids_match:
                                            file_ids = [fid.strip() for fid in file_ids_match.group(1).split(',')]
                                            logger.info(f"[INTERCEPT] Extracted file IDs: {file_ids}")
                                            
                                            if current_item and file_ids:
                                                # Determine category and store file ID for provenance
                                                category = "incident"
                                                if "medical" in current_item.id.lower():
                                                    category = "medical"
                                                elif "incident" in current_item.id.lower():
                                                    category = "incident"
                                                elif "insurance" in current_item.id.lower():
                                                    category = "insurance"
                                                
                                                evidence_hub.facts.source_files[category] = file_ids[0]
                                                logger.info(f"[INTERCEPT] Stored source file: {category} -> {file_ids[0]}")
                                        
                                        # Call evidence_agent to actually analyze the document!
                                        from app.agents.evidence_agent import analyze_case_evidence
                                        analysis_result = None
                                        try:
                                            aspect = "injuries" if "medical" in doc_type else "timeline"
                                            analysis_result = analyze_case_evidence(aspect)
                                            logger.info(f"[INTERCEPT] Evidence analysis result: {analysis_result.get('status')}")
                                        except Exception as e:
                                            logger.warning(f"[INTERCEPT] Evidence analysis failed: {e}")
                                        
                                        # Mark evidence as uploaded
                                        from app.agents.live_agent import handle_evidence_response
                                        result = handle_evidence_response(has_document=True, document_uploaded=True)
                                        logger.info(f"[INTERCEPT] handle_evidence_response result: {result}")
                                        
                                        # Send notification to frontend
                                        await websocket.send_json({
                                            "type": "tool_call",
                                            "content": "Analyzing document with Evidence Agent...",
                                            "tool": "evidence_agent.analyze_case_evidence",
                                            "args": {"document_type": doc_type},
                                        })
                                        
                                        # Note: Don't send live_update here - agent's subsequent
                                        # tool calls will trigger it with deduplication
                                        
                                        # Build analysis summary for the agent
                                        analysis_summary = ""
                                        if analysis_result and analysis_result.get("status") == "success":
                                            analysis_summary = f"\n\nEvidence Agent Analysis:\n{analysis_result.get('analysis', 'No details available.')}"
                                        
                                        # Tell the agent to use the analysis results
                                        content = f"User uploaded {doc_type}. Evidence Agent has analyzed it.{analysis_summary}\n\nDO NOT call handle_evidence_response again (already processed). Summarize the findings and ask if details are correct."
                                    
                                    live_request_queue.send_content(
                                        types.Content(
                                            role="user",
                                            parts=[types.Part.from_text(text=content)]
                                        )
                                    )
                                    
                                elif msg_type == "audio":
                                    # Audio input - increment message counter
                                    turn_state["user_msg_count"] += 1
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
                
                # Track previous state for change detection
                prev_state = get_live_data_snapshot()
                
                # Shared state for turn_complete and response deduplication
                # Using a dict so it's mutable and shared between async tasks
                turn_state = {
                    "user_msg_count": 0,  # Incremented when user sends message
                    "last_turn_sent": -1,  # Which msg's turn_complete we've sent
                    "response_for_msg": -1,  # Which msg we've started responding to
                    "response_text_sent": "",  # Track what text we've already sent
                    "last_state_hash": "",  # For deduplicating live_updates
                }
                
                def get_state_hash(state: dict) -> str:
                    """Get a simple hash of state to detect changes."""
                    import hashlib
                    # Only hash key fields that change
                    evidence_status = tuple(
                        (e.get('id'), e.get('status')) 
                        for e in state.get('evidenceItems', [])
                    )
                    doc_req = state.get('currentDocumentRequest')
                    doc_req_id = doc_req.get('id') if doc_req else None
                    facts = state.get('caseFacts', {})
                    # Create hashable representation
                    key = (
                        evidence_status,
                        doc_req_id,
                        facts.get('incidentDate'),
                        facts.get('employerName'),
                        str(facts.get('injuries', [])),
                        facts.get('medicalExpenses'),
                    )
                    return hashlib.md5(str(key).encode()).hexdigest()[:8]
                
                async def send_live_update_if_changed():
                    """Send live_update only if state has changed."""
                    new_state = get_live_data_snapshot()
                    new_hash = get_state_hash(new_state)
                    if new_hash != turn_state["last_state_hash"]:
                        turn_state["last_state_hash"] = new_hash
                        await websocket.send_json({
                            "type": "live_update",
                            "data": new_state,
                        })
                        return new_state
                    return None
                
                # Task to receive from Gemini and send to client
                async def send_to_client():
                    """Process events from run_live() and send to client."""
                    nonlocal prev_state
                    
                    try:
                        async for event in runner.run_live(
                            session=session,
                            live_request_queue=live_request_queue,
                            run_config=run_config,
                        ):
                            # ADK Event fields:
                            # - interrupted: Boolean when user interrupted (CHECK FIRST!)
                            # - content: Content with parts (may contain audio blobs)
                            # - output_transcription: Transcription of assistant's speech
                            # - input_transcription: Transcription of user's speech  
                            # - turn_complete: Boolean when turn is done
                            # - actions: Tool actions
                            
                            # CHECK INTERRUPTION FIRST - frontend needs to stop audio immediately
                            if event.interrupted:
                                await websocket.send_json({
                                    "type": "interrupted",
                                })
                                # Don't send any more audio/transcripts for this event
                                continue
                            
                            # Handle audio content (only send audio, not text from content)
                            # Only send audio if we're actively responding to this turn
                            if event.content and event.content.parts:
                                current_msg = turn_state["user_msg_count"]
                                # Only send audio if this is for the current response we're tracking
                                if turn_state["response_for_msg"] == current_msg:
                                    for part in event.content.parts:
                                        # Check for inline audio data only
                                        if hasattr(part, 'inline_data') and part.inline_data:
                                            if part.inline_data.data:
                                                await websocket.send_bytes(part.inline_data.data)
                                    # Note: Don't send text from content.parts - use transcription instead
                            
                            # Handle assistant speech transcription - DEDUPLICATE responses
                            if event.output_transcription and event.output_transcription.text:
                                current_msg = turn_state["user_msg_count"]
                                response_text = event.output_transcription.text
                                
                                # Check if this is a new response for this message
                                if turn_state["response_for_msg"] < current_msg:
                                    # First response for this turn - accept it
                                    turn_state["response_for_msg"] = current_msg
                                    turn_state["response_text_sent"] = response_text
                                    
                                    await websocket.send_json({
                                        "type": "transcript",
                                        "role": "assistant",
                                        "content": response_text,
                                        "partial": not getattr(event.output_transcription, 'finished', True),
                                    })
                                elif response_text.startswith(turn_state["response_text_sent"]):
                                    # This is a continuation of the current response (streaming)
                                    # Only send the new part
                                    new_text = response_text[len(turn_state["response_text_sent"]):]
                                    if new_text.strip():
                                        turn_state["response_text_sent"] = response_text
                                        await websocket.send_json({
                                            "type": "transcript",
                                            "role": "assistant",
                                            "content": response_text,
                                            "partial": not getattr(event.output_transcription, 'finished', True),
                                        })
                                # else: This is a duplicate/alternative response - skip it
                            
                            # Handle user speech transcription
                            if event.input_transcription and event.input_transcription.text:
                                is_finished = getattr(event.input_transcription, 'finished', True)
                                # Increment message counter when user finishes speaking
                                # This is critical for voice input - binary audio doesn't increment counter
                                if is_finished:
                                    turn_state["user_msg_count"] += 1
                                    logger.info(f"[User Speech Complete] msg #{turn_state['user_msg_count']}")
                                
                                await websocket.send_json({
                                    "type": "transcript",
                                    "role": "user",
                                    "content": event.input_transcription.text,
                                    "partial": not is_finished,
                                })
                            
                            # Turn complete notification - ONLY SEND ONCE per user message
                            # ADK may fire turn_complete multiple times (after tool calls, after speech)
                            if event.turn_complete:
                                current_msg = turn_state["user_msg_count"]
                                # Only send if we haven't sent turn_complete for this message yet
                                if turn_state["last_turn_sent"] < current_msg:
                                    turn_state["last_turn_sent"] = current_msg
                                    
                                    await websocket.send_json({
                                        "type": "turn_complete",
                                    })
                                    
                                    # Send live update only if state changed
                                    new_state = await send_live_update_if_changed()
                                    if new_state:
                                        logger.info(f"[Turn Complete] msg #{current_msg}, evidence items: {len(new_state.get('evidenceItems', []))}")
                                        prev_state = new_state
                                # Skip duplicate turn_completes silently
                            
                            # Tool call events - notify frontend about tool calls
                            # Send state update only if state actually changed (deduplication)
                            if event.actions:
                                func_calls = event.get_function_calls()
                                if func_calls:
                                    for fc in func_calls:
                                        await websocket.send_json({
                                            "type": "tool_call",
                                            "content": f"Calling {fc.name}...",
                                            "tool": fc.name,
                                            "args": dict(fc.args) if hasattr(fc, 'args') else {},
                                        })
                                    
                                    # Send updated state only if it changed
                                    new_state = await send_live_update_if_changed()
                                    if new_state:
                                        prev_state = new_state
                                        
                    except Exception as e:
                        logger.error(f"Error in send_to_client for {client_id}: {e}")
                        raise
                
                # Send initial status to client
                await websocket.send_json({
                    "type": "status",
                    "content": "connected",
                    "message": "Connected",
                    "config": self.get_session_info()["audio_config"],
                })
                
                # Trigger Lexie to speak first with a greeting
                live_request_queue.send_content(
                    types.Content(
                        role="user",
                        parts=[types.Part.from_text(
                            text="[Session started - please greet the user warmly and introduce yourself as Lexie, a legal intake assistant. Ask how you can help them today with their injury case. Do NOT assume a specific type of injury - let them tell you what happened.]"
                        )]
                    )
                )
                
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
