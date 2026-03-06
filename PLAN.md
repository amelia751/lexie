# Lexie Multi-Agent Architecture Plan

## Overview

Lexie is an AI-powered legal intake system for workplace injury cases. It uses Google ADK with specialized agents that collaborate to conduct intake interviews, analyze evidence, and calculate case damages.

---

## Agent Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      EVIDENCE HUB (State Service)                   │
│                                                                     │
│  • evidence_checklist: [{type, status, priority, document_id}]     │
│  • case_facts: {incident, injuries, witnesses, damages...}         │
│  • case_summary: auto-generated from facts                         │
│  • checklist templates: construction_fall, workplace_injury        │
└─────────────────────────────────────────────────────────────────────┘
        ▲                         ▲                         ▲
        │                         │                         │
┌───────┴────────┐       ┌────────┴───────┐       ┌────────┴───────┐
│  LIVE AGENT    │       │ EVIDENCE AGENT │       │    DAMAGES     │
│    (Root)      │       │                │       │   CALCULATOR   │
│                │       │                │       │                │
│ • Voice/text   │       │ • RAG search   │       │ • Code exec    │
│ • Hub tools    │       │ • Vision       │       │ • Multipliers  │
│ • google_search│       │ • Doc summary  │       │ • Settlement   │
│ • Orchestrates │       │                │       │                │
└────────────────┘       └────────────────┘       └────────────────┘
        │                                                   │
        └─────────────── AgentTool ─────────────────────────┘
```

---

## Services

| Service | Purpose | Key Methods |
|---------|---------|-------------|
| `evidence_hub.py` | Central state management | `initialize_case()`, `update_fact()`, `get_summary()` |
| `rag_service.py` | Document search (Vertex AI RAG) | `retrieve()`, `grounded_generate()` |
| `vision_service.py` | Image analysis (Gemini 2.5 Flash Image) | `analyze(image, prompt)` |
| `gemini_live_service.py` | Voice streaming (WebSocket) | `run_live_session()` |

---

## Agent Specifications

### 1. Lexie Live Agent (Root)

**Purpose:** Voice/text-facing intake assistant that orchestrates the conversation

**Models:** 
- Voice: `gemini-live-2.5-flash-native-audio`
- Text: `gemini-2.5-flash`

**Tools:**

| Tool | Purpose |
|------|---------|
| `initialize_case(case_type)` | Start new case, create evidence checklist |
| `update_case_facts(field, value)` | Save gathered information |
| `get_case_facts()` | Retrieve current facts |
| `get_evidence_checklist()` | See what's needed/uploaded |
| `request_evidence_upload(type, desc)` | Ask user for document |
| `mark_evidence_pending(id)` | User will provide later |
| `mark_evidence_not_available(id)` | User doesn't have it |
| `get_case_summary()` | Generate case summary |
| `google_search` | Research OSHA, legal info |
| `evidence_agent` (AgentTool) | Analyze documents/images |
| `damages_agent` (AgentTool) | Calculate settlement |

---

### 2. Evidence Analysis Agent

**Purpose:** Analyzes uploaded documents and images

**Model:** `gemini-2.5-flash`

**Tools:**

| Tool | Purpose |
|------|---------|
| `search_evidence(query)` | RAG search across documents |
| `get_document_summary(name)` | Summarize specific document |
| `list_evidence_files()` | List corpus files |
| `analyze_case_evidence(aspect)` | Analyze injuries, liability, etc. |
| `analyze_image(path, prompt)` | Vision analysis (photos/X-rays) |

**Services Used:**
- `rag_service` - Vertex AI RAG Engine
- `vision_service` - Gemini 2.5 Flash Image

---

### 3. Damages Calculator Agent

**Purpose:** Computes case valuation using code execution

**Model:** `gemini-2.5-flash` with `BuiltInCodeExecutor`

**Tools:**

| Tool | Purpose |
|------|---------|
| `get_case_damages_data()` | Get data from hub |
| `save_damages_calculation(...)` | Save results to hub |
| `get_multiplier_guidance(severity)` | Get pain/suffering multiplier |
| `calculate_lost_wages(...)` | Lost wages formula |

**Code Execution:** Agent writes Python code for all math calculations - no hallucinated numbers.

---

## Evidence Hub Details

### Case Facts Structure

```python
CaseFacts:
    # Plaintiff
    plaintiff_name, plaintiff_age, plaintiff_occupation
    
    # Employer
    employer_name, employer_type
    
    # Incident
    incident_date, incident_location, incident_description, incident_type
    
    # Injuries
    injuries: list, injury_severity (minor/moderate/serious/severe)
    
    # Medical
    medical_providers: list, medical_expenses, future_medical_estimate
    
    # Employment Impact
    days_missed_work, lost_wages, can_return_to_work, work_restrictions
    
    # Other
    witnesses: list, safety_violations: list, osha_citations: list
    workers_comp_filed, workers_comp_claim_number
    
    # Calculated Damages
    economic_damages, non_economic_damages, total_damages_estimate
    settlement_range_low, settlement_range_high
```

### Evidence Checklist (Construction Fall)

| Type | Description | Priority |
|------|-------------|----------|
| incident_report | Employer's incident/accident report | Critical |
| medical_records_er | Emergency room records | Critical |
| medical_records_primary | Primary care/specialist records | Critical |
| witness_statements | Written statements from witnesses | Important |
| photos_scene | Photos of accident scene | Important |
| photos_injuries | Photos of injuries | Important |
| employment_records | Pay stubs showing wages | Important |
| safety_training | Training records/certifications | Important |
| workers_comp_claim | Workers' comp documents | Important |
| osha_report | OSHA investigation report | Helpful |
| medical_imaging | X-rays, MRI, CT scans | Helpful |
| physical_therapy | PT records | Helpful |
| medical_bills | Bills and invoices | Helpful |

---

## Implementation Status

### Phase 1: Core Setup ✅
- [x] Backend structure (FastAPI)
- [x] Live agent with voice streaming
- [x] WebSocket endpoint for real-time audio
- [x] Frontend test page with transcription
- [x] Interruption handling

### Phase 2: Evidence System ✅
- [x] Evidence Hub service (state management)
- [x] Evidence Analysis Agent
- [x] RAG integration (Vertex AI RAG Engine)
- [x] Vision integration (gemini-2.5-flash-image)

### Phase 3: Damages Calculation ✅
- [x] Damages Calculator Agent
- [x] Code execution for math (BuiltInCodeExecutor)
- [x] Multiplier guidance
- [x] Save to hub

### Phase 4: Agent Orchestration ✅
- [x] Hub tools for Live Agent
- [x] Sub-agents as AgentTool
- [x] Simplified to 3 agents

### Phase 5: UI Integration ⏳
- [ ] Case dashboard
- [ ] Evidence upload interface
- [ ] Real-time transcript display
- [ ] Settlement estimate display

---

## File Structure

```
backend/
├── app/
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── live_agent.py         # Root agent + hub tools
│   │   ├── evidence_agent.py     # Document/image analysis
│   │   └── damages_agent.py      # Settlement calculation
│   ├── services/
│   │   ├── evidence_hub.py       # Central state ⭐
│   │   ├── rag_service.py        # Vertex AI RAG
│   │   ├── vision_service.py     # Gemini Vision
│   │   └── gemini_live_service.py
│   └── routers/
│       └── gemini_live.py
├── evidence/                     # Test evidence files
└── tests/
```

---

## Demo Flow

```
1. User calls Lexie
   └─> Live Agent greets, asks about incident

2. User describes construction fall
   └─> Live Agent: update_case_facts(incident_description, ...)
   └─> Live Agent: initialize_case("construction_fall")

3. Gather facts incrementally
   └─> Live Agent asks questions, saves with update_case_facts()

4. Gather evidence one by one
   └─> Live Agent: request_evidence_upload(...)
   └─> User uploads → evidence_agent analyzes

5. Calculate damages
   └─> Live Agent → damages_agent (code execution)

6. Generate summary
   └─> Live Agent: get_case_summary()
```

---

## Success Criteria

- [ ] Voice conversation feels natural and empathetic
- [ ] Interruption works instantly (< 200ms)
- [ ] Evidence checklist initializes correctly
- [ ] Facts saved incrementally as gathered
- [ ] Document analysis works end-to-end
- [ ] Damages calculation uses code execution
- [ ] Settlement range is realistic
- [ ] Demo runs reliably
