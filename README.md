# Lexie — AI Legal Intake Assistant

Lexie is a real-time AI legal intake assistant powered by Google's **Gemini Live API**, **Vertex AI**, and the **Agent Development Kit (ADK)**. It conducts voice and text-based client intake interviews, automatically extracting case facts, building timelines, analyzing medical records, and estimating damages — all streamed live to a dynamic canvas UI.

---

## Deployed Services

| Service | URL |
|---------|-----|
| **Frontend** | https://lexie-frontend-264729289350.us-central1.run.app |
| **Backend** | https://lexie-backend-264729289350.us-central1.run.app |

> You can test the live deployment directly — no local setup required.

---

## Reproducible Testing Instructions

### Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.12+ |
| Node.js | 22+ |
| npm | 10+ |
| Google Cloud service account | With Vertex AI & Firestore enabled |

### 1. Clone the Repository

```bash
git clone https://github.com/anhlam/lexie.git
cd lexie
```

### 2. Backend Setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate   # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and set:
#   GOOGLE_CLOUD_PROJECT=<your-gcp-project-id>
#   GOOGLE_APPLICATION_CREDENTIALS=./credentials/gcp-service-account.json

# Place your GCP service account JSON at:
#   backend/credentials/gcp-service-account.json

# Start the backend server
python run.py
```

The backend will start at **http://localhost:8000**. Verify it's running:

```bash
curl http://localhost:8000/health
# Expected: {"status":"healthy","service":"lexie-backend"}
```

### 3. Frontend Setup

Open a **new terminal**:

```bash
cd frontend

# Install dependencies
npm install

# The default .env.local already points to the local backend:
#   NEXT_PUBLIC_BACKEND_URL=http://localhost:8000

# Start the development server
npm run dev
```

The frontend will start at **http://localhost:3000**.

### 4. How to Test the Application

1. **Open the app** at [http://localhost:3000](http://localhost:3000) (or the deployed frontend URL above).
2. **Start a voice session** by clicking the microphone button in the left panel, or use the **text chat** input to type messages.
3. **Describe a legal case** — for example:
   > "I was in a car accident on January 15th, 2025. I was rear-ended at a red light on Main Street. I went to the ER and was diagnosed with whiplash. My medical bills are around $12,000 so far and I missed 3 weeks of work."
4. **Watch the canvas update in real-time** — as the AI agent extracts information, the right-side tabs will populate:
   - **Case Summary** — client info, incident details, liability assessment
   - **Timeline** — chronological events extracted from the conversation
   - **Medical Summary** — injuries, treatments, providers, and expenses
   - **Damages Analysis** — economic & non-economic damages with settlement estimates
   - **Evidence Hub** — tracked evidence items and their status
5. **Upload documents** — use the file explorer panel to upload medical records, photos, or police reports. The AI will analyze them via Gemini Vision and RAG.
6. **Reset** — click the reset button in the header to clear all data and start a new intake session.

### 5. Verify API Endpoints

```bash
# Health check
curl http://localhost:8000/health

# Readiness check (confirms GCP credentials are loaded)
curl http://localhost:8000/health/ready

# Get current intake state
curl http://localhost:8000/api/v1/intake/state

# Send a text message via HTTP (alternative to WebSocket)
curl -X POST http://localhost:8000/api/v1/intake/message \
  -H "Content-Type: application/json" \
  -d '{"message": "I was in a car accident last week"}'

# Reset intake state
curl -X POST http://localhost:8000/api/v1/intake/reset
```

### 6. Test Against the Deployed Version

No local setup needed — just use the deployed backend directly:

```bash
curl https://lexie-backend-264729289350.us-central1.run.app/health
curl https://lexie-backend-264729289350.us-central1.run.app/health/ready
```

Or open the frontend: https://lexie-frontend-264729289350.us-central1.run.app

---

## Google Cloud Services Used

| Service | Purpose | Code Reference |
|---------|---------|----------------|
| **Gemini Live API** (via ADK) | Real-time voice & text AI agent | `backend/app/services/gemini_live_service.py` |
| **Vertex AI** | Model hosting & inference | `backend/app/services/rag_service.py`, `backend/app/services/vision_service.py` |
| **Vertex AI RAG** | Document retrieval-augmented generation | `backend/app/services/rag_service.py` |
| **Gemini Vision** | Image & document analysis | `backend/app/services/vision_service.py`, `backend/app/services/document_processor.py` |
| **Cloud Firestore** | Case data persistence | `backend/app/services/firestore_service.py` |
| **Cloud Run** | Hosting both frontend & backend | `deploy/` folder |

---

## Cloud Deployment Automation

All deployment automation lives in the [`deploy/`](deploy/) folder:

| File | Purpose |
|------|---------|
| [`deploy-all.sh`](deploy/deploy-all.sh) | **One-command full-stack deploy** — enables APIs, deploys backend, deploys frontend, runs smoke tests |
| [`deploy-backend.sh`](deploy/deploy-backend.sh) | Builds & deploys the FastAPI backend to Cloud Run |
| [`deploy-frontend.sh`](deploy/deploy-frontend.sh) | Builds & deploys the Next.js frontend to Cloud Run (auto-resolves backend URL) |
| [`cloudbuild.yaml`](deploy/cloudbuild.yaml) | Google Cloud Build CI/CD pipeline — automates deployment on `git push` |

### Quick Deploy

```bash
# Deploy everything with one command
./deploy/deploy-all.sh

# Or deploy individually
./deploy/deploy-backend.sh
./deploy/deploy-frontend.sh
```

### CI/CD on Git Push

The `cloudbuild.yaml` can be connected to a Cloud Build trigger for automatic deployment on every push to `main`:

```bash
gcloud builds triggers create github \
  --repo-name=lexie --repo-owner=<GITHUB_USER> \
  --branch-pattern="^main$" \
  --build-config=deploy/cloudbuild.yaml \
  --project=lexie-489222
```
