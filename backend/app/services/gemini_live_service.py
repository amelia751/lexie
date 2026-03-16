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
from app.services.evidence_hub import evidence_hub, EvidenceStatus
from app.config import settings

logger = logging.getLogger(__name__)

# Lock for thread-safe medical expense accumulation
_medical_expense_lock = asyncio.Lock()


def get_live_data_snapshot() -> dict:
    """Get current state of all live data from evidence hub - comprehensive like demo."""
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
    source_files = facts.get("source_files", {})
    
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
    
    # ===== BUILD COMPREHENSIVE TIMELINE =====
    timeline_events = []
    # Get incident date with fallback to current date if not available
    incident_date = incident.get("date")
    if not incident_date or incident_date == "Unknown":
        from datetime import date
        incident_date = date.today().isoformat()  # Default to today if no date
    injuries_list = injuries.get("list", [])
    medical_expense = medical.get("expenses") or 0
    
    # 1. Incident event
    if incident.get("date"):
        timeline_events.append({
            "id": "incident-1",
            "date": incident_date,
            "event": "Workplace Injury Occurred",
            "description": incident.get("description") or f"Fall from scaffolding at construction site. Location: {incident.get('location', 'Unknown')}",
            "category": "incident",
            "source": "Employer Incident Report",
            "sourceFileId": source_files.get("incident"),
        })
    
    # 2. Emergency room visit
    if injuries_list:
        injury_text = ", ".join(injuries_list[:3])
        timeline_events.append({
            "id": "medical-er-1",
            "date": incident_date,
            "event": "Emergency Room Visit",
            "description": f"Initial diagnosis: {injury_text}",
            "category": "medical",
            "source": "ER Medical Records",
            "sourceFileId": source_files.get("medical"),
        })
    
    # 3. Generate follow-up events based on uploaded documents
    uploaded_types = [item.type for item in checklist if item.status.value == "uploaded"]
    
    if "medical_records_primary" in uploaded_types or "medical_imaging" in uploaded_types:
        # Add follow-up events with offset dates
        from datetime import datetime, timedelta
        try:
            base_date = datetime.strptime(incident_date, "%Y-%m-%d")
        except:
            base_date = datetime.now()
        
        if "medical_imaging" in uploaded_types:
            img_date = (base_date + timedelta(days=1)).strftime("%Y-%m-%d")
            timeline_events.append({
                "id": "imaging-1",
                "date": img_date,
                "event": "Diagnostic Imaging",
                "description": "MRI/X-ray ordered to assess fractures and soft tissue damage",
                "category": "medical",
                "source": "Imaging Records",
                "sourceFileId": source_files.get("imaging"),
            })
        
        if "medical_records_primary" in uploaded_types:
            ortho_date = (base_date + timedelta(days=3)).strftime("%Y-%m-%d")
            timeline_events.append({
                "id": "ortho-1",
                "date": ortho_date,
                "event": "Orthopedic Consultation",
                "description": "Follow-up with orthopedic specialist for fracture assessment",
                "category": "medical",
                "source": "Orthopedic Records",
                "sourceFileId": source_files.get("medical"),
            })
    
    if "physical_therapy" in uploaded_types:
        try:
            base_date = datetime.strptime(incident_date, "%Y-%m-%d")
            pt_date = (base_date + timedelta(days=14)).strftime("%Y-%m-%d")
        except:
            pt_date = incident_date
        timeline_events.append({
            "id": "pt-1",
            "date": pt_date,
            "event": "Physical Therapy Prescribed",
            "description": "PT regimen initiated - 3x weekly for 6-8 weeks",
            "category": "medical",
            "source": "Physical Therapy Records",
            "sourceFileId": source_files.get("pt"),
        })
    
    # 4. OSHA/Safety investigation
    if "osha_report" in uploaded_types:
        try:
            base_date = datetime.strptime(incident_date, "%Y-%m-%d")
            osha_date = (base_date + timedelta(days=5)).strftime("%Y-%m-%d")
        except:
            osha_date = incident_date
        violations = safety.get("violations", [])
        violation_text = ", ".join(violations[:2]) if violations else "Safety violations identified"
        timeline_events.append({
            "id": "osha-1",
            "date": osha_date,
            "event": "OSHA Investigation",
            "description": f"Investigation findings: {violation_text}",
            "category": "legal",
            "source": "OSHA Report",
            "sourceFileId": source_files.get("osha"),
        })
    
    # 5. Workers comp filing
    if "workers_comp_claim" in uploaded_types:
        try:
            base_date = datetime.strptime(incident_date, "%Y-%m-%d")
            wc_date = (base_date + timedelta(days=7)).strftime("%Y-%m-%d")
        except:
            wc_date = incident_date
        timeline_events.append({
            "id": "wc-1",
            "date": wc_date,
            "event": "Workers' Compensation Filed",
            "description": "Claim filed with employer's workers' comp insurance",
            "category": "legal",
            "source": "Workers' Comp Claim",
            "sourceFileId": source_files.get("workers_comp"),
        })
    
    # 6. Medical billing
    if medical_expense > 0:
        timeline_events.append({
            "id": "billing-1",
            "date": incident_date,
            "event": "Medical Bills Accumulated",
            "description": f"Total medical expenses to date: ${medical_expense:,.2f}",
            "category": "billing",
            "source": "Medical Bills",
            "sourceFileId": source_files.get("billing"),
        })
    
    # ===== BUILD COMPREHENSIVE MEDICAL RECORDS =====
    medical_records = []
    icd10_map = {
        "fracture": ("S52.501A", "Displaced fracture"),
        "concussion": ("S06.0X0A", "Concussion"),
        "herniation": ("M51.16", "Intervertebral disc disorders"),
        "disc": ("M51.16", "Intervertebral disc disorders"),
        "strain": ("S39.012A", "Muscle strain"),
        "sprain": ("S33.5XXA", "Sprain of ligaments"),
        "contusion": ("S70.01XA", "Contusion"),
        "laceration": ("S01.81XA", "Laceration"),
        "pain": ("M54.5", "Low back pain"),
        "head": ("S09.90XA", "Head injury"),
        "wrist": ("S62.101A", "Wrist injury"),
        "back": ("S39.012A", "Back injury"),
    }
    
    for i, injury in enumerate(injuries_list):
        injury_lower = injury.lower()
        icd10 = "S99.9"  # Default unspecified
        category = "Other"
        
        for keyword, (code, cat) in icd10_map.items():
            if keyword in injury_lower:
                icd10 = code
                category = cat
                break
        
        # Extract ICD-10 from injury string if present (e.g., "Concussion (S06.0X0A)")
        import re
        icd_match = re.search(r'\(([A-Z]\d{2}\.\w+)\)', injury)
        if icd_match:
            icd10 = icd_match.group(1)
        
        medical_records.append({
            "id": f"diagnosis-{i+1}",
            "date": incident_date,  # Use incident date as default
            "icd10": icd10,
            "diagnosis": injury.split("(")[0].strip(),  # Remove ICD code from name
            "service": injury.split("(")[0].strip(),  # Service = diagnosis for now
            "severity": injuries.get("severity", "serious"),
            "status": "Under treatment",
            "provider": "Riverside General Hospital" if i == 0 else "Orthopedic Specialists",
            "category": category,
            "amount": 0,  # Will be filled by billing extraction
            "sourceFileId": source_files.get("medical"),
        })
    
    # ===== BUILD ITEMIZED BILLING =====
    billing_items = []
    if medical_expense > 0:
        # Generate realistic billing breakdown
        er_portion = medical_expense * 0.53  # ER typically ~53% of total
        ortho_portion = medical_expense * 0.08  # Ortho ~8%
        neuro_portion = medical_expense * 0.08  # Neuro ~8%
        imaging_portion = medical_expense * 0.19  # Imaging ~19%
        pt_portion = medical_expense * 0.12  # PT ~12%
        
        billing_items = [
            {"provider": "Riverside General Hospital ER", "amount": round(er_portion, 2), "category": "Emergency"},
            {"provider": "Orthopedic Associates", "amount": round(ortho_portion, 2), "category": "Specialist"},
            {"provider": "Neurology Consultants", "amount": round(neuro_portion, 2), "category": "Specialist"},
            {"provider": "Advanced Imaging Center", "amount": round(imaging_portion, 2), "category": "Diagnostic"},
            {"provider": "PT & Rehabilitation", "amount": round(pt_portion, 2), "category": "Therapy"},
        ]
    
    # ===== BUILD DAMAGES ESTIMATE =====
    damages_estimate = {}
    settlement = damages.get("settlement_range", {})
    
    # Calculate damages with multipliers if we have medical expenses
    if medical_expense > 0 or settlement.get("low"):
        # Pain multiplier based on severity
        severity = injuries.get("severity", "moderate")
        if severity == "severe":
            multiplier = 4.0
        elif severity == "serious":
            multiplier = 3.0
        else:
            multiplier = 2.0
        
        lost_wages = employment.get("lost_wages") or 0
        economic = medical_expense + lost_wages
        non_economic = medical_expense * multiplier
        total = economic + non_economic
        
        # Settlement range (70-90% of total typically)
        low = settlement.get("low") or round(total * 0.70)
        high = settlement.get("high") or round(total * 0.90)
        
        damages_estimate = {
            "pastMedical": medical_expense,
            "futureMedical": medical.get("future_estimate") or round(medical_expense * 0.3),
            "lostWages": lost_wages,
            "painMultiplier": multiplier,
            "economicDamages": economic,
            "nonEconomicDamages": non_economic,
            "totalEstimate": total,
            "settlementLow": low,
            "settlementHigh": high,
            "billingBreakdown": billing_items,
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
            
            # NOTE: Don't reset evidence_hub on every connection
            # State persists across WebSocket reconnections
            # Reset only via explicit /intake/reset endpoint
            
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
                                
                                if msg_type == "document_upload":
                                    # NEW: Document upload with actual file content for INSTANT extraction
                                    turn_state["user_msg_count"] += 1
                                    
                                    # IMMEDIATELY set doc processing state to block parallel responses
                                    import time
                                    turn_state["doc_processing_until"] = time.time() + 10
                                    turn_state["doc_speech_started"] = False
                                    turn_state["doc_speech_finished"] = False
                                    turn_state["doc_first_response_time"] = 0
                                    
                                    doc_type = msg.get("doc_type", "document")
                                    file_name = msg.get("file_name", "document")
                                    file_id = msg.get("file_id", "")
                                    file_ids = msg.get("file_ids", [file_id])
                                    content_b64 = msg.get("content_base64", "")
                                    
                                    logger.info(f"[DOC_UPLOAD] Received {file_name} ({len(content_b64) // 1024}KB base64)")
                                    
                                    # Store source file ID for provenance with specific categories
                                    current_item = evidence_hub.get_currently_requested()
                                    if file_ids:
                                        # Determine category from doc_type, file_name, or current_item
                                        item_id = (current_item.id if current_item else doc_type).lower()
                                        file_lower = file_name.lower()
                                        
                                        # Map to specific source categories used in get_live_data_snapshot
                                        if "incident" in item_id or "incident" in file_lower:
                                            category = "incident"
                                        elif "billing" in item_id or "billing" in file_lower:
                                            category = "billing"
                                        elif "imaging" in item_id or "imaging" in file_lower or "xray" in file_lower or "mri" in file_lower:
                                            category = "imaging"
                                        elif "orthopedic" in file_lower or "specialist" in item_id:
                                            category = "medical"  # specialists go to medical
                                        elif "er" in file_lower or "emergency" in file_lower:
                                            category = "medical"
                                        elif "pt" in item_id or "physical" in file_lower or "therapy" in file_lower:
                                            category = "pt"
                                        elif "osha" in item_id or "osha" in file_lower or "safety" in file_lower:
                                            category = "osha"
                                        elif "workers" in item_id or "workers" in file_lower or "comp" in file_lower:
                                            category = "workers_comp"
                                        elif "medical" in item_id:
                                            category = "medical"
                                        else:
                                            category = "document"
                                        
                                        evidence_hub.facts.source_files[category] = file_ids[0]
                                        logger.info(f"[DOC_UPLOAD] Stored source file: {category} -> {file_ids[0]}")
                                    
                                    # INSTANT EXTRACTION using document processor
                                    extraction_result = None
                                    extraction_summary = ""
                                    
                                    if content_b64:
                                        try:
                                            from app.services.document_processor import document_processor
                                            import asyncio
                                            
                                            file_content = base64.b64decode(content_b64)
                                            
                                            # Notify frontend that extraction started
                                            await websocket.send_json({
                                                "type": "tool_call",
                                                "content": f"Extracting facts from {file_name}...",
                                                "tool": "instant_extraction",
                                                "args": {"file": file_name, "doc_type": doc_type},
                                            })
                                            
                                            # Run instant extraction (2-3 seconds)
                                            extraction_result = await document_processor.extract_instant(
                                                file_content=file_content,
                                                file_name=file_name,
                                                doc_type=doc_type,
                                                file_id=file_id
                                            )
                                            
                                            logger.info(f"[DOC_UPLOAD] Extraction completed in {extraction_result.extraction_time_ms}ms")
                                            
                                            # Build extraction summary for agent
                                            facts = extraction_result.extracted_facts
                                            if facts and extraction_result.status.value == "extracted":
                                                extraction_summary = "\n\n📄 EXTRACTED FACTS:\n"
                                                for key, value in facts.items():
                                                    if key != "error" and value:
                                                        if isinstance(value, list):
                                                            extraction_summary += f"- {key}: {', '.join(str(v) for v in value[:5])}\n"
                                                        else:
                                                            extraction_summary += f"- {key}: {value}\n"
                                                
                                                # Auto-save key facts to evidence_hub
                                                if facts.get("plaintiff_name") or facts.get("patient_name"):
                                                    name = facts.get("plaintiff_name") or facts.get("patient_name")
                                                    evidence_hub.update_fact("plaintiff_name", name)
                                                if facts.get("incident_date") or facts.get("visit_date") or facts.get("service_date"):
                                                    date = facts.get("incident_date") or facts.get("visit_date") or facts.get("service_date")
                                                    evidence_hub.update_fact("incident_date", date)
                                                if facts.get("incident_location"):
                                                    evidence_hub.update_fact("incident_location", facts["incident_location"])
                                                if facts.get("incident_description"):
                                                    evidence_hub.update_fact("incident_description", facts["incident_description"])
                                                if facts.get("employer_name"):
                                                    evidence_hub.update_fact("employer_name", facts["employer_name"])
                                                if facts.get("total_amount"):
                                                    try:
                                                        amount = float(str(facts["total_amount"]).replace(",", ""))
                                                        # Accumulate medical expenses with lock to prevent race condition
                                                        async with _medical_expense_lock:
                                                            current = evidence_hub.facts.medical_expenses or 0
                                                            new_total = current + amount
                                                            evidence_hub.update_fact("medical_expenses", new_total)
                                                            logger.info(f"[DOC_UPLOAD] Added medical_expenses: ${amount:,.2f} (total: ${new_total:,.2f})")
                                                    except Exception as e:
                                                        logger.error(f"[DOC_UPLOAD] Failed to accumulate medical: {e}")
                                                if facts.get("diagnoses") or facts.get("injuries") or facts.get("injuries_reported"):
                                                    new_injuries = facts.get("diagnoses") or facts.get("injuries") or facts.get("injuries_reported")
                                                    # Handle both list and string formats
                                                    if isinstance(new_injuries, str):
                                                        new_injuries = [new_injuries]
                                                    if isinstance(new_injuries, list) and new_injuries:
                                                        # Merge with existing injuries (avoid duplicates)
                                                        existing = evidence_hub.facts.injuries or []
                                                        merged = list(set(existing + new_injuries))
                                                        logger.info(f"[INJURIES] existing={len(existing)}, new={len(new_injuries)}, merged={len(merged)}")
                                                        evidence_hub.update_fact("injuries", merged)
                                                if facts.get("injury_severity"):
                                                    evidence_hub.update_fact("injury_severity", facts["injury_severity"])
                                            
                                            # Send extraction result to frontend
                                            await websocket.send_json({
                                                "type": "extraction_complete",
                                                "doc_id": extraction_result.doc_id,
                                                "file_id": file_id,  # Include file_id for status updates
                                                "file_name": file_name,
                                                "extraction_time_ms": extraction_result.extraction_time_ms,
                                                "facts": facts,
                                                "status": extraction_result.status.value,
                                            })
                                            
                                        except Exception as e:
                                            logger.error(f"[DOC_UPLOAD] Extraction error: {e}")
                                            extraction_summary = f"\n\n⚠️ Extraction error: {e}"
                                    
                                    # Match file to correct evidence type and mark as uploaded
                                    matched_item = evidence_hub.match_file_to_evidence(file_name, doc_type)
                                    if matched_item:
                                        evidence_hub.update_evidence_status(matched_item.id, EvidenceStatus.UPLOADED)
                                        evidence_hub.clear_currently_requested()
                                        logger.info(f"[DOC_UPLOAD] Marked '{matched_item.type}' as uploaded (matched from {file_name})")
                                    else:
                                        # Fall back to handle_evidence_response if no match
                                        from app.agents.live_agent import handle_evidence_response
                                        result = handle_evidence_response(has_document=True, document_uploaded=True)
                                        logger.info(f"[DOC_UPLOAD] No specific match, used handle_evidence_response")
                                    
                                    # Set document processing window
                                    import time
                                    turn_state["doc_processing_until"] = time.time() + 10  # 10s window for doc processing
                                    turn_state["doc_speech_started"] = False
                                    turn_state["doc_speech_finished"] = False
                                    turn_state["doc_first_response_time"] = 0  # Reset for new doc
                                    
                                    # Tell agent about the extraction
                                    agent_message = f"""[DOCUMENT UPLOADED] {doc_type}: {file_name}
{extraction_summary}

⚠️ RESPOND EXACTLY ONCE:
1. handle_evidence_response() already called - DO NOT call again
2. Review the extracted facts above
3. Call update_case_facts() for 1-2 key facts if needed
4. SPEAK to confirm: "I see [key fact]. Is that correct?"
5. Wait for user response before requesting next document"""
                                    
                                    live_request_queue.send_content(
                                        types.Content(
                                            role="user",
                                            parts=[types.Part.from_text(text=agent_message)]
                                        )
                                    )
                                
                                elif msg_type == "text":
                                    # Text message - increment message counter
                                    turn_state["user_msg_count"] += 1
                                    content = msg.get("content", "")
                                    
                                    # Reset ALL blocking flags for any text input
                                    # This allows agent to respond to "I don't have this" etc.
                                    if not content.startswith("[DOCUMENT UPLOADED]"):
                                        turn_state["doc_processing_until"] = 0  # End doc window
                                        turn_state["doc_speech_started"] = False
                                        turn_state["doc_speech_finished"] = False
                                        turn_state["doc_first_response_time"] = 0
                                        turn_state["speech_completed_at"] = 0
                                        turn_state["last_response_time"] = 0
                                        turn_state["response_text_sent"] = ""
                                        turn_state["turn_complete_speech"] = False
                                        logger.info(f"[TEXT INPUT] Reset ALL blocking flags for: '{content[:30]}...'")
                                    
                                    # LEGACY: Detect [DOCUMENT UPLOADED] text (fallback if base64 fails)
                                    if content.startswith("[DOCUMENT UPLOADED]"):
                                        logger.info(f"[INTERCEPT] Document upload detected (text fallback)")
                                        
                                        import re
                                        file_ids_match = re.search(r'\[FILE_IDS:\s*([^\]]+)\]', content)
                                        file_ids = []
                                        current_item = evidence_hub.get_currently_requested()
                                        doc_type = current_item.type if current_item else "document"
                                        
                                        if file_ids_match:
                                            file_ids = [fid.strip() for fid in file_ids_match.group(1).split(',')]
                                            if current_item and file_ids:
                                                category = "medical" if "medical" in current_item.id.lower() else "incident"
                                                evidence_hub.facts.source_files[category] = file_ids[0]
                                        
                                        from app.agents.live_agent import handle_evidence_response
                                        handle_evidence_response(has_document=True, document_uploaded=True)
                                        
                                        await websocket.send_json({
                                            "type": "tool_call",
                                            "content": "Processing document...",
                                            "tool": "handle_evidence_response",
                                        })
                                        
                                        import time
                                        turn_state["doc_processing_until"] = time.time() + 10  # 10s window for doc processing
                                        turn_state["doc_speech_started"] = False
                                        turn_state["doc_speech_finished"] = False
                                        turn_state["doc_first_response_time"] = 0  # Reset for new doc
                                        
                                        agent_message = f"""[DOCUMENT UPLOADED] {doc_type}

Document received (content not available for extraction).

⚠️ RESPOND ONCE:
1. handle_evidence_response() already called
2. Acknowledge the upload
3. Ask user to confirm any details they can share verbally"""
                                    
                                        live_request_queue.send_content(
                                            types.Content(
                                                role="user",
                                                parts=[types.Part.from_text(text=agent_message)]
                                            )
                                        )
                                    else:
                                        # Check for damages calculation request
                                        import re
                                        damage_keywords = r'\b(damage|settlement|estimate|how much|case worth|case value|calculate|compensation)\b'
                                        if re.search(damage_keywords, content.lower()) and evidence_hub.facts.medical_expenses:
                                            logger.info("[INTERCEPT] Damages calculation request detected")
                                            
                                            # Call calculate_damages directly
                                            from app.agents.live_agent import calculate_damages
                                            try:
                                                result = calculate_damages()
                                                if result.get("status") == "success":
                                                    logger.info(f"[INTERCEPT] Damages calculated: ${result.get('settlement_range', {}).get('mid', 0)}")
                                                    
                                                    # Send live_update with damages
                                                    await websocket.send_json({
                                                        "type": "live_update",
                                                        "data": get_live_data_snapshot()
                                                    })
                                                    
                                                    # Tell agent to present the results
                                                    sr = result.get('settlement_range', {})
                                                    agent_message = f"""[DAMAGES CALCULATED]

I've calculated the damages estimate:
- Economic damages: {sr.get('low', '$0')} (medical + lost wages)
- Non-economic damages: Calculated based on injury severity
- Settlement range: {sr.get('low', '$0')} to {sr.get('high', '$0')}

⚠️ Present these results conversationally to the user. Explain the calculation briefly."""
                                                    
                                                    live_request_queue.send_content(
                                                        types.Content(
                                                            role="user",
                                                            parts=[types.Part.from_text(text=agent_message)]
                                                        )
                                                    )
                                                else:
                                                    # Forward original message
                                                    live_request_queue.send_content(
                                                        types.Content(
                                                            role="user",
                                                            parts=[types.Part.from_text(text=content)]
                                                        )
                                                    )
                                            except Exception as e:
                                                logger.error(f"[INTERCEPT] Damages calculation error: {e}")
                                                live_request_queue.send_content(
                                                    types.Content(
                                                        role="user",
                                                        parts=[types.Part.from_text(text=content)]
                                                    )
                                                )
                                        else:
                                            # Regular text message - send directly to agent
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
                    "last_response_time": 0,  # Timestamp when we sent the last response
                    "last_state_hash": "",  # For deduplicating live_updates
                    "interrupted_at_msg": -1,  # Track which turn was interrupted
                    "doc_processing_until": 0,  # Timestamp until which we enforce single response
                    "doc_speech_started": False,  # True when agent starts speaking during doc processing
                    "doc_speech_finished": False,  # True when agent finishes speaking (blocks 2nd voice)
                    "doc_first_response_time": 0,  # Timestamp of first response during doc processing
                    "last_response_ended": 0,  # Timestamp when last response finished (for cooldown)
                    "response_cooldown": 0.5,  # Seconds to wait between responses
                    "turn_complete_speech": False,  # True once we've sent a complete speech for this turn
                    "speech_completed_at": 0,  # Timestamp of last speech completion (for blocking duplicates)
                    "sent_response_hashes": set(),  # Track hashes of sent responses to block exact duplicates
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
                    damages = state.get('damagesEstimate', {})
                    # Create hashable representation
                    key = (
                        evidence_status,
                        doc_req_id,
                        facts.get('incidentDate'),
                        facts.get('employerName'),
                        str(facts.get('injuries', [])),
                        facts.get('medicalExpenses'),
                        damages.get('settlementLow'),
                        damages.get('settlementHigh'),
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
                            # BUT ignore interrupts during document processing window (false triggers)
                            if event.interrupted:
                                import time
                                if time.time() < turn_state["doc_processing_until"]:
                                    # We're in document processing window - ignore this interrupt
                                    logger.info(f"[IGNORED] Interrupt during doc processing window")
                                    continue
                                
                                # Mark current turn as interrupted - don't send any more for this turn
                                turn_state["interrupted_at_msg"] = turn_state["response_for_msg"]
                                turn_state["last_response_ended"] = time.time()  # Reset cooldown timer
                                logger.info(f"[Interrupted] Turn {turn_state['response_for_msg']} interrupted")
                                await websocket.send_json({
                                    "type": "interrupted",
                                })
                                # Don't send any more audio/transcripts for this event
                                continue
                            
                            # Skip any audio/content for an interrupted turn (events still in pipeline)
                            if turn_state["response_for_msg"] >= 0 and turn_state["response_for_msg"] <= turn_state["interrupted_at_msg"]:
                                # This event is from an interrupted turn - skip audio/transcript
                                # But still process tool calls and turn_complete
                                pass  # Will be checked below for each event type
                            
                            # Only block duplicate/overlapping voices during doc processing
                            # The "2 voices" issue happens when a false interrupt triggers a NEW response
                            # We should NOT block continuation speech after tool calls (same response)
                            import time
                            in_doc_window = time.time() < turn_state["doc_processing_until"]
                            
                            # Only block if:
                            # 1. We're in doc processing window
                            # 2. Agent already finished speaking once
                            # 3. This appears to be a NEW response (not continuation)
                            if in_doc_window and turn_state["doc_speech_finished"]:
                                if event.output_transcription:
                                    # Check if this is a NEW response starting fresh
                                    # A new response would have different content than what we sent
                                    text = event.output_transcription.text
                                    # If this is truly new content (not building on existing), it's a duplicate
                                    if not text.startswith(turn_state["response_text_sent"]):
                                        # This is a completely new response - likely from false interrupt
                                        logger.info(f"[BLOCKED] New duplicate response during doc processing")
                                        continue
                                    # Otherwise it's continuation - allow it
                            
                            # Handle audio content (only send audio, not text from content)
                            # Only send audio if we're actively responding to this turn AND not interrupted
                            if event.content and event.content.parts:
                                current_msg = turn_state["user_msg_count"]
                                resp_msg = turn_state["response_for_msg"]
                                
                                # Check if this is for the current turn
                                # Note: response_for_msg is updated by transcript handler, so audio should follow
                                should_send = False
                                if resp_msg == current_msg and not turn_state["turn_complete_speech"]:
                                    # This is for the current active turn AND we haven't finished speech yet
                                    should_send = True
                                elif resp_msg < current_msg and resp_msg <= turn_state["interrupted_at_msg"]:
                                    # This is from an OLD interrupted turn - skip it
                                    should_send = False
                                elif turn_state["turn_complete_speech"]:
                                    # We've already completed speech for this turn - block additional audio
                                    logger.info(f"[BLOCKED AUDIO] Additional audio after speech complete")
                                    should_send = False
                                
                                if should_send:
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
                                resp_msg = turn_state["response_for_msg"]
                                is_finished = getattr(event.output_transcription, 'finished', True)
                                
                                # Track doc speech state
                                in_doc_window = time.time() < turn_state["doc_processing_until"]
                                
                                # FIRST CHECK: During doc processing, allow only ONE response
                                # This is the most aggressive check - blocks any second response during doc window
                                if in_doc_window and turn_state["doc_speech_started"]:
                                    existing = turn_state["response_text_sent"]
                                    # Only allow if this is a continuation of existing response
                                    if not response_text.startswith(existing) and not existing.startswith(response_text):
                                        logger.info(f"[BLOCKED DOC] Second response during doc window: '{response_text[:40]}...'")
                                        continue
                                
                                # SECOND CHECK: Block by content hash (catches parallel duplicates)
                                content_hash = hash(response_text[:100])
                                turn_hash = f"{current_msg}:{content_hash}"
                                if turn_hash in turn_state["sent_response_hashes"]:
                                    logger.info(f"[BLOCKED HASH] Duplicate response blocked: '{response_text[:40]}...'")
                                    continue
                                
                                # THIRD CHECK: Block duplicate responses for the SAME turn
                                # If we already have substantial text AND this doesn't continue it, block
                                existing_text = turn_state["response_text_sent"]
                                if existing_text and len(existing_text) > 20:
                                    # Check if this is a continuation
                                    is_continuation = (
                                        response_text.startswith(existing_text) or
                                        existing_text.startswith(response_text)  # Partial update
                                    )
                                    if not is_continuation:
                                        # Block ANY non-continuation if we're responding to current turn
                                        if resp_msg == current_msg:
                                            logger.info(f"[BLOCKED DUPLICATE] Alternative response for turn {current_msg}: '{response_text[:40]}...'")
                                            continue
                                        # Also block if within 15 seconds
                                        time_since_response = time.time() - turn_state.get("last_response_time", 0)
                                        if turn_state.get("last_response_time", 0) > 0 and time_since_response < 15.0:
                                            logger.info(f"[BLOCKED DUPLICATE] Non-continuation response blocked ({time_since_response:.1f}s ago): '{response_text[:40]}...'")
                                            continue
                                
                                # Check if this is a NEW response for a NEW turn (after any interruption)
                                if resp_msg < current_msg:
                                    # CRITICAL: During doc processing window, block ALL new responses
                                    # Only allow the FIRST response for a document
                                    logger.info(f"[RESPONSE] New turn response. in_doc_window={in_doc_window}, doc_first_response_time={turn_state.get('doc_first_response_time', 0)}, resp_msg={resp_msg}, current_msg={current_msg}")
                                    if in_doc_window:
                                        # Use timestamp to detect if we've already started responding
                                        first_response_time = turn_state.get("doc_first_response_time", 0)
                                        if first_response_time > 0:
                                            # We've already started a response - block this one
                                            logger.info(f"[BLOCKED] Additional response during doc window (started {time.time() - first_response_time:.1f}s ago): '{response_text[:40]}...'")
                                            continue
                                        # IMMEDIATELY mark timestamp to prevent parallel responses
                                        turn_state["doc_first_response_time"] = time.time()
                                        turn_state["doc_speech_started"] = True
                                        logger.info(f"[FIRST RESPONSE] Set doc_first_response_time={turn_state['doc_first_response_time']}")
                                    
                                    # ALSO block if we recently completed speech (time-based fallback)
                                    # Use 10s window to match doc processing window
                                    time_since_speech = time.time() - turn_state.get("speech_completed_at", 0)
                                    if turn_state.get("speech_completed_at", 0) > 0 and time_since_speech < 10.0:
                                        logger.info(f"[BLOCKED] New turn too soon after speech ({time_since_speech:.1f}s)")
                                        continue
                                    
                                    # Check cooldown - don't start new response too quickly after previous
                                    time_since_last = time.time() - turn_state["last_response_ended"]
                                    cooldown = turn_state["response_cooldown"]
                                    
                                    if turn_state["last_response_ended"] > 0 and time_since_last < cooldown:
                                        # Too soon after last response - wait briefly
                                        logger.info(f"[Cooldown] Waiting {cooldown - time_since_last:.2f}s before new response")
                                        await asyncio.sleep(cooldown - time_since_last)
                                    
                                    # This is a new turn! Reset blocking flags and accept
                                    turn_state["response_for_msg"] = current_msg
                                    turn_state["response_text_sent"] = response_text
                                    turn_state["last_response_time"] = time.time()  # Track when we sent this
                                    turn_state["turn_complete_speech"] = False  # New turn, allow new speech
                                    turn_state["sent_response_hashes"].add(turn_hash)  # Track this response
                                    logger.info(f"[New Response] Starting response for turn {current_msg}")
                                    
                                    # Mark speech as started during doc processing
                                    if in_doc_window:
                                        turn_state["doc_speech_started"] = True
                                    
                                    await websocket.send_json({
                                        "type": "transcript",
                                        "role": "assistant",
                                        "content": response_text,
                                        "partial": not is_finished,
                                    })
                                    
                                    # Mark speech as finished if this is the final transcript
                                    if is_finished:
                                        turn_state["turn_complete_speech"] = True
                                        turn_state["speech_completed_at"] = time.time()  # Track completion time
                                        logger.info(f"[Speech Complete] Blocking additional responses for turn {current_msg}")
                                        if in_doc_window:
                                            turn_state["doc_speech_finished"] = True
                                        
                                elif resp_msg <= turn_state["interrupted_at_msg"]:
                                    # This is from an interrupted turn - skip it
                                    continue
                                elif response_text.startswith(turn_state["response_text_sent"]):
                                    # This is a continuation of the current response (streaming)
                                    # Only send the new part
                                    new_text = response_text[len(turn_state["response_text_sent"]):]
                                    if new_text.strip():
                                        turn_state["response_text_sent"] = response_text
                                        turn_state["last_response_time"] = time.time()  # Update time
                                        await websocket.send_json({
                                            "type": "transcript",
                                            "role": "assistant",
                                            "content": response_text,
                                            "partial": not is_finished,
                                        })
                                        
                                        # Mark speech as finished if this is the final transcript
                                        if is_finished:
                                            turn_state["turn_complete_speech"] = True
                                            turn_state["speech_completed_at"] = time.time()  # Track completion time
                                            logger.info(f"[Speech Complete] Blocking additional responses for turn")
                                            if in_doc_window:
                                                turn_state["doc_speech_finished"] = True
                                elif turn_state["turn_complete_speech"]:
                                    # We've already completed speech for this turn - block any new response
                                    logger.info(f"[BLOCKED] New response after speech complete: '{response_text[:50]}...'")
                                    continue
                                elif in_doc_window and turn_state["doc_speech_finished"]:
                                    # During doc processing, block any non-continuation response after speech
                                    logger.info(f"[BLOCKED] Response during doc window after speech: '{response_text[:50]}...'")
                                    continue
                                elif turn_state.get("speech_completed_at", 0) > 0 and time.time() - turn_state["speech_completed_at"] < 6.0:
                                    # Block responses within 6s of speech completion (covers partial echoes)
                                    logger.info(f"[BLOCKED] Response too soon after speech complete")
                                    continue
                                elif turn_state["response_text_sent"] and len(turn_state["response_text_sent"]) > 50:
                                    # We already have a substantial response for this turn
                                    # This is a NEW/ALTERNATIVE response - block it (2 voices issue)
                                    logger.info(f"[BLOCKED] Alternative response for same turn: '{response_text[:50]}...'")
                                    continue
                                # else: This is a duplicate/alternative response - skip it
                            
                            # Handle user speech transcription
                            if event.input_transcription and event.input_transcription.text:
                                is_finished = getattr(event.input_transcription, 'finished', True)
                                # Increment message counter when user finishes speaking
                                # This is critical for voice input - binary audio doesn't increment counter
                                if is_finished:
                                    # CRITICAL: During doc processing window, ignore short "speech" events
                                    # These are often noise, agent's voice bleeding through, or false positives
                                    import time
                                    in_doc_window = time.time() < turn_state["doc_processing_until"]
                                    speech_text = event.input_transcription.text.strip()
                                    
                                    if in_doc_window and len(speech_text) < 20:
                                        # Very short speech during doc processing - likely noise
                                        logger.info(f"[IGNORED] Short speech during doc window: '{speech_text[:30]}'")
                                    else:
                                        turn_state["user_msg_count"] += 1
                                        logger.info(f"[User Speech Complete] msg #{turn_state['user_msg_count']}: '{speech_text[:30]}...'")
                                        
                                        # Reset ALL blocking flags - allow agent to respond to this new input
                                        # This ensures verbal input (like "incorrect") gets a proper response
                                        turn_state["doc_speech_started"] = False
                                        turn_state["doc_speech_finished"] = False
                                        turn_state["speech_completed_at"] = 0  # Allow new response
                                        turn_state["last_response_time"] = 0  # Reset so new response isn't blocked
                                        turn_state["response_text_sent"] = ""  # Clear previous response
                                
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
                                    
                                    # Mark when this response ended (for cooldown)
                                    turn_state["last_response_ended"] = time.time()
                                    
                                    # Reset response tracking for next turn
                                    turn_state["response_text_sent"] = ""
                                    
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
                            # RATE LIMITING: Prevent tool spam
                            if event.actions:
                                func_calls = event.get_function_calls()
                                if func_calls:
                                    # Initialize tool tracking if needed
                                    if "recent_tools" not in turn_state:
                                        turn_state["recent_tools"] = []
                                        turn_state["tool_counts"] = {}
                                    
                                    import time
                                    current_time = time.time()
                                    
                                    for fc in func_calls:
                                        tool_name = fc.name
                                        
                                        # Track tool call count
                                        turn_state["tool_counts"][tool_name] = turn_state["tool_counts"].get(tool_name, 0) + 1
                                        
                                        # RATE LIMIT: Skip if this tool was called too recently (within 0.5s)
                                        recent = [(t, ts) for t, ts in turn_state["recent_tools"] if current_time - ts < 1.0]
                                        turn_state["recent_tools"] = recent  # Clean up old entries
                                        
                                        same_tool_count = sum(1 for t, _ in recent if t == tool_name)
                                        
                                        # Skip if called more than 2 times in last second
                                        if same_tool_count >= 2:
                                            logger.warning(f"[TOOL_SPAM] Skipping {tool_name} (called {same_tool_count}x in 1s)")
                                            continue
                                        
                                        # Skip if update_case_facts called more than 4 times total this session
                                        if tool_name == "update_case_facts" and turn_state["tool_counts"].get(tool_name, 0) > 8:
                                            if turn_state["tool_counts"][tool_name] % 3 != 0:  # Only show every 3rd
                                                continue
                                        
                                        # Track this call
                                        turn_state["recent_tools"].append((tool_name, current_time))
                                        
                                        await websocket.send_json({
                                            "type": "tool_call",
                                            "content": f"Calling {tool_name}...",
                                            "tool": tool_name,
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
