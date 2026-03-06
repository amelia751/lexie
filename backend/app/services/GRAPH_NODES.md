# Gemini Live Service - Node Graph

## Component Nodes

```
┌─────────────────┐
│    WebSocket    │ (Client Connection)
└─────────────────┘
        ↕
┌─────────────────┐
│ receive_from_   │ (Async Task)
│    client()     │
└─────────────────┘
        ↓
┌─────────────────┐
│ LiveRequest     │ (Message Queue)
│     Queue       │
└─────────────────┘
        ↓
┌─────────────────┐
│   ADK Runner    │ (Orchestrator)
└─────────────────┘
        ↓
┌─────────────────┐
│  Gemini Live    │ (External API)
│      API        │
└─────────────────┘
        ↓
┌─────────────────┐
│  runner.run_    │ (Event Stream)
│     live()      │
└─────────────────┘
        ↓
┌─────────────────┐
│  send_to_       │ (Async Task)
│   client()      │
└─────────────────┘
        ↓
┌─────────────────┐
│   WebSocket     │ (Client Connection)
└─────────────────┘
```

## Full System Nodes

```
┌──────────────────────────────────────────────────────────┐
│                   GeminiLiveService                      │
│                                                          │
│  ┌────────────────────┐      ┌─────────────────────┐   │
│  │ InMemorySession    │      │  active_sessions    │   │
│  │     Service        │      │   dict[str, dict]   │   │
│  └────────────────────┘      └─────────────────────┘   │
│           ↓                           ↓                  │
│  ┌─────────────────────────────────────────────────┐   │
│  │          create_live_session()                  │   │
│  │  Creates: Runner + Session + LiveRequestQueue  │   │
│  └─────────────────────────────────────────────────┘   │
│                        ↓                                 │
│  ┌─────────────────────────────────────────────────┐   │
│  │            run_live_session()                   │   │
│  └─────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
                         ↓
        ┌────────────────┴────────────────┐
        ↓                                  ↓
┌──────────────────┐            ┌──────────────────┐
│  receive_from_   │            │   send_to_       │
│    client()      │            │    client()      │
│  (Async Task)    │            │  (Async Task)    │
└──────────────────┘            └──────────────────┘
        ↓                                  ↑
┌──────────────────┐            ┌──────────────────┐
│   WebSocket IN   │            │  WebSocket OUT   │
│  • Audio bytes   │            │  • Audio bytes   │
│  • Text JSON     │            │  • JSON events   │
└──────────────────┘            └──────────────────┘
        ↓                                  ↑
┌──────────────────┐            ┌──────────────────┐
│ LiveRequestQueue │            │  runner.run_     │
│ .send_realtime() │            │     live()       │
│ .send_content()  │            │  (Event Stream)  │
└──────────────────┘            └──────────────────┘
        ↓                                  ↑
        └──────────┬───────────────────────┘
                   ↓
        ┌─────────────────────┐
        │    ADK Runner       │
        │  • live_agent       │
        │  • RunConfig        │
        └─────────────────────┘
                   ↓
        ┌─────────────────────┐
        │   Session Object    │
        │  • user_id          │
        │  • session_id       │
        └─────────────────────┘
                   ↓
        ┌─────────────────────┐
        │  Gemini Live API    │
        │  • Voice (Puck)     │
        │  • Transcription    │
        │  • Interruption     │
        └─────────────────────┘
```

## Data Flow Between Nodes

```
[Client]
   ↓ (audio/text)
[WebSocket]
   ↓
[receive_from_client Task]
   ↓ (parse & queue)
[LiveRequestQueue]
   ↓ (send_realtime / send_content)
[ADK Runner]
   ↓ (run_live with session)
[Gemini Live API]
   ↓ (process & generate)
[Event Stream from run_live()]
   ↓ (events: audio, transcripts, interruptions)
[send_to_client Task]
   ↓ (format & send)
[WebSocket]
   ↓ (audio/json)
[Client]
```

## Node Relationships

```
GeminiLiveService
  ├── HAS: InMemorySessionService
  ├── HAS: active_sessions dict
  ├── CREATES: Runner
  ├── CREATES: Session
  ├── CREATES: LiveRequestQueue
  ├── SPAWNS: receive_from_client (Task)
  └── SPAWNS: send_to_client (Task)

Runner
  ├── USES: live_agent
  ├── USES: RunConfig
  ├── CONNECTS TO: Gemini Live API
  └── RETURNS: Event stream

LiveRequestQueue
  ├── RECEIVES FROM: receive_from_client
  ├── SENDS TO: Gemini Live API (via Runner)
  └── METHODS: send_realtime(), send_content(), close()

WebSocket
  ├── BIDIRECTIONAL WITH: Client
  ├── SENDS TO: receive_from_client
  └── RECEIVES FROM: send_to_client
```

## Key Nodes Explained

**1. WebSocket**
- Type: Network connection
- Purpose: Bidirectional client communication
- Handles: Binary audio + JSON messages

**2. receive_from_client()**
- Type: Async task
- Purpose: Client → Gemini pipeline
- Input: WebSocket messages
- Output: Queue items to Gemini

**3. LiveRequestQueue**
- Type: Message queue
- Purpose: Buffer client messages for Gemini
- Methods: send_realtime(), send_content(), close()

**4. ADK Runner**
- Type: Orchestrator
- Purpose: Manage Gemini API lifecycle
- Uses: live_agent, Session, RunConfig

**5. Gemini Live API**
- Type: External service
- Purpose: AI processing
- Features: Voice, transcription, interruption

**6. runner.run_live()**
- Type: Async generator
- Purpose: Stream events from Gemini
- Yields: Events with audio/transcripts/interruptions

**7. send_to_client()**
- Type: Async task
- Purpose: Gemini → Client pipeline
- Input: Event stream
- Output: WebSocket messages

**8. InMemorySessionService**
- Type: State manager
- Purpose: Track user sessions
- Stores: Session history and context

**9. Session**
- Type: Data object
- Purpose: User context
- Contains: user_id, session_id, history

**10. RunConfig**
- Type: Configuration object
- Purpose: Define API behavior
- Settings: Voice, language, transcription, interruption
```

## Bidirectional Streaming Flow

```
        CLIENT
          ↕
      WebSocket (bidirectional)
          ↕
    ┌─────┴─────┐
    ↓           ↓
receive_    send_to_
from_client client
    ↓           ↑
LiveRequest  Event
   Queue     Stream
    ↓           ↑
    └──→Runner──┘
         ↕
    Gemini API
```

## Concurrent Task Nodes

```
run_live_session() spawns:

┌─────────────────────┐     ┌─────────────────────┐
│  Task 1: Receive    │     │  Task 2: Send       │
│                     │     │                     │
│  • Listen WebSocket │     │  • Listen run_live()│
│  • Queue to Gemini  │     │  • Send to WebSocket│
└─────────────────────┘     └─────────────────────┘
         ↓                           ↑
    [LiveRequestQueue]         [Event Stream]
         ↓                           ↑
         └─────→ [Runner] ──────────┘
```

## Configuration Node Details

```
RunConfig
  ├── response_modalities: ["AUDIO"]
  ├── speech_config
  │     ├── voice_config
  │     │     └── prebuilt_voice: "Puck"
  │     └── languageCode: "en-US"
  ├── output_audio_transcription: enabled
  ├── input_audio_transcription: enabled
  └── realtime_input_config
        ├── activity_handling: START_OF_ACTIVITY_INTERRUPTS
        └── automatic_activity_detection
              ├── startOfSpeechSensitivity: HIGH
              ├── endOfSpeechSensitivity: LOW
              ├── prefixPaddingMs: 100
              └── silenceDurationMs: 500
```

## Event Types (from Gemini)

```
Event Object
  ├── interrupted (bool)
  ├── content
  │     └── parts[]
  │           └── inline_data
  │                 └── data (audio bytes)
  ├── output_transcription
  │     ├── text
  │     └── finished (bool)
  ├── input_transcription
  │     ├── text
  │     └── finished (bool)
  ├── turn_complete (bool)
  └── actions
        └── function_calls[]
```
