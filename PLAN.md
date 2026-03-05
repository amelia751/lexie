# Lexie Multi-Agent Architecture Plan

## Overview

Lexie is an AI-powered legal intake system for workplace injury cases. It uses Google ADK with multiple specialized agents that collaborate to conduct intake interviews, analyze evidence, research legal precedents, and calculate case damages.

---

## Agent Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER (Voice/Text)                           │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    LEXIE LIVE AGENT (Root)                          │
│                                                                     │
│  • Model: gemini-live-2.5-flash-native-audio                        │
│  • Real-time voice streaming with interruption support              │
│  • Conducts empathetic intake conversations                         │
│  • Orchestrates sub-agents via AgentTool                            │
└─────────────────────────────────────────────────────────────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
│ EVIDENCE ANALYSIS │ │  LEGAL RESEARCH   │ │ DAMAGES CALCULATOR│
│      AGENT        │ │      AGENT        │ │      AGENT        │
│                   │ │                   │ │                   │
│ • Parses docs     │ │ • Google Search   │ │ • Economic damages│
│ • Extracts facts  │ │ • OSHA regs       │ │ • Pain & suffering│
│ • Flags gaps      │ │ • Case precedents │ │ • Settlement range│
│ • Summarizes      │ │ • SOL checking    │ │ • Lien analysis   │
└───────────────────┘ └───────────────────┘ └───────────────────┘
```

---

## Agent Specifications

### 1. Lexie Live Agent (Root)

**Purpose:** Voice-facing intake assistant that talks directly to plaintiffs

**Model:** `gemini-live-2.5-flash-native-audio`

**Capabilities:**
- Real-time bidirectional voice streaming
- Interruption handling (VAD-based)
- Empathetic, professional conversation
- Orchestrates sub-agents based on conversation context

**Key Behaviors:**
- Asks ONE question at a time
- Keeps responses SHORT (2-3 sentences)
- Shows empathy and compassion
- Never provides legal advice
- Summarizes information back to user

**Information Gathered:**
- Incident details (date, location, how it happened)
- Injuries and medical treatment
- Impact on life (lost wages, pain)
- Available evidence
- Witness information
- Insurance details

**Tools:**
- `evidence_analysis_agent` (AgentTool)
- `legal_research_agent` (AgentTool)
- `damages_calculator_agent` (AgentTool)

---

### 2. Evidence Analysis Agent

**Purpose:** Analyzes uploaded documents and extracts structured information

**Model:** `gemini-2.5-flash`

**Capabilities:**
- Parse PDFs, images, and text documents
- Extract key facts (dates, names, amounts, diagnoses)
- Identify inconsistencies or gaps in documentation
- Generate document summaries
- Cross-reference information across documents

**Input Types:**
- Medical records (ER, specialist, PT, imaging)
- Incident reports (employer, OSHA, witness statements)
- Employment records (wage history, training records)
- Workers' comp documents
- Photos (accident scene, injuries, safety violations)

**Output Format:**
```json
{
  "document_type": "medical_record",
  "key_facts": [...],
  "dates": [...],
  "amounts": [...],
  "diagnoses": [...],
  "flags": [...],
  "summary": "..."
}
```

**Tools:**
- Document parsing tool (text extraction)
- Image analysis (for photos)

---

### 3. Legal Research Agent

**Purpose:** Researches applicable laws, regulations, and case precedents

**Model:** `gemini-2.5-flash`

**Capabilities:**
- Search OSHA regulations (29 CFR citations)
- Find comparable verdicts in jurisdiction
- Check statute of limitations
- Analyze workers' comp vs third-party liability options
- Identify potential liable parties

**Research Areas:**
- OSHA safety violations and penalties
- California workers' compensation law
- Personal injury statutes
- Employer negligence standards
- Third-party liability (equipment manufacturers, contractors)

**Output Format:**
```json
{
  "applicable_regulations": [...],
  "similar_cases": [...],
  "statute_of_limitations": {...},
  "liability_analysis": "...",
  "legal_theories": [...]
}
```

**Tools:**
- `google_search` (built-in ADK tool)

---

### 4. Damages Calculator Agent

**Purpose:** Computes case valuation and settlement estimates

**Model:** `gemini-2.5-flash`

**Capabilities:**
- Calculate economic damages (medical + lost wages)
- Estimate future medical costs
- Apply pain & suffering multipliers
- Consider policy limits
- Account for liens and subrogation
- Generate settlement range

**Damage Categories:**
| Category | Description |
|----------|-------------|
| Past Medical | All treatment to date |
| Future Medical | Projected ongoing care |
| Past Lost Wages | Actual income lost |
| Future Lost Earnings | Reduced earning capacity |
| Pain & Suffering | Non-economic damages |
| Property Damage | If applicable |

**Calculation Methods:**
- Multiplier method: (Economic × 1.5-5)
- Per diem method: Daily rate × days affected
- Comparable verdicts: Similar cases in jurisdiction

**Output Format:**
```json
{
  "economic_damages": {
    "past_medical": 67400,
    "future_medical": 45000,
    "lost_wages": 20480,
    "total": 132880
  },
  "non_economic_damages": {
    "pain_and_suffering": 85000,
    "method": "3x multiplier"
  },
  "gross_total": 217880,
  "liens": 12450,
  "net_estimate": 205430,
  "settlement_range": {
    "low": 150000,
    "high": 220000
  },
  "confidence": "medium"
}
```

**Tools:**
- Calculator functions
- Comparable verdict lookup

---

## Implementation Plan

### Phase 1: Core Setup ✅
- [x] Backend structure (FastAPI)
- [x] Live agent with voice streaming
- [x] WebSocket endpoint for real-time audio
- [x] Frontend test page with transcription
- [x] Interruption handling

### Phase 2: Evidence System
- [ ] Create Evidence Analysis Agent
- [ ] Document upload endpoint
- [ ] PDF/image parsing integration
- [ ] Evidence extraction pipeline
- [ ] Summary generation

### Phase 3: Research Integration
- [ ] Create Legal Research Agent
- [ ] Google Search tool integration
- [ ] OSHA regulation lookup
- [ ] Comparable case research
- [ ] Statute of limitations checker

### Phase 4: Damages Calculation
- [ ] Create Damages Calculator Agent
- [ ] Economic damages computation
- [ ] Pain & suffering estimation
- [ ] Settlement range algorithm
- [ ] Lien consideration

### Phase 5: Agent Orchestration
- [ ] Integrate sub-agents with AgentTool
- [ ] Context passing between agents
- [ ] Response aggregation
- [ ] Real-time updates to UI

### Phase 6: UI Integration
- [ ] Case dashboard with all computed info
- [ ] Real-time transcript display
- [ ] Evidence viewer with highlights
- [ ] Settlement estimate display
- [ ] Timeline visualization

---

## File Structure

```
backend/
├── app/
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── live_agent.py           # Root agent (voice)
│   │   ├── evidence_agent.py       # Document analysis
│   │   ├── research_agent.py       # Legal research
│   │   └── damages_agent.py        # Case valuation
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── document_parser.py      # PDF/image extraction
│   │   └── calculator.py           # Damages math
│   ├── services/
│   │   ├── gemini_live_service.py  # WebSocket streaming
│   │   └── evidence_service.py     # File handling
│   └── routers/
│       ├── gemini_live.py          # Voice endpoints
│       └── evidence.py             # Upload endpoints
```

---

## Demo Flow

1. **User calls Lexie** → Live Agent greets, asks about incident
2. **User describes fall** → Agent asks follow-up questions
3. **User uploads documents** → Evidence Agent extracts facts
4. **Agent researches** → Legal Research Agent finds OSHA violations
5. **Agent calculates** → Damages Agent computes settlement range
6. **Summary displayed** → UI shows case analysis in real-time

---

## Success Criteria

- [ ] Voice conversation feels natural and empathetic
- [ ] Interruption works instantly (< 200ms)
- [ ] Evidence analysis extracts accurate information
- [ ] Legal research finds relevant regulations
- [ ] Damages calculation matches realistic estimates
- [ ] All agents work together seamlessly
- [ ] Demo runs reliably for competition
