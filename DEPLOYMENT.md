# AgroArc — Heroku Deployment Guide

End-to-end guide to deploy AgroArc (FastAPI backend + Vite/Nginx frontend) to Heroku as two Docker apps.

> Two Heroku apps are recommended (one per service). Heroku does **not** support `docker-compose`; each app runs a single container.

---

## 1. Pre-flight checklist

| Item | Required for | Status |
|---|---|---|
| Heroku account with Student Developer Pack credits | Both apps | ✓ |
| Docker Desktop running on your machine | Build + push images | ✓ |
| Heroku CLI installed | All commands below | install once |
| `OPENWEATHER_API_KEY` (live key) | Backend weather endpoint | from `backend/.env` |
| `GEMINI_API_KEY` (live key) | Backend chat endpoint | from `backend/.env` |

Install the Heroku CLI on Windows (once):

```powershell
winget install --id=Heroku.HerokuCLI -e
# OR download the installer: https://devcenter.heroku.com/articles/heroku-cli
```

---

## 2. App naming convention used below

| Service | Heroku app name |
|---|---|
| Backend (FastAPI) | `agroarc-api` |
| Frontend (Nginx + Vite SPA) | `agroarc-web` |

> Heroku app names are globally unique. If these are taken, swap in your own and update every `agroarc-api` / `agroarc-web` reference below.

---

## 3. One-time login

```powershell
heroku login
# Opens a browser tab on heroku.com -- click "Allow" once.

heroku container:login
# Logs Docker into registry.heroku.com using your Heroku token.
```

After this, every subsequent command in this guide is non-interactive.

---

## 4. Backend deployment (`agroarc-api`)

### 4.1 Create the app

```powershell
heroku create agroarc-api --region us
# (or --region eu if you prefer European latency)

heroku stack:set container -a agroarc-api
```

### 4.2 Set environment variables (secrets)

```powershell
heroku config:set OPENWEATHER_API_KEY=YOUR_REAL_KEY            -a agroarc-api
heroku config:set GEMINI_API_KEY=YOUR_REAL_KEY                 -a agroarc-api
heroku config:set GEMINI_MODEL=gemini-2.5-flash                -a agroarc-api
heroku config:set LOG_LEVEL=INFO                               -a agroarc-api

# CORS hardening - restrict to the deployed frontend URL.
# (Will set this after the frontend is deployed and we know its URL.)
# heroku config:set ALLOWED_ORIGINS=https://agroarc-web.herokuapp.com -a agroarc-api

heroku config -a agroarc-api   # verify
```

### 4.3 Build and push the image

```powershell
# Build context MUST be the project root so backend/Dockerfile can COPY models/.
docker build -t registry.heroku.com/agroarc-api/web -f backend/Dockerfile .

docker push registry.heroku.com/agroarc-api/web

heroku container:release web -a agroarc-api
```

### 4.4 Verify the backend

```powershell
heroku ps -a agroarc-api                          # dyno state
heroku logs --tail -a agroarc-api                 # live logs (Ctrl+C to exit)

# Smoke tests against the public URL
$base = (heroku info -a agroarc-api --json | ConvertFrom-Json).app.web_url.TrimEnd('/')
Invoke-RestMethod "$base/"
Invoke-RestMethod "$base/api/v1/weather/health"
Invoke-RestMethod "$base/api/v1/weather/weather-advice?city=Lahore"
Invoke-RestMethod -Method Post -ContentType "application/json" `
  -Uri "$base/chat" -Body '{"message":"What crop suits sandy soil?"}'
```

`$base` will be something like `https://agroarc-api-xxxx.herokuapp.com`. Save it — you need it next.

---

## 5. Frontend deployment (`agroarc-web`)

### 5.1 Create the app

```powershell
heroku create agroarc-web --region us
heroku stack:set container -a agroarc-web
```

### 5.2 Build the frontend image with the backend URL baked in

The backend URL must be set at **build time** because Vite bundles it into the JS. Use the value of `$base` from step 4.4.

```powershell
$BACKEND_URL = "https://agroarc-api-xxxx.herokuapp.com"   # <-- replace with real URL

docker build `
  --build-arg VITE_API_BASE_URL=$BACKEND_URL `
  -t registry.heroku.com/agroarc-web/web `
  -f frontend/Dockerfile `
  ./frontend

docker push registry.heroku.com/agroarc-web/web

heroku container:release web -a agroarc-web
```

### 5.3 Tighten backend CORS to the frontend origin

```powershell
$FRONTEND_URL = (heroku info -a agroarc-web --json | ConvertFrom-Json).app.web_url.TrimEnd('/')

heroku config:set ALLOWED_ORIGINS=$FRONTEND_URL -a agroarc-api
heroku restart -a agroarc-api
```

### 5.4 Verify the frontend

```powershell
heroku ps -a agroarc-web
heroku open -a agroarc-web      # opens your default browser at the app URL

# or check headlessly:
(Invoke-WebRequest "$FRONTEND_URL" -UseBasicParsing).StatusCode   # expect 200
```

---

## 6. Choosing a dyno tier

| Tier | RAM | Sleeps? | $/mo | Verdict for AgroArc |
|---|---|---|---|---|
| Eco | 512 MB | Yes (30 min idle) | $5 pool | Bad demo UX |
| Basic | 512 MB | No | $7 | Tight; OK with slimmed image |
| Standard-1X | 512 MB | No | $25 | Tight |
| **Standard-2X** | **1 GB** | No | $50 | **Comfortable** |
| Performance-M | 2.5 GB | No | $250 | Overkill |

Backend (heavy with pandas/sklearn) — recommended: **Basic or Standard-2X**.
Frontend (just Nginx) — recommended: **Eco or Basic**.

```powershell
heroku ps:type web=basic         -a agroarc-api    # or standard-2x
heroku ps:type web=eco           -a agroarc-web    # or basic
```

---

## 7. End-to-end verification checklist

After both apps are released and CORS is locked down, verify these from your browser:

- [ ] Frontend URL loads the AgroArc UI
- [ ] Header **Status** button shows backend healthy
- [ ] **Crop Prediction** form returns a recommended crop
- [ ] **Fertilizer Recommendation** form returns a fertilizer (after "Load Dropdowns")
- [ ] **Weather Advisory** for "Lahore" returns live data
- [ ] **Command Tester** chat returns a Gemini reply for any free-form question

If anything fails, the first place to look:

```powershell
heroku logs --tail -a agroarc-api
heroku logs --tail -a agroarc-web
```

---

## 8. Production hardening (recommended once it's live)

| Concern | Action |
|---|---|
| **CORS** | Already restricted via `ALLOWED_ORIGINS=$FRONTEND_URL` (step 5.3) |
| **CORS - custom domain** | Add it to `ALLOWED_ORIGINS` as a comma-separated value |
| **Log level in prod** | `heroku config:set LOG_LEVEL=WARNING -a agroarc-api` |
| **Custom domain** | `heroku domains:add api.agroarc.com -a agroarc-api` then add DNS CNAME |
| **Free TLS for custom domain** | `heroku certs:auto:enable -a agroarc-api` |
| **Auto-scale on memory** | `heroku ps:autoscale:enable web --min=1 --max=3 -a agroarc-api` *(Performance tier only)* |
| **Periodic health probes** | Add a Heroku Scheduler job to curl `/` every 10 minutes |

---

## 9. Updating the deployed apps later

After any code change:

```powershell
# Backend
docker build -t registry.heroku.com/agroarc-api/web -f backend/Dockerfile .
docker push registry.heroku.com/agroarc-api/web
heroku container:release web -a agroarc-api

# Frontend
docker build --build-arg VITE_API_BASE_URL=$BACKEND_URL `
  -t registry.heroku.com/agroarc-web/web -f frontend/Dockerfile ./frontend
docker push registry.heroku.com/agroarc-web/web
heroku container:release web -a agroarc-web
```

A future GitHub Actions workflow (`heroku-deploy.yml`) can automate this on every merge to `main` — say the word and it can be added.

---

## 10. Rollback

```powershell
heroku releases -a agroarc-api               # list past releases
heroku rollback v23 -a agroarc-api           # revert to release v23
```

---

## 11. Tear-down (if needed)

```powershell
heroku apps:destroy --app agroarc-api --confirm agroarc-api
heroku apps:destroy --app agroarc-web --confirm agroarc-web
```
