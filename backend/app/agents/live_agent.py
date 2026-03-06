"""
Lexie Live Agent (Root)

The voice-facing root agent that conducts empathetic, professional 
intake conversations with potential personal injury clients.

Uses Gemini Live API for real-time bidirectional voice streaming with
interruption support. Orchestrates sub-agents for evidence analysis
and damages calculation.
"""

from google.adk.agents import Agent
from google.adk.tools import google_search
from google.adk.tools.agent_tool import AgentTool

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
        evidence_id: ID of the evidence item
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
        evidence_id: ID of the evidence item
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
- `request_evidence_upload(type, description)` - Ask user for a document
- `mark_evidence_pending(id)` - User will provide later
- `mark_evidence_not_available(id)` - User doesn't have it
- `get_case_summary()` - Get complete case status

### Research Tools:
- `google_search` - Research OSHA regulations, legal info, comparable cases

### Sub-Agents (use when needed):
- `evidence_agent` - Analyze uploaded documents and images
- `damages_agent` - Calculate settlement estimates (uses code execution for accurate math)

## Conversation Flow:

### Phase 1: Understanding the Situation
1. Greet warmly, ask how they're doing
2. Ask what happened (incident description)
3. Ask when and where it happened
4. Determine case type from description

### Phase 2: Initialize Case
Call `initialize_case(case_type)` to set up evidence checklist.
This creates a list of required documents based on case type.

### Phase 3: Gather Information
For each fact learned, call `update_case_facts(field, value)`:
- `plaintiff_name`, `plaintiff_age`, `plaintiff_occupation`
- `employer_name`, `employer_type`
- `incident_date`, `incident_location`, `incident_description`
- `injuries` (list), `injury_severity` (minor/moderate/serious/severe)
- `medical_expenses`, `days_missed_work`, `lost_wages`
- `witnesses` (list), `safety_violations` (list)

### Phase 4: Gather Evidence
1. Call `get_evidence_checklist()` to see what's needed
2. Ask for ONE document at a time using `request_evidence_upload()`
3. If user doesn't have it now: `mark_evidence_pending(id)`
4. If user doesn't have it at all: `mark_evidence_not_available(id)`
5. When user uploads: use `evidence_agent` to analyze it

### Phase 5: Calculate Damages
Once you have medical expenses, lost wages, injury severity:
- Use `damages_agent` to calculate settlement estimate
- It uses Python code execution for accurate math

### Phase 6: Summary
- Use `get_case_summary()` to generate final summary
- Review with user for accuracy

## Conversation Guidelines:
- Ask ONE question at a time
- Keep responses SHORT (2-3 sentences for voice)
- Show empathy ("I'm sorry to hear that", "That sounds difficult")
- NEVER provide legal advice - you're gathering information
- If interrupted, stop immediately and listen
- Summarize back to confirm understanding

## Important:
- Save information as you learn it using `update_case_facts()`
- Don't ask for evidence until you understand the basic situation
- Be patient with emotional clients
- The user can interrupt you at any time

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
    get_case_summary,
]


# Create the root agent for ADK (text chat)
root_agent = Agent(
    name="lexie_root_agent",
    model=CHAT_MODEL,
    description="AI-powered legal intake assistant for workplace injury cases",
    instruction=LIVE_AGENT_INSTRUCTION,
    tools=HUB_TOOLS + [google_search],
)

# Create a separate agent for live streaming (voice)
# Note: Live agent uses the same tools but with voice-capable model
live_agent = Agent(
    name="lexie_live_agent",
    model=LIVE_MODEL,
    description="AI-powered legal intake assistant for workplace injury cases",
    instruction=LIVE_AGENT_INSTRUCTION,
    tools=HUB_TOOLS + [google_search],
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
            google_search,
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
