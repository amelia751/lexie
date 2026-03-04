# Lexie Backend - Gemini Live API

Real-time voice conversation backend for the Lexie legal AI assistant, powered by Google's Gemini 2.0 Live API.

## Features

- 🎤 **Real-time Voice Conversations**: Bidirectional audio streaming with Gemini Live
- 🗣️ **Natural Interruption**: Speak naturally and interrupt the AI mid-response
- ⚖️ **Legal Intake Specialist**: Pre-configured for plaintiff personal injury case intake
- 🔄 **WebSocket Streaming**: Low-latency real-time communication
- 🔐 **Secure**: Service account authentication with Google Cloud

## Setup

### 1. Prerequisites

- Python 3.11+
- Google Cloud Project with Gemini API enabled
- Service account credentials

### 2. Install Dependencies

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure Credentials

The service account JSON is stored in `credentials/gcp-service-account.json` (gitignored).

Create a `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

### 4. Run the Server

```bash
python run.py
```

Or with uvicorn directly:
```bash
uvicorn app.main:app --reload --port 8000
```

## API Endpoints

### Health Check
- `GET /health` - Basic health check
- `GET /health/ready` - Readiness check with dependency status

### Gemini Live
- `WebSocket /api/v1/gemini-live/{client_id}` - Real-time voice conversation
- `POST /api/v1/chat` - Simple text chat (non-streaming)
- `GET /api/v1/session/info` - Get session capabilities

## WebSocket Protocol

### Client → Server Messages

```json
// Send audio chunk
{"type": "audio", "data": "<base64_pcm_audio>", "sample_rate": 16000}

// Send text message
{"type": "text", "data": "Hello, I need help with my case"}

// Interrupt AI response
{"type": "interrupt"}

// End session
{"type": "end"}
```

### Server → Client Messages

```json
// AI text response
{"type": "text", "content": "I understand. Can you tell me more?"}

// AI audio response  
{"type": "audio", "content": "<base64_audio>", "sample_rate": 24000}

// User speech transcript
{"type": "transcript", "content": "What the user said"}

// Status updates
{"type": "status", "content": "processing|connected|interrupted"}

// Errors
{"type": "error", "content": "Error description"}
```

## Architecture

```
backend/
├── app/
│   ├── __init__.py
│   ├── config.py          # Settings and configuration
│   ├── main.py            # FastAPI application
│   ├── routers/
│   │   ├── health.py      # Health check endpoints
│   │   └── gemini_live.py # WebSocket & chat endpoints
│   └── services/
│       └── gemini_live_service.py  # Gemini API integration
├── credentials/           # GCP service account (gitignored)
├── requirements.txt
├── run.py
└── README.md
```

## Development

### Testing the API

```bash
# Health check
curl http://localhost:8000/health

# Session info
curl http://localhost:8000/api/v1/session/info

# Text chat
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, I was in a car accident"}'
```

### WebSocket Testing

Use a WebSocket client like `wscat`:

```bash
npm install -g wscat
wscat -c ws://localhost:8000/api/v1/gemini-live/test-client
```

Then send:
```json
{"type": "text", "data": "Hello, I need help with my case"}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON | `./credentials/gcp-service-account.json` |
| `GCP_PROJECT_ID` | Google Cloud project ID | `lexie-489222` |
| `GCP_LOCATION` | GCP region | `us-central1` |
| `GEMINI_MODEL` | Gemini model name | `gemini-2.0-flash-exp` |
| `HOST` | Server host | `0.0.0.0` |
| `PORT` | Server port | `8000` |
| `DEBUG` | Enable debug mode | `true` |
