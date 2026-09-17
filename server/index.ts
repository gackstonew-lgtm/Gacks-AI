try {
  process.loadEnvFile?.()
} catch {}

import { createGatewayServer } from './gateway.js'
import { serviceManager } from './services/service-manager.js'

const { server, port } = createGatewayServer()

server.listen(port, async () => {
  console.log(`====================================================`)
  console.log(` GACKS P.A. V2 — JARVIS SURPASS AGENT RUNTIME`)
  console.log(`====================================================`)
  console.log(`[gacks-pa] Server gateway listening on port ${port}`)
  console.log(`[gacks-pa] WebSocket endpoint: ws://localhost:${port}/ws`)
  console.log(`[gacks-pa] REST API endpoint: http://localhost:${port}/api/v1/health`)
  console.log(`[gacks-pa] AI reasoning runtime: Dynamic Multi-Model Provider (Claude, OpenAI, Gemini, OpenRouter, Local)`)
  console.log(`[gacks-pa] Python AI Core: Vision, RAG, Embeddings, Speech, Documents`)
  console.log(`[gacks-pa] Rust Native Core: Windows Telemetry, Processes, Sandboxed Execution`)
  console.log(`[gacks-pa] Memory engine: Persistent Hybrid DB + Vector Ranking`)
  console.log(`[gacks-pa] Tool Policy: 5-tier sandboxed execution`)
  console.log(`====================================================`)

  await serviceManager.initialize().catch((err) => {
    console.warn('[gacks-pa] Service manager initialization notice:', err?.message || err)
  })
})
