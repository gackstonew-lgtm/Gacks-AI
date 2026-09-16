# GACKS P.A. V2 — SYSTEM ARCHITECTURE
## "JARVIS Surpass" Agentic Operator Specifications

### 1. High-Level Architectural Topology

GACKS P.A. V2 is designed as a distributed, secure, personal AI operating system:

```
                            OPERATOR
                               │
                        (Voice / Text)
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       GACKS FRONTEND (React 19 / Vite)                      │
│                                                                             │
│  - Futuristic Command Interface & Holographic HUD                           │
│  - 3D Interactive Arc Reactor (Three.js / React Three Fiber)                │
│  - Audio Pipeline: VAD, Wake-Word, Barge-in Interruption, Speech Synthesis   │
│  - Multimodal Vision: Camera Frame Grabber, DisplayMedia Screen Inspector   │
│  - Persistent Dashboard: Current Mission, Tasks, Calendar, System Status    │
│  - Transport Layer: RemoteAgentTransport (Auto-reconnecting WSS & HTTPS)    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTPS / WSS
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GACKS API GATEWAY (Node.js / Express/WS)                 │
│                                                                             │
│  - Origin & CORS Security Gate                                              │
│  - SSRF-Guarded Media & Page Readers (/img, /media, /page, /file)           │
│  - Real-time Bidirectional WebSocket Tunnel (/ws)                           │
│  - Speech Audio Proxies (/tts via ElevenLabs Streaming, /stt via Scribe)    │
│  - System Health Telemetry (/api/v1/health)                                 │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GACKS AGENT RUNTIME                                 │
│                                                                             │
│   ┌──────────────────┐       ┌─────────────────┐       ┌────────────────┐  │
│   │  CONTEXT ENGINE  │──────▶│   ORCHESTRATOR  │──────▶│    PLANNER     │  │
│   └──────────────────┘       └────────┬────────┘       └────────────────┘  │
│                                       │                                     │
│                                       ▼                                     │
│   ┌──────────────────┐       ┌─────────────────┐       ┌────────────────┐  │
│   │   MODEL ROUTER   │       │    EXECUTOR     │──────▶│    VERIFIER    │  │
│   │ (Gemini/Claude)  │       │  (Tool Runner)  │       │(Build/API/Test)│  │
│   └──────────────────┘       └────────┬────────┘       └────────────────┘  │
│                                       │                         ▲           │
│                                       ▼                         │           │
│                             ┌───────────────────┐               │           │
│                             │   POLICY ENGINE   │───────────────┘           │
│                             │   (Levels 0 - 4)  │                           │
│                             └───────────────────┘                           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
               ┌───────────────────────┴───────────────────────┐
               ▼                                               ▼
┌───────────────────────────────┐               ┌──────────────────────────────┐
│       PERSISTENT MEMORY       │               │       TOOL REGISTRY V2       │
│                               │               │                              │
│ - Working Memory (Turn state) │               │ - HUD Blades & Panels        │
│ - Episodic Memory (Events)    │               │ - UI Theme & Flourishes      │
│ - Semantic Memory (Facts)     │               │ - Screen & Camera Vision     │
│ - Procedural Memory (Flows)   │               │ - Safe Filesystem Operations │
│ - Entity Knowledge Graph      │               │ - Integrations (WA, Email)   │
│ - Hybrid Similarity Ranking   │               │ - Strict Zod Validation      │
│ - Persistent Storage (JSON/PG)│               │ - Audit Logger               │
└───────────────────────────────┘               └──────────────────────────────┘
```

---

### 2. The Agentic Lifecycle

Every interaction moves through a closed-loop verification cycle:

1. **Request Intake**: User speech or text arrives at the interface. Voice activity detection flags the onset; wake-word or direct command engages the turn.
2. **Context Engine Assembly**: The Context Engine constructs a bounded prompt combining:
   - System persona (concise, dry British RP tone, < 60 words for speech).
   - User request and active conversation window.
   - Relevant retrieved memories (episodic/semantic) matching query keywords.
   - Current active mission goal and step progress.
   - Personal knowledge graph entity relations.
   - Situational screen/camera observations.
3. **Intent Classification & Planning**: The Planner evaluates task complexity:
   - Trivial conversational turn $\rightarrow$ direct answer or single tool call.
   - Complex task (diagnostics, code modification, deployment) $\rightarrow$ structured JSON plan with discrete steps and dependency graph.
4. **Model Router Selection**: Routes request to optimal model profile (`FAST`, `REASONING`, `VISION`, `CODING`). Primary reasoning uses Google Gemini Flash; health tracker triggers fallback to Claude or secondary endpoints upon persistent errors.
5. **Policy & Sandboxed Execution**: The Executor runs planned tool steps:
   - Evaluated against 5-tier security risk policies.
   - Verified against path traversal and SSRF gates.
   - Actions and parameters logged to audit records with secrets redacted.
6. **Verifier Confirmation**:
   - Every file write is read back from disk to confirm matching byte content.
   - Every API call is verified against expected schemas and status codes.
   - Results are categorized as `verified_success`, `unverified_success`, `partial_success`, or `failure`.
7. **Recovery & Bounded Retries**: Transient failures invoke exponential backoff with bounded retries (`MAX_TOOL_RETRIES = 2`, `MAX_STEPS = 20`) to eliminate infinite autonomous loops.
8. **Memory Consolidation**: Successful solutions or learned user preferences are selectively scored and stored into episodic or semantic memory.
9. **Spoken / Visual Response**: Real-time token streaming to frontend speaker and HUD blades.

---

### 3. Memory Architecture & Hybrid Retrieval

GACKS V2 uses four distinct memory tiers:
- **Working Memory**: Fast, in-turn scratchpad for transient tool outputs and image frames.
- **Episodic Memory**: Log of past tasks, deployments, key decisions, and user instructions.
- **Semantic Memory**: Persistent preferences, project descriptions, operator motto, and tech stack facts.
- **Procedural Memory**: Step-by-step diagnostic sequences and troubleshooting workflows.

#### Hybrid Retrieval Ranking Algorithm:
Candidate memories are scored using a weighted multi-factor formula:

$$\text{Score} = (\text{Keyword Similarity} \times 1.5) + \text{Recency Weight} + \text{Importance Weight}$$

- **Keyword Similarity**: Proportion of search query tokens matching memory tokens.
- **Recency Weight**: Time-decay factor over a 30-day window ($0.0 \dots 0.3$).
- **Importance Weight**: User- or system-assigned weight ($1 \dots 5 \rightarrow 0.1 \dots 0.5$).

Memory safety filters prevent storing API keys, passwords, bearer tokens, or private certificates.

---

### 4. Security & Policy Enforcement

The Policy Engine classifies all tools into 5 strict risk tiers:
- **Level 0 (Read Only)**: Information retrieval (`read_file`, `list_directory`, `check_integrations`, `look`, `capture_screen`). Permitted without confirmation.
- **Level 1 (Low-Risk Write)**: Internal workspace state (`write_file`, `ui_theme`, `manage_mission`, `store_memory`). Enabled when `JARVIS_ALLOW_WRITES=1`.
- **Level 2 (External Side Effect)**: Outbound communication (`send_email`, `send_whatsapp_message`). Requires operator confirmation.
- **Level 3 (Destructive / Security)**: Deletions, shell execution, credential rotations. Always blocked unless explicitly confirmed.
- **Level 4 (Financial / Consequence)**: Purchases, transactions. Always blocked unless explicitly confirmed.

Zero sensitive production secrets are packaged in client-side Vite builds. All API keys remain isolated in server environment variables.
