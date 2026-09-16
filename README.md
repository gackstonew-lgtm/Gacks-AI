# GACKS P.A. V2 — “JARVIS SURPASS ARCHITECTURE”
## Production-Grade Agentic AI Personal Operator

> **Live Production:** [https://gacks-ai.vercel.app/](https://gacks-ai.vercel.app/)  
> **Repository:** [https://github.com/gackstonew-lgtm/Gacks-AI.git](https://github.com/gackstonew-lgtm/Gacks-AI.git)

GACKS P.A. V2 is an architectural evolution from a local voice assistant into a production-grade, persistent, multimodal personal AI operator inspired by the usefulness and responsiveness of fictional assistants such as JARVIS.

GACKS V2 is **not merely a chatbot with a futuristic interface**. It understands context, creates structured execution plans, invokes sandboxed tools, verifies outcomes against real systems, recovers from transient failures, learns workflows into persistent memory, and seamlessly integrates with your screen and camera.

---

## 1. Core Architecture

```
USER (Voice / Text)
  ↓
GACKS INTERFACE (React 19 / Vite / 3D Arc Reactor / Holographic HUD)
  ↓
CONTEXT ENGINE (Intelligent Token-Budgeted Prompt Assembly)
  ↓
ORCHESTRATOR (Lifecycle Conductor)
  ↓
PLANNER (Multi-step Structured JSON Plans)
  ↓
MODEL ROUTER (Gemini Flash Primary · Claude Fallback)
  ↓
TOOL / AGENT EXECUTION (Sandboxed Tool Registry V2 & 5-Tier Policy Engine)
  ↓
OBSERVATION (Structured Telemetry)
  ↓
VERIFIER (verified_success vs unverified_success vs failure)
  ↓
RECOVERY / RETRY (Bounded Retries & Loop Guard)
  ↓
MEMORY UPDATE (Episodic, Semantic, Procedural, Knowledge Graph)
  ↓
FINAL SPOKEN RESPONSE (< 60 words, dry RP tone) & HUD BLADES
```

---

## 2. Key Capabilities & Principles

- **Zero Secrets Shipped to Browser**: All sensitive API keys (`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, tokens) reside exclusively in the server environment. The frontend bundle is clean and safe for public deployment.
- **Production Gateway**: Decouples the frontend from hardcoded `localhost:8787`. The client uses `AgentTransport` to talk to any configured WSS/HTTPS gateway.
- **Closed-Loop Verification**: Actions are never reported as complete simply because an LLM returned text. File writes are verified by readback, endpoints by HTTP status and schema.
- **Persistent Missions & Tasks**: Active missions survive page refreshes and server restarts. The dashboard exposes:
  - `CURRENT MISSION: [Goal]`
  - Progress % (`0% - 100%`)
  - Stage Pipeline: `PLANNING` ✓ ➔ `DIAGNOSIS` ✓ ➔ `IMPLEMENTATION` ✓ ➔ `VERIFICATION` ◐ ➔ `DEPLOYMENT` ○
  - Saying *"Continue"* automatically resumes in-progress missions.
- **Multi-Tier Memory & Hybrid Retrieval**: Working, episodic, semantic, and procedural memories ranked with keyword similarity, recency decay, and importance factors.
- **Preserved Iconic Experience**: Retains the holographic HUD, 3D Arc Reactor, wake-word activation, WebRTC audio VAD, and instant speech interruption / barge-in.

---

## 3. Quick Start (Local Development)

### Requirements
- **Node.js 20 or newer**
- **Google Chrome or Microsoft Edge** (for WebGL and microphone permissions)
- **Google Gemini API Key** (free tier available at [Google AI Studio](https://aistudio.google.com/app/apikey))

### Installation
```bash
# 1. Clone repository
git clone https://github.com/gackstonew-lgtm/Gacks-AI.git
cd Gacks-AI

# 2. Install dependencies
npm install

# 3. Configure environment
copy .env.example .env
# Edit .env and paste your GEMINI_API_KEY

# 4. Launch both Agent Runtime (Brain) and Dashboard (Face)
npm start
```

Open `http://localhost:5173`, click **INITIALISE**, and say:
> *"Hey Gacks, what is our current mission?"*  
> *"Gacks, inspect my screen."*  
> *"Gacks, run check_integrations and report system health."*

---

## 4. Production Deployment

### Frontend (Vercel)
Deploy repository directly to Vercel. In Project Settings -> Environment Variables, configure:
```env
VITE_BRIDGE_URL=wss://your-backend-host.com/ws
VITE_TTS_ENGINE=system
VITE_USE_ELEVENLABS=false
```

### Backend (Railway / Render / Fly.io / Docker)
Deploy using the provided production `Dockerfile` or start script:
```bash
npm run server
```
Environment variables:
```env
NODE_ENV=production
PORT=8787
GEMINI_API_KEY=your_gemini_api_key
ALLOWED_ORIGINS=https://gacks-ai.vercel.app
JARVIS_ALLOW_WRITES=0
```

---

## 5. Verification & Health Monitoring

Query the live system health endpoint:
```bash
curl http://localhost:8787/api/v1/health
```

Expected JSON response:
```json
{
  "ok": true,
  "version": "2.0.0",
  "environment": "production",
  "services": {
    "ai": { "status": "ONLINE", "provider": "Google Gemini Flash", "model": "gemini-2.5-flash" },
    "memory": { "status": "ONLINE", "engine": "Persistent Memory Store (Hybrid Scoring)", "count": 2 },
    "tools": { "status": "ONLINE", "count": 14 },
    "voice": { "status": "ONLINE", "tts": true, "stt": true, "engine": "Browser Neural/SpeechSynthesis" },
    "vision": { "status": "ONLINE", "camera": true, "screen": true }
  }
}
```

---

## 6. Architecture & Runbook Documentation
- [ARCHITECTURE.md](ARCHITECTURE.md) — Comprehensive technical specification of all subsystems.
- [DEPLOYMENT.md](DEPLOYMENT.md) — Production deployment runbook for cloud hosts.
