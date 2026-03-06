# Mock Document Requests & Tool Usage Implementation

## What's Been Added

### 1. Enhanced VoiceMessage Interface

Added support for:
- **Tool Calls**: Display when the agent uses backend functions
- **Document Requests**: Show when agent requests specific documents with priority levels

```typescript
interface VoiceMessage {
  role: 'agent' | 'plaintiff';
  content: string;
  timestamp: string;
  toolCall?: {
    name: string;
    args?: Record<string, any>;
    result?: string;
  };
  documentRequest?: {
    type: string;
    description: string;
    priority: 'critical' | 'important' | 'helpful';
  };
}
```

### 2. Mock Conversation with Document Collection

Created `mockConversationWithDocuments` that demonstrates:

#### **Tool Calls Demonstrated:**

1. **get_evidence_checklist()**
   - Shows current evidence collection status
   - Displays how many items needed/uploaded/pending

2. **request_evidence_upload(evidence_type, description)**
   - Prompts user for specific documents
   - Documents requested:
     - `incident_report` - Employer's incident/accident report
     - `medical_records_er` - Emergency room records
     - `photos_scene` - Accident scene photos
     - `photos_injuries` - Injury photos
     - `witness_statements` - Written witness statements

3. **mark_evidence_pending(evidence_id, reason)**
   - Marks document as "will provide later"
   - Examples:
     - Medical records awaiting delivery from hospital
     - Witness statements in progress

4. **mark_evidence_not_available(evidence_id, reason)**
   - Marks document as unavailable
   - Example: Client didn't photograph injuries

5. **evidence_agent.analyze_document(document_path, evidence_type)**
   - Analyzes uploaded documents
   - Example: Analyzing incident report for safety violations

6. **evidence_agent.analyze_image(image_path)**
   - Analyzes uploaded photos
   - Example: Detecting scaffold height and missing railings

7. **evidence_agent.search_evidence(query)**
   - Searches similar cases in evidence corpus
   - Example: Finding comparable construction fall cases

#### **Document Priority Levels:**

- **Critical** (Red badge): Essential documents like incident reports, ER records
- **Important** (Amber badge): Valuable evidence like photos, witness statements
- **Helpful** (Green badge): Supporting documents like OSHA reports, medical bills

### 3. Visual Indicators in Chat

The voice-chat component now displays:

**Tool Call Indicator:**
```
🔧 Tool: request_evidence_upload → Document request created
```
- Blue badge with wrench icon
- Shows tool name and result

**Document Request Banner:**
```
📄 DOCUMENT REQUEST - CRITICAL
    Employer's incident/accident report
```
- Color-coded by priority (red/amber/green)
- File icon
- Priority level and description

### 4. Conversation Flow Example

```
Agent: "Let me check what evidence we'll need for your case."
[Tool: get_evidence_checklist → Retrieved construction fall checklist - 12 items needed]

Agent: "Do you have the incident report from your employer?"
[📄 DOCUMENT REQUEST - CRITICAL: Employer's incident/accident report]
[Tool: request_evidence_upload]

Client: "Yes, I have it. Should I send it now?"

Agent: "Yes, please! You can upload it through the chat."

Client: "[Uploads: incident_report_02-20-2024.pdf]"

Agent: "Great, analyzing the incident report now..."
[Tool: evidence_agent.analyze_document → Fall from 12ft scaffold, safety violations noted]

Agent: "I've reviewed the report. It shows you fell from a 12-foot scaffold..."
```

## Backend Functions Being Mocked

All these functions exist in `/backend/app/agents/live_agent.py`:

1. **get_evidence_checklist()** (Lines 25-49)
2. **request_evidence_upload()** (Lines 52-85)
3. **mark_evidence_pending()** (Lines 88-110)
4. **mark_evidence_not_available()** (Lines 113-134)

And from `/backend/app/agents/evidence_agent.py`:

5. **analyze_image()** (Lines 185-238)
6. **search_evidence()** (Lines 57-85)

## Document Types from Evidence Hub

Construction Fall Checklist (from `/backend/app/services/evidence_hub.py`):

**Critical Evidence:**
- incident_report
- medical_records_er
- medical_records_primary

**Important Evidence:**
- witness_statements
- photos_scene
- photos_injuries
- employment_records
- safety_training
- workers_comp_claim

**Helpful Evidence:**
- osha_report
- medical_imaging
- physical_therapy
- medical_bills

## How to Test

1. Navigate to the Voice Chat panel
2. Click "Start Intake" button
3. Watch the conversation simulate:
   - Tool calls appear as blue badges
   - Document requests appear as colored banners
   - Agent requests documents one at a time
   - Client responds with availability
   - Tools analyze uploaded documents
   - Evidence checklist tracks progress

## Files Modified

1. **frontend/src/lib/mock-data.ts**
   - Extended `VoiceMessage` interface
   - Added `mockConversationWithDocuments`

2. **frontend/src/components/voice-chat/voice-chat.tsx**
   - Added tool call rendering
   - Added document request banners
   - Updated to use new mock conversation
   - Added icons (Wrench, FileText)

## Next Steps (If Needed)

- [ ] Add real document upload UI
- [ ] Connect to actual backend API endpoints
- [ ] Add document preview/viewer
- [ ] Add evidence checklist sidebar showing progress
- [ ] Add notifications when documents are analyzed
- [ ] Add ability to remove/replace documents
