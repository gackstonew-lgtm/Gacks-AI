# GACKS P.A. V2 — PRODUCTION DEPLOYMENT RUNBOOK

## Topology Overview

GACKS P.A. V2 is deployed using a decoupled, production-grade architecture:

1. **Frontend**: Static React SPA deployed on **Vercel** (`https://gacks-ai.vercel.app/`).
2. **Backend Agent Runtime**: Long-running Node.js process deployed on **Railway**, **Render**, **Fly.io**, **Cloud Run**, or a VPS with persistent WebSocket and HTTP capabilities.
3. **Database**: Persistent local storage engine or managed PostgreSQL (e.g. Neon, Supabase, Railway Postgres via `DATABASE_URL`).

---

## 1. Backend Deployment

### Option A: Railway (Recommended)
1. In the Railway dashboard, create a **New Project** from GitHub repo (`gackstonew-lgtm/Gacks-AI`).
2. Set the root directory or start command:
   ```bash
   npm run server
   ```
3. Set the Environment Variables:
   ```env
   NODE_ENV=production
   PORT=8787
   GEMINI_API_KEY=your_gemini_api_key
   GEMINI_MODEL=gemini-2.5-flash
   ALLOWED_ORIGINS=https://gacks-ai.vercel.app
   JARVIS_ALLOW_WRITES=0
   ```
4. Generate a public domain (e.g., `https://gacks-backend.up.railway.app`).

### Option B: Docker Container
Build and run using the included production `Dockerfile`:
```bash
docker build -t gacks-agent-v2 .
docker run -d -p 8787:8787 \
  -e GEMINI_API_KEY="your_api_key" \
  -e ALLOWED_ORIGINS="https://gacks-ai.vercel.app" \
  gacks-agent-v2
```

---

## 2. Frontend Deployment (Vercel)

1. Connect the GitHub repository to your Vercel dashboard.
2. Under **Project Settings -> Environment Variables**, configure the public gateway address:
   ```env
   VITE_BRIDGE_URL=wss://gacks-backend.up.railway.app/ws
   VITE_TTS_ENGINE=system
   VITE_USE_ELEVENLABS=false
   ```
   *(Notice: Zero sensitive API keys like `GEMINI_API_KEY` or `ANTHROPIC_API_KEY` are placed in Vercel client environment variables!)*
3. Deploy the project. Vercel builds the bundle using `npm run build` and serves static assets with SPA fallbacks defined in `vercel.json`.

---

## 3. Local Development

To run the complete system locally:

1. Copy `.env.example` to `.env.local` for frontend overrides, and `.env` for backend credentials:
   ```bash
   copy .env.example .env
   ```
2. Insert your Google Gemini API key in `.env`:
   ```env
   GEMINI_API_KEY=AIzaSy...
   ```
3. Run both the Agent Runtime (Brain) and Dashboard (Face) in a single command:
   ```bash
   npm start
   ```
4. Open `http://localhost:5173` in Google Chrome or Microsoft Edge.
5. Click **INITIALISE**, or press the **Spacebar**, and say:
   - *"Hey Gacks, what is our current mission?"*
   - *"Gacks, inspect my screen."*
   - *"Gacks, run check_integrations and report system health."*

---

## 4. Verification & Health Monitoring

Verify the live deployment by sending an HTTP GET request to the gateway:
```bash
curl https://your-backend-domain.com/api/v1/health
```

Expected JSON response:
```json
{
  "ok": true,
  "timestamp": 1789456789012,
  "version": "2.0.0",
  "environment": "production",
  "services": {
    "ai": {
      "status": "ONLINE",
      "provider": "Google Gemini Flash",
      "model": "gemini-2.5-flash"
    },
    "memory": {
      "status": "ONLINE",
      "engine": "Persistent Memory Store (Hybrid Scoring)",
      "count": 2
    },
    "tools": {
      "status": "ONLINE",
      "count": 14
    },
    "voice": {
      "status": "ONLINE",
      "tts": false,
      "stt": false,
      "engine": "Browser Neural/SpeechSynthesis"
    },
    "vision": {
      "status": "ONLINE",
      "camera": true,
      "screen": true
    },
    "integrations": {
      "github": "NOT_CONFIGURED",
      "vercel": "NOT_CONFIGURED",
      "email": "NOT_CONFIGURED",
      "whatsapp": "NOT_CONFIGURED"
    }
  }
}
```
