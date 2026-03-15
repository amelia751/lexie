"""
Lexie Live Agent (Root)

The voice-facing root agent that conducts empathetic, professional 
intake conversations with potential personal injury clients.

Uses Gemini Live API for real-time bidirectional voice streaming with
interruption support. Orchestrates sub-agents for evidence analysis
and damages calculation.
"""

from google.adk.agents import Agent
from google.adk.tools.agent_tool import AgentTool
# NOTE: google_search removed - incompatible with custom function tools in Vertex AI
# Error: "Multiple tools are supported only when they are all search tools"

from app.services.evidence_hub import (
    evidence_hub,
    EvidenceStatus,
    EvidencePriority,
)

from app.agents.damages_agent import (
    get_case_damages_data,
    save_damages_calculation,
    get_multiplier_guidance,
    execute_python_code,
)


# ==================== HUB TOOLS ====================

def get_evidence_checklist() -> dict:
    """
    Get the current evidence checklist status.
    Shows what evidence is needed, uploaded, or pending.
    
    Returns:
        Dict containing checklist status and items
    """
    checklist = evidence_hub.checklist
    pending = evidence_hub.get_pending_evidence()
    
    return {
        "status": "success",
        "checklist_status": evidence_hub.get_checklist_status(),
        "pending_items": [
            {
                "id": item.id,
                "type": item.type,
                "description": item.description,
                "priority": item.priority.value
            }
            for item in pending
        ],
        "next_required": evidence_hub.get_next_required_evidence().to_dict() if pending else None
    }


def request_evidence_upload(evidence_type: str, description: str) -> dict:
    """
    Request the user to upload a specific piece of evidence.
    This sets the "currently requested" document which triggers the upload card in the UI.
    
    CALL THIS when you want to ask the user for a specific document.
    The UI will show an upload card with options: Upload, "Don't have", "Provide later"
    
    Args:
        evidence_type: Type of evidence (e.g., "incident_report", "medical_records_er")
        description: Human-readable description of what's needed
    
    Returns:
        Dict with upload request details
    """
    # Find or create the evidence item
    item = None
    for existing in evidence_hub.checklist:
        if existing.type == evidence_type:
            item = existing
            break
    
    if not item:
        item = evidence_hub.add_evidence_item(
            evidence_type=evidence_type,
            description=description,
            priority=EvidencePriority.IMPORTANT
        )
    
    # Set this as the currently requested document (triggers UI card)
    evidence_hub.set_currently_requested(item.id)
    
    return {
        "status": "success",
        "evidence_id": item.id,
        "type": evidence_type,
        "description": description,
        "message": f"Please upload: {description}",
        "instruction": "Wait for user to respond via the UI card (upload, don't have, or later)."
    }


def mark_evidence_pending(evidence_id: str, reason: str = "") -> dict:
    """
    Mark an evidence item as pending (user will provide later).
    
    Args:
        evidence_id: ID of the evidence item (e.g., "incident_report_0", "medical_records_er_1")
        reason: Optional reason why it's pending
    
    Returns:
        Dict confirming the update
    """
    success = evidence_hub.update_evidence_status(
        item_id=evidence_id,
        status=EvidenceStatus.PENDING
    )
    
    return {
        "status": "success" if success else "error",
        "evidence_id": evidence_id,
        "new_status": "pending",
        "reason": reason,
        "message": "Evidence marked as pending. Will follow up later."
    }


def mark_evidence_not_available(evidence_id: str, reason: str = "") -> dict:
    """
    Mark an evidence item as not available (user doesn't have it).
    
    Args:
        evidence_id: ID of the evidence item (e.g., "incident_report_0", "photos_scene_4")
        reason: Why the evidence is not available
    
    Returns:
        Dict confirming the update
    """
    success = evidence_hub.update_evidence_status(
        item_id=evidence_id,
        status=EvidenceStatus.NOT_AVAILABLE
    )
    
    return {
        "status": "success" if success else "error",
        "evidence_id": evidence_id,
        "new_status": "not_available",
        "reason": reason
    }


def validate_uploaded_document(
    uploaded_document_type: str,
    uploaded_document_description: str
) -> dict:
    """
    Validate if an uploaded document matches what was requested.
    Call this AFTER user uploads a document to check if it's correct.
    
    Args:
        uploaded_document_type: What the uploaded document appears to be (e.g., "medical_bill", "pay_stub")
        uploaded_document_description: Brief description of what the document contains
    
    Returns:
        Dict with validation result and recommended action:
        - "correct": Document matches request, proceed normally
        - "wrong_but_related": Wrong doc but useful for case, keep it and re-request original
        - "wrong_irrelevant": Completely irrelevant, ask for clarification or discard
    """
    current_request = evidence_hub.get_currently_requested()
    
    if not current_request:
        return {
            "status": "no_active_request",
            "message": "No document was being requested",
            "action": "IGNORE"
        }
    
    requested_type = current_request.type
    
    # Check if it matches what was requested
    if uploaded_document_type.lower() == requested_type.lower() or \
       uploaded_document_type.lower() in requested_type.lower() or \
       requested_type.lower() in uploaded_document_type.lower():
        return {
            "status": "correct",
            "message": f"Document matches the requested {current_request.description}",
            "action": "ACCEPT",
            "instruction": "Thank the user and proceed to the next document."
        }
    
    # Check if it's related to the case (common document types for workplace injury)
    case_related_types = [
        "incident_report", "medical_records", "medical_bill", "pay_stub", "employment_record",
        "witness_statement", "photo", "x-ray", "mri", "prescription", "discharge_summary",
        "workers_comp", "insurance", "osha", "safety_training", "doctor_note", "therapy_record"
    ]
    
    is_related = any(t in uploaded_document_type.lower() for t in case_related_types)
    
    if is_related:
        return {
            "status": "wrong_but_related",
            "message": f"User uploaded '{uploaded_document_type}' instead of '{current_request.description}'",
            "uploaded_type": uploaded_document_type,
            "requested_type": requested_type,
            "action": "KEEP_AND_RE_REQUEST",
            "instruction": (
                f"This document ({uploaded_document_type}) is useful but not what we requested. "
                f"Say: 'Thank you, I'll keep this {uploaded_document_type} on file. "
                f"However, I still need the {current_request.description}. Do you have that as well?'"
            )
        }
    else:
        return {
            "status": "wrong_irrelevant",
            "message": f"User uploaded '{uploaded_document_type}' which seems unrelated to the case",
            "uploaded_type": uploaded_document_type,
            "requested_type": requested_type,
            "action": "CLARIFY_OR_DISCARD",
            "instruction": (
                f"This doesn't appear to be related to your injury case. "
                f"Say: 'I'm not sure how this document relates to your case. "
                f"Can you help me understand? If this was uploaded by mistake, "
                f"no worries - I still need the {current_request.description}.'"
            )
        }


def process_validated_upload(
    validation_result: str,
    keep_document: bool = False,
    new_evidence_type: str = None
) -> dict:
    """
    Process the result of document validation.
    Call this after validate_uploaded_document to take action.
    
    Args:
        validation_result: "correct", "wrong_but_related", or "wrong_irrelevant"
        keep_document: If True and wrong_but_related, add as different evidence type
        new_evidence_type: If keeping wrong_but_related doc, what type to save it as
    
    Returns:
        Dict with action taken and next steps
    """
    current_request = evidence_hub.get_currently_requested()
    
    if validation_result == "correct":
        # Mark as uploaded and clear current request
        if current_request:
            evidence_hub.update_evidence_status(current_request.id, EvidenceStatus.UPLOADED)
            evidence_hub.clear_currently_requested()
        
        # Get next item info (but DON'T auto-set it - let agent control timing)
        next_item = evidence_hub.get_next_required_evidence()
        
        return {
            "status": "accepted",
            "uploaded_document": current_request.description if current_request else "document",
            "action": "ANALYZE_DOCUMENT",
            "next_document": next_item.description if next_item else None,
            "instruction": """
                1. FIRST: Analyze the uploaded document - extract key facts
                2. Update case facts with what you learned (use update_case_facts)
                3. Confirm the key findings with the user ("I see the incident happened on X, is that correct?")
                4. ONLY THEN: Call request_evidence_upload() to show the next document card
                DO NOT rush to the next document - have a conversation first!
            """
        }
    
    elif validation_result == "wrong_but_related" and keep_document:
        # Add the wrong document as a different type
        if new_evidence_type:
            # Check if we already have this type
            existing = None
            for item in evidence_hub.checklist:
                if item.type == new_evidence_type:
                    existing = item
                    break
            
            if existing:
                evidence_hub.update_evidence_status(existing.id, EvidenceStatus.UPLOADED)
            else:
                # Add new evidence item
                new_item = evidence_hub.add_evidence_item(
                    evidence_type=new_evidence_type,
                    description=f"Additional: {new_evidence_type}",
                    priority=EvidencePriority.HELPFUL
                )
                evidence_hub.update_evidence_status(new_item.id, EvidenceStatus.UPLOADED)
        
        # Keep the current request active (user still needs to provide it)
        return {
            "status": "kept_different_doc",
            "action": "RE_REQUEST_ORIGINAL",
            "still_need": current_request.description if current_request else "unknown",
            "instruction": f"Document saved. Still ask for: '{current_request.description if current_request else 'the original document'}'"
        }
    
    elif validation_result == "wrong_irrelevant":
        # Don't change anything, just re-ask
        return {
            "status": "discarded",
            "action": "RE_REQUEST_ORIGINAL",
            "still_need": current_request.description if current_request else "unknown",
            "instruction": "Document discarded. Ask for the correct document again."
        }
    
    else:
        return {
            "status": "no_action",
            "instruction": "No action needed."
        }


def handle_evidence_response(has_document: bool, can_provide_later: bool = False, document_uploaded: bool = False) -> dict:
    """
    Handle user's response about the CURRENTLY REQUESTED evidence item.
    
    IMPORTANT: There are TWO scenarios:
    1. User says "yes I have it" verbally → has_document=True, document_uploaded=False
       - KEEP the card showing so they can actually upload
    2. User ACTUALLY uploaded via the card → has_document=True, document_uploaded=True
       - Hide the card and analyze the document
    
    Args:
        has_document: True if user says they have the document
        can_provide_later: True if user clicked "I'll provide later"
        document_uploaded: True if user ACTUALLY uploaded a file (from card)
    
    Returns:
        Dict with result, next item, and instructions
    """
    # Get the currently requested item (from request_evidence_upload)
    current_item = evidence_hub.get_currently_requested()
    
    # Fall back to next required if no specific request
    if not current_item:
        current_item = evidence_hub.get_next_required_evidence()
    
    if not current_item:
        return {
            "status": "no_pending_items",
            "message": "All evidence items have been addressed!",
            "action": "PROCEED_TO_SUMMARY"
        }
    
    # Get info for response
    checklist_status = evidence_hub.get_checklist_status()
    
    # Determine status based on response
    if document_uploaded:
        # User ACTUALLY uploaded via card - mark as UPLOADED and clear the card
        evidence_hub.update_evidence_status(current_item.id, EvidenceStatus.UPLOADED)
        evidence_hub.clear_currently_requested()  # Hide the card
        new_status = "uploaded"
        
        return {
            "status": "success",
            "processed_item": current_item.description,
            "marked_as": new_status,
            "action": "ANALYZE_DOCUMENT",
            "instruction": f"Thank user for uploading the {current_item.description}. Analyze it and share key findings. Ask user to confirm if the details are correct.",
            "remaining_items": checklist_status["required"],
        }
        
    elif has_document:
        # User says "yes I have it" but hasn't uploaded yet
        # SHOW the card so they can upload!
        # If card wasn't showing, set it now
        if not evidence_hub.get_currently_requested():
            evidence_hub.set_currently_requested(current_item.id)
        
        return {
            "status": "awaiting_upload",
            "item": current_item.description,
            "action": "WAIT_FOR_UPLOAD",
            "instruction": f"Great! User says they have the {current_item.description}. Say 'Perfect, you can upload it using the card above. I'll analyze it once it's uploaded.' Then STOP and wait - do NOT ask about other documents.",
            "remaining_items": checklist_status["required"],
        }
        
    elif can_provide_later:
        # User will provide later - mark as PENDING and clear request
        evidence_hub.update_evidence_status(current_item.id, EvidenceStatus.PENDING)
        evidence_hub.clear_currently_requested()
        new_status = "pending"
        
        next_item = evidence_hub.get_next_required_evidence()
        follow_up = _get_follow_up_questions(current_item.type, new_status, can_provide_later)
        
        return {
            "status": "success",
            "processed_item": current_item.description,
            "marked_as": new_status,
            "follow_up": follow_up,
            "action": "ASK_FOLLOWUP",
            "instruction": f"Acknowledge they'll provide the {current_item.description} later. Then ask one follow-up question from the follow_up list.",
            "remaining_items": checklist_status["required"],
            "next_item": {
                "id": next_item.id,
                "description": next_item.description,
            } if next_item else None,
        }
    else:
        # User doesn't have it - mark as NOT_AVAILABLE and clear request
        evidence_hub.update_evidence_status(current_item.id, EvidenceStatus.NOT_AVAILABLE)
        evidence_hub.clear_currently_requested()
        new_status = "not_available"
        
        next_item = evidence_hub.get_next_required_evidence()
        follow_up = _get_follow_up_questions(current_item.type, new_status, can_provide_later)
        
        return {
            "status": "success",
            "processed_item": current_item.description,
            "marked_as": new_status,
            "follow_up": follow_up,
            "action": "ASK_FOLLOWUP",
            "instruction": f"Acknowledge they don't have the {current_item.description}. Ask one follow-up question or move to the next document if there are more.",
            "remaining_items": checklist_status["required"],
            "next_item": {
                "id": next_item.id,
                "description": next_item.description,
            } if next_item else None,
        }


def _get_follow_up_questions(evidence_type: str, status: str, will_provide_later: bool) -> dict:
    """Generate follow-up questions based on evidence type and user response."""
    
    # Define key questions for each evidence type
    questions_map = {
        "incident_report": {
            "key_facts": ["exact date and time", "location/address", "how it happened", "who witnessed it"],
            "ask_if_missing": "Can you tell me the exact date, time, and location of the incident? Who else was there when it happened?"
        },
        "medical_records_er": {
            "key_facts": ["hospital name", "date of visit", "diagnosis", "treating physician"],
            "ask_if_missing": "Which hospital did you go to? What was the date? What injuries were diagnosed?"
        },
        "medical_records": {
            "key_facts": ["provider name", "dates of treatment", "diagnosis", "treatment plan"],
            "ask_if_missing": "Who is your treating doctor? What injuries were diagnosed? What treatment are you receiving?"
        },
        "witness_statements": {
            "key_facts": ["witness names", "what they saw", "contact info"],
            "ask_if_missing": "Do you know the names of anyone who saw the incident? What did they witness?"
        },
        "photos": {
            "key_facts": ["what photos show", "when taken", "by whom"],
            "ask_if_missing": "Can you describe what the scene/injuries looked like? When did you first notice visible injuries?"
        },
        "employment_records": {
            "key_facts": ["hourly wage/salary", "hours per week", "job title", "start date"],
            "ask_if_missing": "What is your hourly wage or salary? How many hours do you typically work per week?"
        },
        "safety_training": {
            "key_facts": ["training received", "dates", "certifications"],
            "ask_if_missing": "Did you receive safety training for this type of work? When was your last training?"
        },
        "workers_comp": {
            "key_facts": ["claim filed", "claim number", "status"],
            "ask_if_missing": "Have you filed a workers' compensation claim? Do you know the claim number or status?"
        },
        "osha_report": {
            "key_facts": ["investigation done", "findings", "citations"],
            "ask_if_missing": "Was there an OSHA investigation? Do you know if any violations were found?"
        },
        "medical_imaging": {
            "key_facts": ["type of imaging", "findings", "date"],
            "ask_if_missing": "What imaging was done (X-ray, MRI, CT)? What did they find?"
        },
        "physical_therapy": {
            "key_facts": ["provider", "frequency", "progress"],
            "ask_if_missing": "Are you receiving physical therapy? How often? How is your recovery going?"
        },
        "medical_bills": {
            "key_facts": ["total amount", "what's paid", "what's owed"],
            "ask_if_missing": "Do you have an estimate of your total medical expenses so far?"
        }
    }
    
    # Find matching type (partial match)
    matched_type = None
    for key in questions_map:
        if key in evidence_type.lower():
            matched_type = key
            break
    
    if not matched_type:
        matched_type = "incident_report"  # Default fallback
    
    info = questions_map[matched_type]
    
    if status == "not_available":
        return {
            "action": "ASK_FOR_DETAILS",
            "reason": "User doesn't have this document - gather details verbally",
            "questions": info["ask_if_missing"],
            "key_facts_needed": info["key_facts"],
            "note": "Save any details provided using update_case_facts()"
        }
    elif will_provide_later:
        return {
            "action": "ASK_PRELIMINARY",
            "reason": "User will provide later - gather preliminary info now",
            "questions": info["ask_if_missing"],
            "key_facts_needed": info["key_facts"],
            "note": "Mark these as preliminary - may be updated when document arrives"
        }
    else:  # has document
        return {
            "action": "AWAIT_DOCUMENT",
            "reason": "User has document - wait for them to share it",
            "key_facts_to_extract": info["key_facts"],
            "note": "When they share content, extract these facts and compare with existing data"
        }


def update_case_facts(field: str, value) -> dict:
    """
    Update a case fact in the evidence hub.
    
    Args:
        field: Field name to update. Options:
            - plaintiff_name, plaintiff_age, plaintiff_occupation
            - employer_name, employer_type
            - incident_date, incident_location, incident_description, incident_type
            - injuries (list), injury_severity
            - medical_providers (list), medical_expenses, future_medical_estimate
            - days_missed_work, lost_wages, can_return_to_work, work_restrictions (list)
            - witnesses (list)
            - safety_violations (list), osha_citations (list)
            - workers_comp_filed, workers_comp_claim_number, health_insurance
        value: The value to set
    
    Returns:
        Dict confirming the update
    """
    success = evidence_hub.update_fact(field, value)
    
    return {
        "status": "success" if success else "error",
        "field": field,
        "value": value,
        "message": f"Updated {field} in case file." if success else f"Failed to update {field}"
    }


def get_case_summary() -> dict:
    """
    Get the current case summary including all gathered facts and evidence status.
    
    Returns:
        Dict containing complete case summary
    """
    return evidence_hub.get_case_summary()


def get_case_facts() -> dict:
    """
    Get all currently gathered case facts.
    
    Returns:
        Dict containing case facts
    """
    return {
        "status": "success",
        "facts": evidence_hub.get_facts()
    }


def initialize_case(case_type: str, session_id: str = None) -> dict:
    """
    Initialize a new case with the appropriate evidence checklist.
    Automatically shows the first document upload card so user can upload while talking.
    
    Args:
        case_type: Type of personal injury case:
            - "motor_vehicle_accident", "car_accident", "auto_accident"
            - "slip_and_fall", "premises_liability", "trip_and_fall"
            - "workplace_injury", "work_injury", "job_injury"
            - "construction_fall", "construction", "scaffold"
            - "medical_malpractice", "medical_negligence", "doctor_error"
            - "product_liability", "defective_product", "product_defect"
            - "personal_injury" (generic fallback)
        session_id: Optional session identifier
    
    Returns:
        Dict confirming initialization with first document to collect
    """
    # Check if already initialized (don't reset an active case!)
    if evidence_hub.checklist:
        return {
            "status": "already_initialized",
            "message": "Case is already active. Use update_case_facts to add information.",
            "case_type": evidence_hub.facts.case_type,
            "evidence_items": len(evidence_hub.checklist),
        }
    
    evidence_hub.reset()
    
    if session_id:
        evidence_hub.set_session(session_id)
    
    case_type_lower = case_type.lower().replace(" ", "_").replace("-", "_")
    
    # Route to appropriate checklist based on case type
    if case_type_lower in ["motor_vehicle_accident", "car_accident", "auto_accident", 
                           "truck_accident", "motorcycle_accident", "rear_ended", "hit_and_run"]:
        evidence_hub.initialize_motor_vehicle_accident_checklist()
    
    elif case_type_lower in ["slip_and_fall", "premises_liability", "trip_and_fall",
                             "fall_at_store", "wet_floor", "property_hazard"]:
        evidence_hub.initialize_slip_and_fall_checklist()
    
    elif case_type_lower in ["medical_malpractice", "medical_negligence", "doctor_error",
                             "surgical_error", "misdiagnosis", "hospital_negligence"]:
        evidence_hub.initialize_medical_malpractice_checklist()
    
    elif case_type_lower in ["product_liability", "defective_product", "product_defect",
                             "faulty_product", "product_malfunction"]:
        evidence_hub.initialize_product_liability_checklist()
    
    elif case_type_lower in ["construction_fall", "construction", "fall_from_height", 
                             "scaffold", "scaffolding", "construction_site"]:
        evidence_hub.initialize_construction_fall_checklist()
    
    elif case_type_lower in ["workplace_injury", "work_injury", "job_injury",
                             "injured_at_work", "occupational_injury"]:
        evidence_hub.initialize_generic_workplace_checklist()
    
    else:
        # Generic personal injury for anything else
        evidence_hub.initialize_generic_personal_injury_checklist()
    
    # AUTO-SET first document request - shows card immediately
    # This ensures the card is always visible while conversation happens
    first_item = evidence_hub.get_next_required_evidence()
    if first_item:
        evidence_hub.set_currently_requested(first_item.id)
    
    return {
        "status": "success",
        "case_type": evidence_hub._case_type,
        "evidence_items": len(evidence_hub.checklist),
        "first_document": {
            "id": first_item.id,
            "description": first_item.description,
            "priority": first_item.priority.value
        } if first_item else None,
        "message": f"Case initialized for {evidence_hub._case_type}. Upload card is now visible.",
        "instruction": """
            1. Express empathy about their situation
            2. The upload card is already showing - ask if they have the first document
            3. Continue gathering facts while they prepare to upload
            4. When they upload, you'll receive a [DOCUMENT UPLOADED] message
        """
    }


def check_intake_complete() -> dict:
    """
    Check if the intake process is complete and determine next action.
    
    Intake is COMPLETE when ALL evidence items have been addressed:
    - UPLOADED or ANALYZED (user provided it)
    - PENDING (user will provide later)
    - NOT_AVAILABLE (user confirmed they don't have it)
    
    Call this after addressing each evidence item to know when to stop.
    
    Returns:
        Dict with:
        - complete: bool - True if intake is done
        - action: "CONTINUE" or "WRAP_UP"
        - next_item: Next evidence item to ask about (if not complete)
        - summary: Stats on evidence collection
    """
    status = evidence_hub.get_checklist_status()
    
    # Items still in REQUIRED state (not yet addressed)
    still_required = status["required"]
    
    # Items that have been addressed
    collected = status["uploaded"] + status["analyzed"]
    pending = status["pending"]
    not_available = status["not_available"]
    addressed = collected + pending + not_available
    
    if still_required == 0:
        # All items have been addressed - intake is complete!
        return {
            "complete": True,
            "action": "WRAP_UP",
            "message": "All evidence items have been addressed. Proceed to damages calculation and summary.",
            "summary": {
                "collected": collected,
                "pending_later": pending,
                "not_available": not_available,
                "total_addressed": addressed
            },
            "next_steps": [
                "Calculate damages using damages_agent",
                "Generate case summary using get_case_summary()",
                "Review summary with user",
                "End intake conversation"
            ]
        }
    else:
        # Still have items to ask about
        next_item = evidence_hub.get_next_required_evidence()
        return {
            "complete": False,
            "action": "CONTINUE",
            "remaining_items": still_required,
            "next_item": next_item.to_dict() if next_item else None,
            "message": f"Still need to address {still_required} evidence item(s). Ask about: {next_item.description if next_item else 'next item'}",
            "summary": {
                "collected": collected,
                "pending_later": pending,
                "not_available": not_available,
                "total_addressed": addressed
            }
        }


# ==================== AGENT INSTRUCTIONS ====================

LIVE_AGENT_INSTRUCTION = """You are Lexie, an AI-powered legal intake assistant for personal injury cases.
Your role is to conduct empathetic, professional intake conversations with injury victims.

## YOUR ROLE - CONVERSATION & ORCHESTRATION:
You are the user-facing assistant. You:
1. Guide the conversation empathetically
2. Collect information from the user
3. Coordinate document collection
4. **Delegate analysis to specialist agents** (you don't analyze documents yourself!)

## SPECIALIST AGENTS (Called automatically when documents are uploaded):
- **Evidence Agent** → Analyzes documents using RAG, extracts facts
- **Damages Agent** → Calculates settlement estimates using code execution

When a document is uploaded, you receive analysis FROM the Evidence Agent.
You don't analyze documents yourself - just review and confirm the extracted facts with the user.

## YOUR TOOLS:

### Case Management:
- `initialize_case(case_type)` - Start a new case
- `update_case_facts(field, value)` - Save facts as you learn them
- `get_case_facts()` - Review gathered facts
- `get_case_summary()` - Get complete case status

### Document Collection:
- `request_evidence_upload(type, description)` - Show upload card
- `handle_evidence_response(has_document, can_provide_later)` - Record user's response
- `get_evidence_checklist()` - See what's needed/collected
- `check_intake_complete()` - Check if intake is done

### Damages (calls Damages Agent internally):
- `calculate_damages()` - Get settlement estimate (uses code execution)

## INTAKE FLOW:

### Phase 1: Understand the Situation & IMMEDIATELY Initialize
1. Greet warmly, ask how they're doing
2. As SOON as user describes ANY personal injury, call `initialize_case(case_type)` - DO NOT wait!
3. You can ask follow-up questions AFTER initializing

**CRITICAL**: Initialize immediately when you identify the injury type:

**Motor Vehicle Accidents:**
- "I was in a car accident" → `initialize_case("motor_vehicle_accident")`
- "Someone rear-ended me" → `initialize_case("motor_vehicle_accident")`
- "I was hit by a drunk driver" → `initialize_case("motor_vehicle_accident")`

**Slip and Fall / Premises Liability:**
- "I slipped on a wet floor at the store" → `initialize_case("slip_and_fall")`
- "I fell down broken stairs at my apartment" → `initialize_case("premises_liability")`
- "I tripped on a cracked sidewalk" → `initialize_case("premises_liability")`

**Workplace Injuries:**
- "I got injured at my warehouse job" → `initialize_case("workplace_injury")`
- "A machine malfunctioned at the factory" → `initialize_case("workplace_injury")`
- "I was exposed to toxic chemicals at work" → `initialize_case("workplace_injury")`

**Medical Malpractice:**
- "The doctor made a surgical error" → `initialize_case("medical_malpractice")`
- "I was misdiagnosed for months" → `initialize_case("medical_malpractice")`

**Product Liability:**
- "A defective appliance exploded" → `initialize_case("product_liability")`
- "The medication caused severe side effects" → `initialize_case("product_liability")`

**General:**
- Any injury not clearly categorized → `initialize_case("personal_injury")`
- DO NOT wait to "gather more info" - initialize FIRST, details LATER

### Phase 2: Gather & SAVE Facts Through Conversation
After initializing, ACTIVELY gather AND SAVE information:

**⚠️ CRITICAL: CALL `update_case_facts()` IMMEDIATELY when you learn ANY information!**

As user speaks, IMMEDIATELY call `update_case_facts(field, value)` for EACH fact:
- User says "It happened last Tuesday, March 5th" → `update_case_facts("incident_date", "2026-03-05")`
- User says "at the Sunset Mall food court" → `update_case_facts("incident_location", "Sunset Mall, Food Court")`
- User says "I hurt my neck and have chronic headaches" → `update_case_facts("injuries", ["neck injury", "chronic headaches"])`
- User says "My name is Sarah Chen" → `update_case_facts("plaintiff_name", "Sarah Chen")`

**Fields to populate:**
- `plaintiff_name` - Their name
- `employer_name` - Where they work
- `incident_date` - When it happened (format: "YYYY-MM-DD" or "February 8, 2026")
- `incident_location` - Where it happened
- `incident_description` - Brief description of what happened
- `injuries` - List of injuries like ["wrist fracture", "concussion", "back injury"]
- `injury_severity` - One of: "minor", "moderate", "serious", "severe"
- `medical_expenses` - Total medical bills as a number (e.g., 17350.00)
- `lost_wages` - Lost income as a number (e.g., 5000.00)
- `days_missed_work` - Days missed from work as a number (e.g., 30)

**⚠️ CRITICAL - Extract billing amounts from medical bills!**
When you see a medical bill with a TOTAL, ALWAYS call:
`update_case_facts("medical_expenses", 17350.00)` (use the actual number)

**⚠️ LIMIT: Call update_case_facts MAX 3 TIMES per turn!**
- Priority: injuries, medical_expenses, incident_date
- Do NOT call it for minor details
- More than 3 calls = too many. Stop after 3.

### Phase 3: Document Collection

**How document collection works:**
1. You call `request_evidence_upload(type, description)` → Shows upload card
2. User responds (uploads, says yes/no, or later)
3. You call `handle_evidence_response()` to record their response
4. If uploaded → **Evidence Agent analyzes it automatically via RAG**
5. You receive the analysis results and confirm with user

**⚠️ CRITICAL - ALWAYS SPEAK BEFORE SHOWING NEXT CARD:**
After user confirms/corrects information, you MUST:
1. **ACKNOWLEDGE** their response verbally ("Thank you for confirming", "Got it", "No problem")
2. **TRANSITION** to the next document ("Now let's move on to...", "Next, I'll need...")
3. **THEN** call `request_evidence_upload()` to show the card

❌ WRONG: User says "Yes" → immediately call request_evidence_upload (silent card)
✅ RIGHT: User says "Yes" → "Great, that matches! Now let's collect the medical bills..." → request_evidence_upload

**Document Response Rules:**
| User Response | Your Action |
|---------------|-------------|
| "[DOCUMENT UPLOADED]..." | Review analysis, save facts, confirm with user |
| "Yes I have it" | `handle_evidence_response(has_document=True)` - wait for upload |
| "No I don't have" | `handle_evidence_response(has_document=False)` - ask follow-up |
| "I'll provide later" | `handle_evidence_response(can_provide_later=True)` - move on |

**When user says something is "incorrect":**
1. Ask what specifically was incorrect: "What needs to be corrected?"
2. Update the facts: `update_case_facts(field, corrected_value)`
3. Confirm the correction verbally
4. THEN transition to the next document

**When you receive "[DOCUMENT UPLOADED]" message:**
⚠️ **STRICT RULES - FOLLOW EXACTLY:**
1. **DO NOT** call `handle_evidence_response()` - it was ALREADY called automatically!
2. Call `update_case_facts()` for **AT MOST 2 facts**:
   - For incident reports: `incident_date`, `injuries`, `employer_name`
   - For medical records: `injuries`, `injury_severity`
   - **FOR BILLING/BILLS**: `update_case_facts("medical_expenses", <total_amount>)` ← CRITICAL!
3. **SPEAK** to confirm findings: "I see the incident was on Feb 8th, 2026. Is that correct?"
4. **WAIT** for user confirmation
5. **AFTER user confirms**, call `request_evidence_upload()` **ONCE** for the next document

⚠️ **BILLING DOCUMENTS - ALWAYS EXTRACT THE TOTAL:**
When you see ANY billing document with a TOTAL or AMOUNT, you MUST call:
```
update_case_facts("medical_expenses", 17350.00)
```
Use the actual dollar amount from the document. This is REQUIRED for damages calculation!

⚠️ **ABSOLUTELY FORBIDDEN:**
- Calling `update_case_facts` more than 2 times per document
- Calling `request_evidence_upload` more than once per turn
- Calling any tool while user is still confirming facts

### Document Validation

If user uploads the wrong document, the Evidence Agent analysis will reveal this.
- **Wrong but related** (e.g., medical bill instead of ER records): Keep it, ask for correct doc
- **Completely irrelevant**: Ask how it relates, may discard if truly unrelated

### Phase 5: Calculate Damages

When user asks for settlement estimate OR when `check_intake_complete()` returns `WRAP_UP`:
1. Call `calculate_damages()` → **Damages Agent calculates using code execution**
2. Review the returned breakdown with the user
3. Explain factors affecting the estimate

The Damages Agent handles all the math - you just present the results conversationally.

### Phase 6: Final Summary & Session End
When user says "that's all", "wrap up", "calculate my settlement", or similar:
1. Call `check_intake_complete()` to verify - if returns WRAP_UP, proceed
2. Call `calculate_damages()` to get settlement estimate
3. Call `get_case_summary()` to generate final summary
4. Present summary to user with settlement range
5. Thank them and say "Your intake is now complete. An attorney will review your case."

## STOP CONDITIONS:
✅ Stop collecting evidence when `check_intake_complete()` returns `action: "WRAP_UP"`
✅ This means all items are either: collected, marked pending, or marked not available
✅ Do NOT keep asking after WRAP_UP - proceed to damages and summary
✅ When user asks for settlement estimate, call `calculate_damages()` immediately
✅ When user says "wrap up" or "that's all I have", call `check_intake_complete()` then `calculate_damages()`

## ⚠️ AVOID TOOL SPAM - HARD LIMITS:
- `update_case_facts()`: MAX **1-2 calls** per document. STOP after 2 calls and SPEAK.
- `request_evidence_upload()`: MAX **1 call** per turn. NEVER call again until user responds.
- `check_intake_complete()`: MAX **1 call** per turn
- **CRITICAL**: After ANY tool call, you MUST speak to the user BEFORE calling another tool
- **NEVER** call the same tool twice in a row - SPEAK FIRST
- **PHOTOS/IMAGES**: Just call `handle_evidence_response(has_document=True)` ONCE.
- If you called a tool, the NEXT action MUST be speaking to user, NOT another tool call

## ⚠️ HANDLING "I DON'T HAVE" RESPONSES:
When user says "I don't have this", "no photos", "I can't provide that":
1. Call `mark_evidence_not_available(item_id)` ONCE
2. Say "No problem, we'll proceed without it."
3. Call `check_intake_complete()` to see if we can wrap up
4. Do NOT keep asking for the same document
5. Do NOT call `request_evidence_upload()` again for the same item

## ⚠️ CRITICAL TOOL ORDER - NEVER SKIP STEPS:
- **NEVER** call `check_intake_complete()` before `initialize_case()` has been called
- **NEVER** call `calculate_damages()` before having collected any evidence
- **NEVER** call `get_case_summary()` before collecting evidence
- If user asks about process/progress but no case exists yet, EXPLAIN the process verbally - don't call status tools
- The flow is ALWAYS: initialize_case() → collect facts → collect documents → check_intake_complete → calculate_damages
- Call `update_case_facts()` for 2-3 key facts max, not every detail
- Call `request_evidence_upload()` ONCE after each document is processed

## Conversation Guidelines:
- Ask ONE question at a time
- Keep responses SHORT (2-3 sentences for voice)
- Show empathy ("I'm sorry to hear that", "That sounds difficult")
- NEVER provide legal advice - you're gathering information
- If interrupted, stop immediately and listen
- Summarize back to confirm understanding
- **ALWAYS verbally transition** between topics: "Great, now let's...", "Next, I'll need..."
- **ALWAYS acknowledge** user responses before moving on: "Thank you", "Got it", "No problem"
- **NEVER silently** show a document card without verbal context

## Important Rules:
- Save facts as you learn them using `update_case_facts()`
- Don't ask for evidence until you understand the basic situation
- Be patient with emotional clients

## CONVERSATION RULES:

**Be conversational, not mechanical:**
- Ask ONE question at a time
- Keep responses SHORT (2-3 sentences)
- Show empathy ("I'm sorry to hear that", "That sounds difficult")
- NEVER provide legal advice
- Confirm important details before moving on

**Document flow:**
1. Request document → Wait for response
2. Review Evidence Agent analysis → Save key facts  
3. Confirm with user → Then ask about next document

**Remember:** You ORCHESTRATE the process. Specialist agents do the analysis.
- Evidence Agent = Document analysis (RAG)
- Damages Agent = Settlement math (code execution)
- You = Conversation + coordination

You're helping someone who's been hurt. Be warm, professional, and thorough."""


# ==================== MODEL CONFIGURATION ====================

# For Live API (streaming voice): gemini-live-2.5-flash-native-audio
# For regular text chat: gemini-2.5-flash
LIVE_MODEL = "gemini-live-2.5-flash-native-audio"
CHAT_MODEL = "gemini-2.5-flash"


# ==================== CREATE AGENTS ====================

# Import sub-agents (lazy to avoid circular imports)
def _get_sub_agents():
    from app.agents.evidence_agent import evidence_agent
    from app.agents.damages_agent import damages_agent
    return evidence_agent, damages_agent


def calculate_damages() -> dict:
    """
    Calculate estimated damages and settlement range using the Damages Agent.
    
    This delegates to the Damages Agent which uses code execution for accurate math.
    
    Call this when:
    - User asks for settlement estimate
    - Intake is complete (after check_intake_complete returns WRAP_UP)
    - User wants to know case value
    
    Returns:
        Dict with damages breakdown and settlement estimates
    """
    # Import damages agent functions
    from app.agents.damages_agent import (
        get_case_damages_data,
        get_multiplier_guidance,
        execute_python_code,
        save_damages_calculation
    )
    
    # Get case data
    data = get_case_damages_data()
    medical = data.get("medical", {})
    employment = data.get("employment", {})
    injuries = data.get("injuries", {})
    
    medical_expenses = medical.get("expenses") or 0
    future_medical = medical.get("future_estimate") or 0
    lost_wages = employment.get("lost_wages") or 0
    days_missed = employment.get("days_missed") or 0
    severity = injuries.get("severity") or "moderate"  # Default if None
    
    # Get multiplier guidance from damages agent
    multiplier_info = get_multiplier_guidance(severity or "moderate")
    multiplier = multiplier_info.get("recommended_multiplier", 2.5)
    multiplier_range = multiplier_info.get("multiplier_range", "2.0 - 3.0")
    
    # Use code execution for accurate math (like damages_agent does)
    calculation_code = f"""
# Damages Calculation (executed by Damages Agent)
medical_expenses = {medical_expenses}
future_medical = {future_medical}
lost_wages = {lost_wages}

# Economic damages
economic_total = medical_expenses + future_medical + lost_wages

# Non-economic (pain & suffering)
multiplier = {multiplier}
non_economic = economic_total * multiplier

# Settlement range (±20%)
total = economic_total + non_economic
settlement_low = total * 0.8
settlement_high = total * 1.2

print(f"Economic: ${{economic_total:,.0f}}")
print(f"Non-Economic: ${{non_economic:,.0f}}")
print(f"Total: ${{total:,.0f}}")
print(f"Range: ${{settlement_low:,.0f}} - ${{settlement_high:,.0f}}")
"""
    
    result = execute_python_code(calculation_code)
    
    # Calculate values for response
    economic_total = medical_expenses + future_medical + lost_wages
    non_economic = economic_total * multiplier
    total = economic_total + non_economic
    settlement_low = total * 0.8
    settlement_high = total * 1.2
    
    # Save to evidence hub via damages agent
    save_damages_calculation(
        economic_damages=economic_total,
        non_economic_damages=non_economic,
        settlement_low=settlement_low,
        settlement_high=settlement_high
    )
    
    return {
        "status": "success",
        "calculated_by": "damages_agent",
        "code_execution_result": result.get("output", ""),
        "economic_damages": {
            "medical_expenses": medical_expenses,
            "future_medical": future_medical,
            "lost_wages": lost_wages,
            "days_missed_work": days_missed,
            "total": economic_total,
        },
        "non_economic_damages": {
            "severity": severity,
            "multiplier": multiplier,
            "multiplier_range": multiplier_range,
            "estimate": non_economic,
        },
        "settlement_range": {
            "low": f"${settlement_low:,.0f}",
            "mid": f"${total:,.0f}",
            "high": f"${settlement_high:,.0f}",
        },
        "say_to_user": f"Based on ${economic_total:,.0f} in economic damages and a {multiplier}x multiplier for {severity} injuries, your estimated settlement range is ${settlement_low:,.0f} to ${settlement_high:,.0f}."
    }


# Hub tools list - SIMPLIFIED to avoid tool loops
HUB_TOOLS = [
    initialize_case,
    update_case_facts,
    get_case_facts,
    get_evidence_checklist,
    request_evidence_upload,
    mark_evidence_pending,
    mark_evidence_not_available,
    handle_evidence_response,  # EASY: handles current item automatically
    # NOTE: validate_uploaded_document removed - causes infinite loops
    # NOTE: process_validated_upload removed - not needed with handle_evidence_response
    check_intake_complete,
    get_case_summary,
    calculate_damages,  # Calculate settlement estimate
]


# Create the root agent for ADK (text chat)
root_agent = Agent(
    name="lexie_root_agent",
    model=CHAT_MODEL,
    description="AI-powered legal intake assistant for personal injury cases",
    instruction=LIVE_AGENT_INSTRUCTION,
    tools=HUB_TOOLS,  
)

# Create a separate agent for live streaming (voice)
live_agent = Agent(
    name="lexie_live_agent",
    model=LIVE_MODEL,
    description="AI-powered legal intake assistant for personal injury cases",
    instruction=LIVE_AGENT_INSTRUCTION,
    tools=HUB_TOOLS,  
)


# Function to get agents with sub-agents attached (call after all agents are loaded)
def get_orchestrator_agent():
    """Get the root agent with sub-agents attached as tools."""
    evidence_agent, damages_agent = _get_sub_agents()
    
    return Agent(
        name="lexie_orchestrator",
        model=CHAT_MODEL,
        description="AI-powered legal intake assistant that orchestrates evidence and damages agents",
        instruction=LIVE_AGENT_INSTRUCTION,
        tools=HUB_TOOLS + [
            # NOTE: google_search removed - incompatible with AgentTool
            AgentTool(agent=evidence_agent),
            AgentTool(agent=damages_agent),
        ],
    )


# Export
__all__ = [
    "root_agent",
    "live_agent", 
    "get_orchestrator_agent",
    "LIVE_MODEL", 
    "CHAT_MODEL",
    "HUB_TOOLS",
]
