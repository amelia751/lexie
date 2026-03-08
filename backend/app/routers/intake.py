"""
Intake WebSocket Router

Handles text-based intake conversations with live data updates.
This is simpler than voice streaming but provides the same functionality.
"""

import asyncio
import json
import logging
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from app.agents.live_agent import root_agent
from app.services.evidence_hub import evidence_hub, EvidenceStatus

logger = logging.getLogger(__name__)

router = APIRouter()

# Session service for intake conversations
session_service = InMemorySessionService()


class IntakeMessage(BaseModel):
    """Intake message request model."""
    message: str
    session_id: Optional[str] = None


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
    
    # Build timeline from facts
    timeline_events = []
    if incident.get("date"):
        timeline_events.append({
            "id": "incident-1",
            "date": incident.get("date", "Unknown"),
            "event": "Workplace Injury",
            "description": incident.get("description", ""),
            "category": "incident",
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
    }


@router.websocket("/intake/{client_id}")
async def intake_websocket(websocket: WebSocket, client_id: str):
    """
    WebSocket endpoint for text-based intake with live data updates.
    
    Message Protocol:
    
    Client -> Server (JSON):
    - {"type": "message", "content": "<text>"}
    - {"type": "reset"} - Reset the conversation
    - {"type": "end"} - End session
    
    Server -> Client (JSON):
    - {"type": "status", "content": "connected"}
    - {"type": "response", "content": "<agent response>"}
    - {"type": "live_update", "data": {<live data snapshot>}}
    - {"type": "tool_call", "tool": "<name>", "args": {...}}
    - {"type": "error", "content": "<error>"}
    - {"type": "session_end"}
    """
    await websocket.accept()
    logger.info(f"Intake client {client_id} connected")
    
    # Send welcome status
    await websocket.send_json({
        "type": "status",
        "content": "connected",
        "message": "Connected to Lexie Intake Assistant",
    })
    
    # Create runner and session
    runner = Runner(
        agent=root_agent,
        app_name="lexie_intake",
        session_service=session_service,
    )
    
    session = await session_service.create_session(
        app_name="lexie_intake",
        user_id=client_id,
    )
    
    # Reset evidence hub for new session
    evidence_hub.reset()
    
    # Track previous state to detect changes
    prev_state = get_live_data_snapshot()
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            msg_type = data.get("type")
            
            if msg_type == "end":
                await websocket.send_json({"type": "session_end"})
                break
                
            elif msg_type == "reset":
                evidence_hub.reset()
                session = await session_service.create_session(
                    app_name="lexie_intake",
                    user_id=client_id,
                )
                prev_state = get_live_data_snapshot()
                await websocket.send_json({
                    "type": "status",
                    "content": "reset",
                    "message": "Session reset. Ready for new intake.",
                })
                await websocket.send_json({
                    "type": "live_update",
                    "data": prev_state,
                })
                continue
                
            elif msg_type == "message":
                content = data.get("content", "")
                
                # Create user message
                user_content = types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=content)]
                )
                
                # Run agent
                response_text = ""
                try:
                    async for event in runner.run_async(
                        user_id=client_id,
                        session_id=session.id,
                        new_message=user_content,
                    ):
                        # Check for tool calls
                        if hasattr(event, 'actions') and event.actions:
                            func_calls = event.get_function_calls() if hasattr(event, 'get_function_calls') else []
                            for fc in func_calls:
                                await websocket.send_json({
                                    "type": "tool_call",
                                    "tool": fc.name,
                                    "args": dict(fc.args) if hasattr(fc, 'args') else {},
                                })
                                
                                # Send live update after tool call
                                new_state = get_live_data_snapshot()
                                if new_state != prev_state:
                                    await websocket.send_json({
                                        "type": "live_update",
                                        "data": new_state,
                                    })
                                    prev_state = new_state
                        
                        # Final response
                        if event.is_final_response() and event.content:
                            for part in event.content.parts:
                                if part.text:
                                    response_text += part.text
                    
                    # Send agent response
                    await websocket.send_json({
                        "type": "response",
                        "content": response_text,
                    })
                    
                    # Send final live update
                    new_state = get_live_data_snapshot()
                    if new_state != prev_state:
                        await websocket.send_json({
                            "type": "live_update", 
                            "data": new_state,
                        })
                        prev_state = new_state
                        
                except Exception as e:
                    logger.error(f"Agent error: {e}")
                    await websocket.send_json({
                        "type": "error",
                        "content": str(e),
                    })
                    
    except WebSocketDisconnect:
        logger.info(f"Intake client {client_id} disconnected")
    except Exception as e:
        logger.error(f"Intake WebSocket error for {client_id}: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "content": str(e),
            })
        except:
            pass


# Store active sessions
active_sessions: dict[str, any] = {}


@router.post("/intake/message")
async def intake_message(message: IntakeMessage):
    """
    HTTP endpoint for single intake message.
    Returns agent response and live data snapshot.
    """
    try:
        # Create runner
        runner = Runner(
            agent=root_agent,
            app_name="lexie_intake_http",
            session_service=session_service,
        )
        
        # Get or create session
        session_key = message.session_id or "default"
        
        if session_key in active_sessions:
            session = active_sessions[session_key]
        else:
            session = await session_service.create_session(
                app_name="lexie_intake_http",
                user_id=session_key,
            )
            active_sessions[session_key] = session
        
        # Run agent
        user_content = types.Content(
            role="user",
            parts=[types.Part.from_text(text=message.message)]
        )
        
        response_text = ""
        async for event in runner.run_async(
            user_id=session_key,
            session_id=session.id,
            new_message=user_content,
        ):
            if event.is_final_response() and event.content:
                for part in event.content.parts:
                    if part.text:
                        response_text += part.text
        
        return {
            "response": response_text,
            "session_id": session.id,
            "live_data": get_live_data_snapshot(),
        }
        
    except Exception as e:
        logger.error(f"Intake message error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/intake/state")
async def get_intake_state():
    """Get current intake state (evidence hub snapshot)."""
    return get_live_data_snapshot()


@router.post("/intake/reset")
async def reset_intake():
    """Reset the intake state."""
    evidence_hub.reset()
    return {
        "status": "reset",
        "live_data": get_live_data_snapshot(),
    }
