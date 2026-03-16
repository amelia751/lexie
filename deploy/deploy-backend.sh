#!/usr/bin/env bash
# ==============================================================================
# deploy-backend.sh — Build and deploy the Lexie backend to Cloud Run
# Usage: ./deploy/deploy-backend.sh
# ==============================================================================
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
PROJECT_ID="${GCP_PROJECT_ID:-lexie-489222}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="lexie-backend"
SERVICE_ACCOUNT="development@${PROJECT_ID}.iam.gserviceaccount.com"
MEMORY="1Gi"
MAX_INSTANCES=3
TIMEOUT=3600

# ── Deploy ────────────────────────────────────────────────────────────────────
echo "🚀 Deploying ${SERVICE_NAME} to Cloud Run..."
echo "   Project:  ${PROJECT_ID}"
echo "   Region:   ${REGION}"
echo ""

gcloud run deploy "${SERVICE_NAME}" \
  --source ./backend \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --service-account="${SERVICE_ACCOUNT}" \
  --set-env-vars="GOOGLE_GENAI_USE_VERTEXAI=TRUE,GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=${REGION}" \
  --allow-unauthenticated \
  --memory="${MEMORY}" \
  --timeout="${TIMEOUT}" \
  --max-instances="${MAX_INSTANCES}" \
  --session-affinity \
  --quiet

# ── Output URL ────────────────────────────────────────────────────────────────
BACKEND_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --format="value(status.url)")

echo ""
echo "✅ Backend deployed: ${BACKEND_URL}"
echo "${BACKEND_URL}"
