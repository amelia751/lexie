# Gemini Live Service - Simple Graph

## Main Flow

```
Client (WebSocket)
    ↓
GeminiLiveService
    ↓
Gemini API
    ↓
Client (WebSocket)
```

## Components

```
[Client]
  - Sends: Audio + Text
  - Receives: Audio + Transcripts

[GeminiLiveService]
  - Creates sessions
  - Routes messages
  - Handles 2 tasks:
    • receive_from_client → sends to Gemini
    • send_to_client → sends to Client

[Gemini API]
  - Processes voice/text
  - Generates responses
  - Handles interruptions
```

## Main Process

```
1. Client connects
    ↓
2. Create session (Runner + Queue)
    ↓
3. Start 2 tasks in parallel:

    Task A: Client → Gemini
      • Get audio/text from WebSocket
      • Send to Gemini via Queue

    Task B: Gemini → Client
      • Get responses from Gemini
      • Send audio/text to WebSocket
    ↓
4. Client disconnects
    ↓
5. Cleanup session
```

## Message Types

**Client sends:**
- Audio (bytes)
- Text (JSON)
- "end_turn" signal

**Client receives:**
- Audio (bytes)
- Transcripts (JSON)
- "interrupted" signal
- "turn_complete" signal
