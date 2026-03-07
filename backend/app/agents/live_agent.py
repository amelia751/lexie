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
    Returns a message to prompt the user for the document.
    
    Args:
        evidence_type: Type of evidence (e.g., "medical_records", "photos")
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
    
    return {
        "status": "success",
        "evidence_id": item.id,
        "type": evidence_type,
        "description": description,
        "message": f"Please upload: {description}",
        "instruction": "Ask the user if they have this document available. If not now, mark as pending."
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


def handle_evidence_response(has_document: bool, can_provide_later: bool = False) -> dict:
    """
    Handle user's response about the CURRENT evidence item being discussed.
    
    CALL THIS IMMEDIATELY after asking user about an evidence item.
    Returns follow-up questions to ask based on the evidence type and response.
    
    Args:
        has_document: True if user says they have the document (yes/I have it)
        can_provide_later: True if user says they can get it later (not now but I can get it)
    
    Returns:
        Dict with result, next item, and FOLLOW-UP QUESTIONS to ask
    """
    # Get the current item being discussed (first REQUIRED item)
    current_item = evidence_hub.get_next_required_evidence()
    
    if not current_item:
        return {
            "status": "no_pending_items",
            "message": "All evidence items have been addressed!",
            "action": "PROCEED_TO_SUMMARY"
        }
    
    # Determine status based on response
    if has_document or can_provide_later:
        evidence_hub.update_evidence_status(current_item.id, EvidenceStatus.PENDING)
        new_status = "pending"
    else:
        evidence_hub.update_evidence_status(current_item.id, EvidenceStatus.NOT_AVAILABLE)
        new_status = "not_available"
    
    # Generate follow-up questions based on evidence type
    follow_up = _get_follow_up_questions(current_item.type, new_status, can_provide_later)
    
    # Get the NEXT item to ask about
    next_item = evidence_hub.get_next_required_evidence()
    checklist_status = evidence_hub.get_checklist_status()
    
    return {
        "status": "success",
        "processed_item": current_item.description,
        "processed_type": current_item.type,
        "marked_as": new_status,
        "follow_up": follow_up,  # Questions to ask based on response
        "remaining_items": checklist_status["required"],
        "next_item": {
            "id": next_item.id,
            "description": next_item.description,
            "priority": next_item.priority.value
        } if next_item else None,
        "action": "ASK_NEXT" if next_item else "PROCEED_TO_SUMMARY"
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
    
    Args:
        case_type: Type of case - "construction_fall", "workplace_injury", etc.
        session_id: Optional session identifier
    
    Returns:
        Dict confirming initialization
    """
    evidence_hub.reset()
    
    if session_id:
        evidence_hub.set_session(session_id)
    
    case_type_lower = case_type.lower().replace(" ", "_")
    
    if case_type_lower in ["construction_fall", "construction", "fall_from_height", "scaffold"]:
        evidence_hub.initialize_construction_fall_checklist()
    else:
        evidence_hub.initialize_generic_workplace_checklist()
    
    return {
        "status": "success",
        "case_type": evidence_hub._case_type,
        "evidence_items": len(evidence_hub.checklist),
        "message": f"Case initialized as {evidence_hub._case_type} with {len(evidence_hub.checklist)} evidence items to gather."
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

Advanced tools (usually not needed):
- `mark_evidence_pending(id)` - Mark specific item by ID
- `mark_evidence_not_available(id)` - Mark specific item by ID
- `request_evidence_upload(type, description)` - Request specific document

### Sub-Agents (available when using orchestrator):
Note: Sub-agents are only available with get_orchestrator_agent(), not root_agent.
- `evidence_agent` - Analyze uploaded documents and images  
- `damages_agent` - Calculate settlement estimates

## INTAKE FLOW (FOLLOW THIS STRICTLY):

### Phase 1: Understand the Situation
1. Greet warmly, ask how they're doing
2. Ask what happened (incident description)
3. Ask when and where it happened
4. Determine case type from description

### Phase 2: Initialize Case
Call `initialize_case(case_type)` to create the evidence checklist.

### Phase 3: Gather Key Facts
Save facts as you learn them with `update_case_facts(field, value)`:
- `plaintiff_name`, `plaintiff_age`, `plaintiff_occupation`
- `employer_name`
- `incident_date`, `incident_location`, `incident_description`
- `injuries` (list), `injury_severity` (minor/moderate/serious/severe)
- `medical_expenses`, `days_missed_work`, `lost_wages`

### Phase 4: Evidence Collection Loop

**RULE: EVERY time user answers about evidence, you MUST call handle_evidence_response()**

The loop:
1. Get checklist: `get_evidence_checklist()` → shows next required item
2. Ask: "Do you have [item]?"
3. User answers → **IMMEDIATELY CALL** `handle_evidence_response()`:
   - "Yes/I have it" → `handle_evidence_response(has_document=True)`
   - "No/Don't have" → `handle_evidence_response(has_document=False)`
   - "Can get later" → `handle_evidence_response(has_document=False, can_provide_later=True)`

4. **AFTER marking, ask FOLLOW-UP QUESTIONS based on response:**

   **If "NO" (doesn't have document):**
   - Ask for the KEY DETAILS that document would contain
   - Example: No incident report → "Can you tell me the exact date, time, and location? Who else was there?"
   - Example: No medical records → "What injuries were diagnosed? Who was the treating physician?"
   - Save these details with `update_case_facts()` - they're verbal testimony
   
   **If "WILL PROVIDE LATER":**
   - Still ask clarifying questions for preliminary info
   - Note: "These details may be updated when we receive the actual document"
   - Mark facts as preliminary in your response
   
   **If "YES" (has document):**
   - When user shares document content, EXTRACT key facts
   - COMPARE with previously recorded facts
   - If DISPARITY found → "I notice the document says [X] but you mentioned [Y]. Which is correct?"
   - Update facts only AFTER user confirms

5. Check the result's `action`:
   - "ASK_NEXT" → ask about `next_item`
   - "PROCEED_TO_SUMMARY" → done, go to Phase 5

**⚠️ NEVER just mark and move on - ALWAYS gather details even if no document!**
**⚠️ When evidence contradicts user's verbal info, ASK to confirm before updating.**

### Phase 5: Summarize & Wrap Up
- Call `get_case_summary()` to generate the final case summary
- Present the summary to the user including all evidence status
- If damages calculation is needed, it requires the orchestrator agent

### Phase 6: Final Summary & End
- Call `get_case_summary()` to generate final summary
- Present to user: collected evidence, pending items, damage estimate
- Ask if anything needs correction
- Thank them and END the conversation

## STOP CONDITIONS:
✅ Stop collecting evidence when `check_intake_complete()` returns `action: "WRAP_UP"`
✅ This means all items are either: collected, marked pending, or marked not available
✅ Do NOT keep asking after WRAP_UP - proceed to damages and summary

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
1. When user says YES/NO about evidence → call `handle_evidence_response()` IMMEDIATELY
2. NEVER skip the tool call - don't just acknowledge, CALL THE TOOL
3. After each tool call, ask about the `next_item` returned

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
    check_intake_complete,
    get_case_summary,
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
