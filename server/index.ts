try {
  process.loadEnvFile?.()
} catch {}

import { createGatewayServer } from './gateway.js'

const { server, port } = createGatewayServer()

server.listen(port, () => {
  console.log(`====================================================`)
  console.log(` GACKS P.A. V2 — JARVIS SURPASS AGENT RUNTIME`)
  console.log(`====================================================`)
  console.log(`[gacks-pa] Server gateway listening on port ${port}`)
  console.log(`[gacks-pa] WebSocket endpoint: ws://localhost:${port}/ws`)
  console.log(`[gacks-pa] REST API endpoint: http://localhost:${port}/api/v1/health`)
  console.log(`[gacks-pa] AI reasoning model: ${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}`)
  console.log(`[gacks-pa] Memory engine: Persistent Hybrid DB + Vector Ranking`)
  console.log(`[gacks-pa] Tool Policy: 5-tier sandboxed execution`)
  console.log(`====================================================`)
})
