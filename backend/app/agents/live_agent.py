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
        case_type: Type of case - "construction_fall", "workplace_injury", etc.
        session_id: Optional session identifier
    
    Returns:
        Dict confirming initialization with first document to collect
    """
    evidence_hub.reset()
    
    if session_id:
        evidence_hub.set_session(session_id)
    
    case_type_lower = case_type.lower().replace(" ", "_")
    
    if case_type_lower in ["construction_fall", "construction", "fall_from_height", "scaffold"]:
        evidence_hub.initialize_construction_fall_checklist()
    else:
        evidence_hub.initialize_generic_workplace_checklist()
    
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

LIVE_AGENT_INSTRUCTION = """You are Lexie, an AI-powered legal intake assistant for workplace injury cases.
Your role is to conduct empathetic, professional intake conversations with injured workers.

## Your Role:
You are the primary point of contact. You gather information, coordinate with specialist agents,
and guide the user through the intake process step by step.

## Your Tools:

### Hub Tools - Manage case state and evidence:
- `initialize_case(case_type)` - Start a new case (e.g., "construction_fall", "workplace_injury")
- `update_case_facts(field, value)` - Save information as you learn it
- `get_case_facts()` - See what facts have been gathered
- `get_evidence_checklist()` - See what evidence is needed/uploaded
- `handle_evidence_response(has_document, can_provide_later)` - **USE THIS** to record user's response about evidence
- `check_intake_complete()` - Check if all evidence has been addressed
- `get_case_summary()` - Get complete case status

Document collection tools (USE IN THIS ORDER):
1. `request_evidence_upload(type, description)` - **Call this when asking for a document** (shows upload card)
2. `handle_evidence_response(has_document, can_provide_later)` - **Call after user responds via card**

Manual tools (rarely needed):
- `mark_evidence_pending(id)` - Mark specific item by ID
- `mark_evidence_not_available(id)` - Mark specific item by ID

### Sub-Agents (available when using orchestrator):
Note: Sub-agents are only available with get_orchestrator_agent(), not root_agent.
- `evidence_agent` - Analyze uploaded documents and images  
- `damages_agent` - Calculate settlement estimates

## INTAKE FLOW (FOLLOW THIS STRICTLY):

### Phase 1: Understand the Situation & IMMEDIATELY Initialize
1. Greet warmly, ask how they're doing
2. As SOON as user describes their injury (e.g., "fell at construction site", "hurt at work"):
   - **IMMEDIATELY call `initialize_case(case_type)`** - DO NOT wait!
   - This creates the checklist AND shows the upload card for the first document
3. You can ask follow-up questions AFTER initializing

**CRITICAL**: The moment you know this is a workplace injury case, call `initialize_case()`.
- User says "I fell at work" → call `initialize_case("workplace_injury")`
- User says "construction site fall" → call `initialize_case("construction_fall")`  
- User says "I got hurt at my job" → call `initialize_case("workplace_injury")`
- DO NOT wait to "gather more info" - initialize FIRST, details LATER

### Phase 2: Gather & SAVE Facts Through Conversation
After initializing, ACTIVELY gather AND SAVE information:

**⚠️ CRITICAL: CALL `update_case_facts()` IMMEDIATELY when you learn ANY information!**

As user speaks, IMMEDIATELY call `update_case_facts(field, value)` for EACH fact:
- User says "I fell on February 8th" → `update_case_facts("incident_date", "2024-02-08")`
- User says "at Riverside Medical Plaza" → `update_case_facts("incident_location", "Riverside Medical Plaza, CA")`
- User says "I broke my wrist and got a concussion" → `update_case_facts("injuries", ["wrist fracture", "concussion"])`
- User says "My name is John" → `update_case_facts("plaintiff_name", "John")`

**Fields to populate (call update_case_facts for EACH):**
- `plaintiff_name` - Their name
- `employer_name` - Where they work
- `incident_date` - When it happened (format: "YYYY-MM-DD" or "February 8, 2024")
- `incident_location` - Where it happened
- `incident_description` - Brief description of what happened
- `injuries` - List of injuries like ["wrist fracture", "concussion", "back injury"]
- `injury_severity` - One of: "minor", "moderate", "serious", "severe"

**YOU MUST call update_case_facts MULTIPLE TIMES per conversation turn if you learn multiple facts!**

### Phase 3: Document Collection & Analysis

## ⚠️⚠️⚠️ MANDATORY ACTIONS WHEN DOCUMENTS ARE UPLOADED ⚠️⚠️⚠️

When you see "[DOCUMENT UPLOADED]", you MUST do ALL of these:
1. Call `handle_evidence_response(has_document=True, document_uploaded=True)` - Updates UI
2. "Analyze" the document and EXTRACT FACTS:
   - For incident report: incident_date, incident_location, incident_description, employer_name
   - For medical records: injuries, injury_severity, medical_expenses, medical_providers
   - For pay stubs: lost_wages, days_missed_work
3. Call `update_case_facts()` for EACH extracted fact!
4. Then confirm findings with user

**Example document upload flow:**
```
User: [DOCUMENT UPLOADED] incident report
You: 
1. Call handle_evidence_response(has_document=True, document_uploaded=True)
2. Say "Thank you! I'm reviewing the incident report now..."
3. Call update_case_facts("incident_date", "2024-02-08")
4. Call update_case_facts("incident_location", "Riverside Medical Plaza")
5. Call update_case_facts("incident_description", "Fall from scaffolding, approximately 15 feet")
6. Say "I see from the report that the incident occurred on February 8th at Riverside Medical Plaza. Is that correct?"
```

**Document Response Rules:**
| User Message | Tool Call |
|--------------|-----------|
| "[DOCUMENT UPLOADED] ..." | `handle_evidence_response(has_document=True, document_uploaded=True)` |
| "Yes I have it" | `handle_evidence_response(has_document=True)` |
| "No I don't have" | `handle_evidence_response(has_document=False)` |
| "I'll provide later" | `handle_evidence_response(can_provide_later=True)` |

**Evidence types for construction fall:**
- `incident_report` - Employer's incident/accident report (CRITICAL)
- `medical_records_er` - Emergency room records (CRITICAL)  
- `medical_records_primary` - Follow-up doctor records (CRITICAL)
- `witness_statements` - Witness statements (IMPORTANT)
- `photos_scene` - Photos of accident scene (IMPORTANT)

## 📋 SAMPLE CASE FACTS FOR DEMO (Use when "analyzing" documents)

When a document is uploaded, "extract" and save these facts using `update_case_facts()`:

**From Incident Report:**
- `plaintiff_name`: "Maria Santos"
- `employer_name`: "Titan Construction"
- `incident_date`: "2024-02-08"
- `incident_location`: "Riverside Medical Plaza, Riverside, CA"
- `incident_description`: "Fall from scaffolding (approximately 15 feet) while installing drywall. Missing guardrails and no safety harness provided."

**From Medical Records:**
- `injuries`: ["right wrist fracture", "concussion", "lumbar spine injury", "contusions"]
- `injury_severity`: "severe"
- `medical_expenses`: 67000
- `future_medical_estimate`: 45000

**From Employment Records:**
- `plaintiff_occupation`: "Carpenter"
- `days_missed_work`: 112
- `lost_wages`: 28672  # ($32/hr × 40hr/wk × 16 weeks + future 6 weeks)

**From Witness Statements:**
- `witnesses`: ["Carlos Rodriguez (coworker)", "Jimmy Chen (electrician)"]

**From OSHA Report:**
- `safety_violations`: ["Missing guardrails on scaffolding", "No fall protection provided", "Inadequate safety training"]

**Example: When user uploads incident report:**
```
1. handle_evidence_response(has_document=True, document_uploaded=True)
2. update_case_facts("plaintiff_name", "Maria Santos")
3. update_case_facts("employer_name", "Titan Construction") 
4. update_case_facts("incident_date", "2024-02-08")
5. update_case_facts("incident_location", "Riverside Medical Plaza, Riverside, CA")
6. update_case_facts("incident_description", "Fall from scaffolding, approximately 15 feet, while installing drywall")
7. Say: "I've reviewed the incident report. It shows Maria Santos fell from scaffolding at Riverside Medical Plaza on February 8th. Is that correct?"
```

### Document Validation (IMPORTANT!)

When user UPLOADS a document, validate it matches what was requested:

1. Call `validate_uploaded_document(type, description)` with what the document appears to be
2. Based on result, call `process_validated_upload(result, keep, new_type)`:

**If "correct"** - Document matches request:
- `process_validated_upload("correct")` - Accepts and moves to next document

**If "wrong_but_related"** - Wrong doc but useful (e.g., asked for insurance, got medical bill):
- Say: "Thank you, I'll keep this [uploaded type] on file. However, I still need the [requested doc]. Do you have that?"
- `process_validated_upload("wrong_but_related", keep_document=True, new_evidence_type="[type]")`

**If "wrong_irrelevant"** - Completely unrelated document:
- Say: "I'm not sure how this document relates to your case. Can you help me understand?"
- If user can't explain → `process_validated_upload("wrong_irrelevant")` and re-request

5. Check the result's `action`:
   - "ASK_NEXT" → ask about `next_item`
   - "PROCEED_TO_SUMMARY" → done, go to Phase 5

**⚠️ NEVER just mark and move on - ALWAYS gather details even if no document!**
**⚠️ When evidence contradicts user's verbal info, ASK to confirm before updating.**
**⚠️ ALWAYS validate uploaded documents match what was requested!**

### Phase 5: Calculate Damages & Settlement Estimate
When user asks for settlement estimate OR when intake is complete:
1. Call `calculate_damages()` - this computes the settlement range
2. Present the breakdown:
   - Economic damages (medical + lost wages)
   - Non-economic damages (pain & suffering)
   - Settlement range (low/mid/high)
3. Explain factors affecting the estimate

### Phase 6: Final Summary & End
- Call `get_case_summary()` to generate final summary
- Present to user: collected evidence, pending items, damage estimate
- Ask if anything needs correction
- Thank them and END the conversation

## STOP CONDITIONS:
✅ Stop collecting evidence when `check_intake_complete()` returns `action: "WRAP_UP"`
✅ This means all items are either: collected, marked pending, or marked not available
✅ Do NOT keep asking after WRAP_UP - proceed to damages and summary
✅ When user asks for settlement estimate, call `calculate_damages()` immediately

## Conversation Guidelines:
- Ask ONE question at a time
- Keep responses SHORT (2-3 sentences for voice)
- Show empathy ("I'm sorry to hear that", "That sounds difficult")
- NEVER provide legal advice - you're gathering information
- If interrupted, stop immediately and listen
- Summarize back to confirm understanding

## Important Rules:
- Save facts as you learn them using `update_case_facts()`
- Don't ask for evidence until you understand the basic situation
- Be patient with emotional clients

## ⚠️ TOOL CALLING RULES (MUST FOLLOW):
1. Call `request_evidence_upload(type, desc)` to show the upload card
2. Ask conversationally about that specific document
3. When user responds → call `handle_evidence_response()`
4. If document uploaded → ANALYZE IT, update facts, confirm with user
5. ONLY THEN call `request_evidence_upload()` for the NEXT document

## IMPORTANT: Document Processing Flow
When a document is uploaded:
1. Acknowledge the upload: "Thank you for providing that"
2. Extract key facts and update the case: `update_case_facts("incident_date", "February 8, 2024")`
3. Confirm findings with user: "I see from the report that X happened. Is that accurate?"
4. WAIT for user to confirm before moving on
5. Then ask about the next document

## PRIORITY: Be conversational, not mechanical!
- Take time to process each document
- Confirm important details with the user
- Don't show the next document card until you've finished discussing the current one
- The user should feel like they're having a conversation, not filling out a form

Remember: You're helping someone who's been hurt. Be warm, professional, and thorough."""


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
    Calculate estimated damages and settlement range for the case.
    
    Uses the case facts to compute:
    - Economic damages (medical expenses + lost wages)
    - Non-economic damages (pain & suffering based on severity multiplier)
    - Settlement range (low/mid/high estimates)
    
    Call this when:
    - User asks for settlement estimate
    - Intake is complete (after check_intake_complete returns WRAP_UP)
    - User wants to know case value
    
    Returns:
        Dict with damages breakdown and settlement estimates
    """
    facts = evidence_hub.get_facts()
    
    # Extract financial facts
    medical = facts.get("medical", {})
    employment = facts.get("employment_impact", {})
    injuries = facts.get("injuries", {})
    
    medical_expenses = medical.get("expenses", 0) or 0
    future_medical = medical.get("future_estimate", 0) or 0
    lost_wages = employment.get("lost_wages", 0) or 0
    days_missed = employment.get("days_missed", 0) or 0
    
    # Calculate economic damages
    economic_total = medical_expenses + future_medical + lost_wages
    
    # Determine multiplier based on severity
    severity = injuries.get("severity", "moderate")
    if severity == "minor":
        multiplier_low, multiplier_high = 1.5, 2.0
    elif severity == "moderate":
        multiplier_low, multiplier_high = 2.0, 3.0
    elif severity == "serious":
        multiplier_low, multiplier_high = 3.0, 4.0
    else:  # severe
        multiplier_low, multiplier_high = 4.0, 5.0
    
    # Calculate non-economic (pain & suffering)
    non_economic_low = economic_total * multiplier_low
    non_economic_high = economic_total * multiplier_high
    non_economic_mid = (non_economic_low + non_economic_high) / 2
    
    # Calculate totals
    total_low = economic_total + non_economic_low
    total_mid = economic_total + non_economic_mid
    total_high = economic_total + non_economic_high
    
    # Store in evidence hub (individual fields, not a dict)
    evidence_hub.update_fact("economic_damages", economic_total)
    evidence_hub.update_fact("non_economic_damages", non_economic_mid)
    evidence_hub.update_fact("total_damages_estimate", total_mid)
    evidence_hub.update_fact("settlement_range_low", total_low)
    evidence_hub.update_fact("settlement_range_high", total_high)
    
    return {
        "status": "success",
        "economic_damages": {
            "medical_expenses": medical_expenses,
            "future_medical": future_medical,
            "lost_wages": lost_wages,
            "days_missed_work": days_missed,
            "total": economic_total,
        },
        "non_economic_damages": {
            "severity": severity,
            "multiplier_range": f"{multiplier_low}x - {multiplier_high}x",
            "estimate_low": non_economic_low,
            "estimate_high": non_economic_high,
        },
        "settlement_range": {
            "low": f"${total_low:,.0f}",
            "mid": f"${total_mid:,.0f}",
            "high": f"${total_high:,.0f}",
        },
        "explanation": f"Based on ${economic_total:,.0f} in economic damages with a {multiplier_low}-{multiplier_high}x multiplier for {severity} injuries.",
        "say_to_user": f"Based on your medical expenses of ${medical_expenses:,.0f}, future medical needs of ${future_medical:,.0f}, and lost wages of ${lost_wages:,.0f}, your estimated settlement range is ${total_low:,.0f} to ${total_high:,.0f}. The midpoint estimate is ${total_mid:,.0f}."
    }


# Hub tools list
HUB_TOOLS = [
    initialize_case,
    update_case_facts,
    get_case_facts,
    get_evidence_checklist,
    request_evidence_upload,
    mark_evidence_pending,
    mark_evidence_not_available,
    handle_evidence_response,  # EASY: handles current item automatically
    validate_uploaded_document,  # Check if uploaded doc matches request
    process_validated_upload,  # Take action based on validation
    check_intake_complete,
    get_case_summary,
    calculate_damages,  # Calculate settlement estimate
]


# Create the root agent for ADK (text chat)
# NOTE: google_search cannot be mixed with custom function tools in Vertex AI
# Removed google_search to avoid "Multiple tools are supported only when they are all search tools" error
root_agent = Agent(
    name="lexie_root_agent",
    model=CHAT_MODEL,
    description="AI-powered legal intake assistant for workplace injury cases",
    instruction=LIVE_AGENT_INSTRUCTION,
    tools=HUB_TOOLS,  # No google_search - incompatible with function tools
)

# Create a separate agent for live streaming (voice)
live_agent = Agent(
    name="lexie_live_agent",
    model=LIVE_MODEL,
    description="AI-powered legal intake assistant for workplace injury cases",
    instruction=LIVE_AGENT_INSTRUCTION,
    tools=HUB_TOOLS,  # No google_search - incompatible with function tools
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
