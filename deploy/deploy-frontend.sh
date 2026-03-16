#!/usr/bin/env bash
# ==============================================================================
# deploy-frontend.sh — Build and deploy the Lexie frontend to Cloud Run
# Usage: ./deploy/deploy-frontend.sh [BACKEND_URL]
#
# The backend URL is baked into Next.js at build time via NEXT_PUBLIC_BACKEND_URL.
# If not passed as an argument, the script fetches it from the running backend service.
# ==============================================================================
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
PROJECT_ID="${GCP_PROJECT_ID:-lexie-489222}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="lexie-frontend"
BACKEND_SERVICE="lexie-backend"
MEMORY="512Mi"
MAX_INSTANCES=3

# ── Resolve backend URL ──────────────────────────────────────────────────────
if [ -n "${1:-}" ]; then
  BACKEND_URL="$1"
else
  echo "📡 Fetching backend URL from Cloud Run..."
  BACKEND_URL=$(gcloud run services describe "${BACKEND_SERVICE}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --format="value(status.url)" 2>/dev/null || true)

  if [ -z "${BACKEND_URL}" ]; then
    echo "❌ Backend service not found. Deploy the backend first:"
    echo "   ./deploy/deploy-backend.sh"
    exit 1
  fi
fi

# ── Deploy ────────────────────────────────────────────────────────────────────
echo "🚀 Deploying ${SERVICE_NAME} to Cloud Run..."
echo "   Project:     ${PROJECT_ID}"
echo "   Region:      ${REGION}"
echo "   Backend URL: ${BACKEND_URL}"
echo ""

gcloud run deploy "${SERVICE_NAME}" \
  --source ./frontend \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --set-build-env-vars="NEXT_PUBLIC_BACKEND_URL=${BACKEND_URL}" \
  --set-env-vars="NEXT_PUBLIC_BACKEND_URL=${BACKEND_URL}" \
  --allow-unauthenticated \
  --memory="${MEMORY}" \
  --max-instances="${MAX_INSTANCES}" \
  --quiet

# ── Output URL ────────────────────────────────────────────────────────────────
FRONTEND_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --format="value(status.url)")

echo ""
echo "✅ Frontend deployed: ${FRONTEND_URL}"
