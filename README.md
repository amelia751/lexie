# lexie

## Deployed Services

| Service | URL |
|---------|-----|
| **Frontend** | https://lexie-frontend-264729289350.us-central1.run.app |
| **Backend** | https://lexie-backend-264729289350.us-central1.run.app |

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
