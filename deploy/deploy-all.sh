#!/usr/bin/env bash
# ==============================================================================
# deploy-all.sh — One-command deployment of the full Lexie stack to Cloud Run
#
# Usage:  ./deploy/deploy-all.sh
#
# This script:
#   1. Enables required GCP APIs (idempotent)
#   2. Deploys the FastAPI backend
#   3. Deploys the Next.js frontend (with the backend URL baked in)
#   4. Runs a smoke test against both services
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ID="${GCP_PROJECT_ID:-lexie-489222}"
REGION="${GCP_REGION:-us-central1}"

echo "╔═══════════════════════════════════════════════════╗"
echo "║        LEXIE — Cloud Run Deployment               ║"
echo "║        Project: ${PROJECT_ID}                     ║"
echo "║        Region:  ${REGION}                         ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Enable APIs ──────────────────────────────────────────────────────
echo "📦 Ensuring required GCP APIs are enabled..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  aiplatform.googleapis.com \
  firestore.googleapis.com \
  --project="${PROJECT_ID}" --quiet
echo "   ✓ APIs enabled"
echo ""

# ── Step 2: Deploy backend ───────────────────────────────────────────────────
bash "${SCRIPT_DIR}/deploy-backend.sh"
echo ""

# ── Step 3: Deploy frontend (auto-fetches backend URL) ───────────────────────
bash "${SCRIPT_DIR}/deploy-frontend.sh"
echo ""

# ── Step 4: Smoke test ───────────────────────────────────────────────────────
echo "🧪 Running smoke tests..."

BACKEND_URL=$(gcloud run services describe lexie-backend \
  --project="${PROJECT_ID}" --region="${REGION}" --format="value(status.url)")
FRONTEND_URL=$(gcloud run services describe lexie-frontend \
  --project="${PROJECT_ID}" --region="${REGION}" --format="value(status.url)")

# Backend health
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BACKEND_URL}/health")
if [ "${STATUS}" = "200" ]; then
  echo "   ✓ Backend health check passed"
else
  echo "   ✗ Backend health check failed (HTTP ${STATUS})"
fi

# Frontend page load
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${FRONTEND_URL}/")
if [ "${STATUS}" = "200" ]; then
  echo "   ✓ Frontend page load passed"
else
  echo "   ✗ Frontend page load failed (HTTP ${STATUS})"
fi

echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║  ✅ Deployment complete!                          ║"
echo "║                                                   ║"
echo "║  Frontend: ${FRONTEND_URL}"
echo "║  Backend:  ${BACKEND_URL}"
echo "╚═══════════════════════════════════════════════════╝"
