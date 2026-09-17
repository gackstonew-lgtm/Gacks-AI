import http from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import { db } from './db/index.js'
import { orchestrator } from './agent/orchestrator.js'
import { aiOrchestrator } from './agent/ai-orchestrator.js'
import { toolRegistry } from './tools/registry.js'
import { memoryStore } from './memory/memory-store.js'
import { renderPage } from '../bridge/page.mjs'
import { spawn } from 'node:child_process'
import { workspaceManager } from './security/workspace.js'
import { terminalService } from './terminal/terminal-service.js'
import { apiRegistry } from './api/registry.js'
import { catalogSync } from './api/catalog-sync.js'
import { credentialManager } from './api/credential-manager.js'
import { dailyOperationsAgent } from './business/agents/operations-agent.js'
import { forexAnalysisAuditor } from './business/agents/forex-auditor.js'
import { businessGrowthAgent } from './business/agents/growth-agent.js'
import { crmService } from './business/crm-service.js'
import { approvalCenter } from './business/approval-center.js'
import { automationEngine } from './business/automation-engine.js'
import { modelRouter } from './agent/model-router.js'
import { modelRegistry } from './agent/model-registry.js'
import { modelDiscovery } from './agent/model-discovery.js'
import { hardwareAdvisor } from './agent/hardware-advisor.js'
import { ollamaAdapter } from './agent/providers/ollama-adapter.js'
import { systemMonitor } from './system/system-monitor.js'
import { localFilesystemService } from './system/filesystem-service.js'
import { capabilityRegistry } from './system/capability-registry.js'
import { windowsSystemService } from './system/windows-system-service.js'
import { systemAuditLogger } from './system/audit-logger.js'
import { webHuntService } from './webhunt/webhunt-service.js'
import { androidAdapter } from './system/android-adapter.js'
import { serviceManager } from './services/service-manager.js'
import { pythonServiceBridge } from './services/python-service-bridge.js'
import { rustServiceBridge } from './services/rust-service-bridge.js'
import type { SystemHealthReport } from './types.js'

const PORT = Number(process.env.JARVIS_BRIDGE_PORT || process.env.GATEWAY_PORT || process.env.PORT || 8787)
const EXTRA_ORIGINS = new Set(
  (process.env.JARVIS_ALLOWED_ORIGINS ?? process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean),
)
const ALLOW_NO_ORIGIN = process.env.JARVIS_ALLOW_NO_ORIGIN === '1'
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0'])
const isDevPort = (port: number) =>
  (port >= 5173 && port <= 5199) || (port >= 4173 && port <= 4199) || port === 3000

function originAllowed(origin?: string): boolean {
  if (!origin) return true
  const normalized = origin.replace(/\/+$/, '')
  if (EXTRA_ORIGINS.has(normalized)) return true
  // Allow Vercel production domain
  if (normalized.includes('vercel.app')) return true

  let url: URL
  try {
    url = new URL(origin)
  } catch {
    return false
  }
  if ((url.protocol === 'http:' || url.protocol === 'https:') && LOCAL_HOSTS.has(url.hostname)) {
    return true
  }
  if (/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(url.hostname)) {
    return true
  }
  if (url.protocol === 'https:' && url.hostname.endsWith('vercel.app')) {
    return true
  }
  return false
}

function corsFor(req: http.IncomingMessage) {
  const origin = req.headers.origin
  const headers: Record<string, string> = {
    vary: 'origin',
    'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
  }
  if (origin) {
    headers['access-control-allow-origin'] = origin
  } else {
    headers['access-control-allow-origin'] = '*'
  }
  return headers
}

const IMAGE_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

let elevenLabsVerified: boolean | null = null
async function isElevenLabsWorking(): Promise<boolean> {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key || key === 'placeholder' || key.startsWith('optional_')) return false
  if (elevenLabsVerified !== null) return elevenLabsVerified
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: { 'xi-api-key': key },
      signal: AbortSignal.timeout(2500),
    })
    elevenLabsVerified = res.ok
    return elevenLabsVerified
  } catch {
    elevenLabsVerified = false
    return false
  }
}

export function createGatewayServer() {
  const server = http.createServer(async (req, res) => {
    const cors = corsFor(req)

    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors)
      return res.end()
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const pathname = url.pathname

    try {
      // --- 1. Health Telemetry Endpoint ---
      if (pathname === '/health' || pathname === '/api/v1/health') {
        const hasGemini = Boolean(process.env.GEMINI_API_KEY)
        const hasOpenAI = Boolean(process.env.OPENAI_API_KEY)
        const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY)
        const hasEleven = await isElevenLabsWorking()
        const adbOk = await androidAdapter.isAdbAvailable().catch(() => false)

        const report: SystemHealthReport = {
          ok: true,
          service: 'gacks-agent-gateway',
          timestamp: Date.now(),
          version: '2.0.0',
          environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
          ai: hasGemini || hasOpenAI || hasAnthropic || true,
          stt: hasEleven,
          tts: hasEleven,
          browser: true,
          filesystem: true,
          android: adbOk,
          imageGeneration: true,
          mcp: true,
          osAutomation: true,
          terminal: true,
          webhunt: true,
          memory: true,
          services: {
            ai: {
              status: (hasAnthropic || hasOpenAI || hasGemini) ? 'ONLINE' : 'DEGRADED',
              provider: 'Dynamic Multi-Model Core',
              model: process.env.DEFAULT_AI_MODEL && process.env.DEFAULT_AI_MODEL !== 'auto'
                ? process.env.DEFAULT_AI_MODEL
                : 'Dynamic Auto Selection (Anthropic / OpenAI / Gemini / OpenRouter)',
            },
            memory: {
              status: 'ONLINE',
              engine: 'Persistent Memory Store (Hybrid Scoring)',
              count: db.getAllMemories().length,
            },
            tools: {
              status: 'ONLINE',
              count: toolRegistry.getToolNames().length,
            },
            voice: {
              status: 'ONLINE',
              tts: hasEleven,
              stt: hasEleven,
              engine: hasEleven ? 'ElevenLabs Streaming' : 'Browser Speech Recognition & Neural SpeechSynthesis',
            },
            vision: {
              status: 'ONLINE',
              camera: true,
              screen: true,
            },
            integrations: {
              github: process.env.GITHUB_TOKEN ? 'CONNECTED' : 'NOT_CONFIGURED',
              vercel: process.env.VERCEL_TOKEN ? 'CONNECTED' : 'NOT_CONFIGURED',
              email: process.env.EMAIL_HOST ? 'CONNECTED' : 'NOT_CONFIGURED',
              whatsapp: process.env.WHATSAPP_API_TOKEN ? 'CONNECTED' : 'NOT_CONFIGURED',
            },
            pythonAi: {
              status: pythonServiceBridge.isServiceOnline() ? 'ONLINE' : 'DEGRADED',
              service: 'gacks-python-ai-core',
              version: '2.0.0',
              capabilities: ['vision', 'ocr', 'embeddings', 'rag', 'speech_analysis', 'document_intelligence'],
            },
            rustNative: {
              status: rustServiceBridge.isServiceOnline() ? 'ONLINE' : 'DEGRADED',
              service: 'gacks-rust-native-core',
              version: '2.0.0',
              capabilities: ['system_hardware', 'processes', 'windows', 'filesystem', 'clipboard', 'sandboxed_exec'],
            },
          },
        }

        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify(report))
      }

      // --- 1.05 Specialized Services Status & Capabilities ---
      if (pathname === '/api/v1/services/status' && req.method === 'GET') {
        const status = await serviceManager.getSystemStatus()
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify(status))
      }

      if (pathname === '/api/v1/services/capabilities' && req.method === 'GET') {
        const status = await serviceManager.getSystemStatus()
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify(status.capabilities))
      }

      // --- 1.1 Real System Hardware Telemetry Endpoint ---
      if (pathname === '/api/v1/system/metrics' && req.method === 'GET') {
        try {
          const metrics = await systemMonitor.getMetrics()
          res.writeHead(200, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify(metrics))
        } catch (err: any) {
          res.writeHead(500, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: err.message || 'Failed to gather hardware metrics' }))
        }
      }

      // --- 1.2 System Capabilities & Permissions Endpoint ---
      if (pathname === '/api/v1/system/capabilities' && req.method === 'GET') {
        const legacyCaps = systemMonitor.getCapabilities()
        const regStatus = capabilityRegistry.getStatus()
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ ...legacyCaps, ...regStatus }))
      }

      if (pathname === '/api/v1/system/capabilities/permission' && req.method === 'PATCH') {
        let body = ''
        for await (const chunk of req) body += chunk
        const { id, state } = JSON.parse(body || '{}')
        if (!id || !state) {
          res.writeHead(400, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'id and state are required' }))
        }
        const ok = capabilityRegistry.setPermission(id, state)
        res.writeHead(ok ? 200 : 400, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ success: ok, capability: capabilityRegistry.getCapability(id) }))
      }

      // --- 1.3 Hardware Telemetry & Vitals ---
      if (pathname === '/api/v1/system/hardware' && req.method === 'GET') {
        try {
          const report = await windowsSystemService.getHardwareReport()
          res.writeHead(200, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify(report))
        } catch (err: any) {
          res.writeHead(500, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: err.message || 'Failed to gather hardware report' }))
        }
      }

      // --- 1.4 Hardware Devices & Network Telemetry ---
      if (pathname === '/api/v1/system/devices' && req.method === 'GET') {
        try {
          const devices = await windowsSystemService.getDevicesReport()
          res.writeHead(200, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify(devices))
        } catch (err: any) {
          res.writeHead(500, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: err.message || 'Failed to gather devices' }))
        }
      }

      // --- 1.5 Task Manager & Processes ---
      if (pathname === '/api/v1/system/processes' && req.method === 'GET') {
        try {
          const limit = Math.min(100, Math.max(5, Number(url.searchParams.get('limit') || 35)))
          const procs = await windowsSystemService.getProcesses(limit)
          res.writeHead(200, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ total: procs.length, processes: procs }))
        } catch (err: any) {
          res.writeHead(500, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: err.message }))
        }
      }

      if (pathname === '/api/v1/system/processes/terminate' && req.method === 'POST') {
        let body = ''
        for await (const chunk of req) body += chunk
        const { pid, confirmName, hasConfirmation } = JSON.parse(body || '{}')
        if (pid === undefined || !confirmName) {
          res.writeHead(400, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'pid and confirmName are required' }))
        }
        const result = await windowsSystemService.terminateProcess(Number(pid), String(confirmName), Boolean(hasConfirmation))
        res.writeHead(result.success ? 200 : 400, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify(result))
      }

      // --- 1.6 Applications Management ---
      if (pathname === '/api/v1/system/apps' && req.method === 'GET') {
        try {
          const [installed, running] = await Promise.all([
            windowsSystemService.getInstalledApps(),
            windowsSystemService.getRunningApps(),
          ])
          res.writeHead(200, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ installed, running }))
        } catch (err: any) {
          res.writeHead(500, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: err.message }))
        }
      }

      if (pathname === '/api/v1/system/apps/launch' && req.method === 'POST') {
        let body = ''
        for await (const chunk of req) body += chunk
        const { app, hasConfirmation } = JSON.parse(body || '{}')
        if (!app) {
          res.writeHead(400, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'app name or path is required' }))
        }
        const result = await windowsSystemService.launchApp(String(app), Boolean(hasConfirmation))
        res.writeHead(result.success ? 200 : 400, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify(result))
      }

      // --- 1.7 Clipboard Integration ---
      if (pathname === '/api/v1/system/clipboard' && req.method === 'GET') {
        const hasConfirmation = url.searchParams.get('confirm') === '1'
        const result = await windowsSystemService.readClipboard(hasConfirmation)
        res.writeHead(result.success ? 200 : 400, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify(result))
      }

      if (pathname === '/api/v1/system/clipboard' && req.method === 'POST') {
        let body = ''
        for await (const chunk of req) body += chunk
        const { text, hasConfirmation } = JSON.parse(body || '{}')
        if (text === undefined) {
          res.writeHead(400, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'text is required' }))
        }
        const result = await windowsSystemService.writeClipboard(String(text), Boolean(hasConfirmation))
        res.writeHead(result.success ? 200 : 400, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify(result))
      }

      // --- 1.8 Desktop Notifications ---
      if (pathname === '/api/v1/system/notify' && req.method === 'POST') {
        let body = ''
        for await (const chunk of req) body += chunk
        const { title, message } = JSON.parse(body || '{}')
        if (!title || !message) {
          res.writeHead(400, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'title and message are required' }))
        }
        const result = await windowsSystemService.sendNotification(String(title), String(message))
        res.writeHead(result.success ? 200 : 400, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify(result))
      }

      // --- 1.9 Windows Services (Read-Only) ---
      if (pathname === '/api/v1/system/services' && req.method === 'GET') {
        try {
          const limit = Math.min(100, Math.max(5, Number(url.searchParams.get('limit') || 30)))
          const services = await windowsSystemService.getRunningServices(limit)
          res.writeHead(200, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ services }))
        } catch (err: any) {
          res.writeHead(500, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: err.message }))
        }
      }

      // --- 1.10 System Audit Log ---
      if (pathname === '/api/v1/system/audit-log' && req.method === 'GET') {
        const limit = Math.min(200, Math.max(5, Number(url.searchParams.get('limit') || 50)))
        const capability = (url.searchParams.get('capability') as any) || undefined
        const entries = systemAuditLogger.getEntries(limit, capability)
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ total: entries.length, entries }))
      }

      // --- 2. Tasks API ---
      if (pathname === '/api/v1/tasks' && req.method === 'GET') {
        const tasks = db.getTasks()
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ tasks }))
      }

      if (pathname === '/api/v1/tasks' && req.method === 'POST') {
        let body = ''
        for await (const chunk of req) body += chunk
        const { text } = JSON.parse(body || '{}')
        if (!text) {
          res.writeHead(400, cors)
          return res.end(JSON.stringify({ error: 'Text required' }))
        }
        const task = db.addTask(text)
        res.writeHead(201, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ task }))
      }

      if (pathname.startsWith('/api/v1/tasks/') && pathname.endsWith('/toggle') && req.method === 'POST') {
        const id = pathname.split('/')[4]
        const task = db.toggleTask(id)
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ task }))
      }

      if (pathname.startsWith('/api/v1/tasks/') && req.method === 'DELETE') {
        const id = pathname.split('/')[4]
        const deleted = db.deleteTask(id)
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ deleted }))
      }

      // --- 3. Mission API ---
      if (pathname === '/api/v1/mission' && req.method === 'GET') {
        const mission = db.getActiveMission()
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ mission }))
      }

      // --- 4. Memories API ---
      if (pathname === '/api/v1/memories' && req.method === 'GET') {
        const query = url.searchParams.get('q') || ''
        const memories = query
          ? memoryStore.searchMemories({ query, limit: 10 })
          : db.getAllMemories()
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ memories }))
      }

      // --- 5. Speech Synthesis (/tts) ---
      if (pathname === '/tts' && req.method === 'POST') {
        const key = process.env.ELEVENLABS_API_KEY
        if (!key) {
          res.writeHead(503, cors)
          return res.end('no elevenlabs key')
        }
        let body = ''
        for await (const chunk of req) body += chunk
        const { text } = JSON.parse(body || '{}')
        if (!text) {
          res.writeHead(400, cors)
          return res.end('no text')
        }

        const voiceId = process.env.JARVIS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb'
        const upstream = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_22050_32&optimize_streaming_latency=3`,
          {
            method: 'POST',
            headers: { 'xi-api-key': key, 'content-type': 'application/json' },
            body: JSON.stringify({
              text,
              model_id: 'eleven_flash_v2_5',
              voice_settings: { stability: 0.4, similarity_boost: 0.75, speed: 1.05 },
            }),
          },
        )
        if (!upstream.ok) {
          const errText = await upstream.text()
          res.writeHead(upstream.status, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'TTS upstream error', status: upstream.status, details: errText }))
        }
        res.writeHead(200, { ...cors, 'content-type': 'audio/mpeg', 'cache-control': 'no-cache' })
        for await (const chunk of (upstream as any).body) {
          res.write(Buffer.from(chunk))
        }
        return res.end()
      }

      // --- 6. Speech-to-Text (/stt) ---
      if (pathname === '/stt' && req.method === 'POST') {
        const key = process.env.ELEVENLABS_API_KEY
        if (!key) {
          res.writeHead(503, cors)
          return res.end('no elevenlabs key')
        }
        const chunks: Buffer[] = []
        let size = 0
        for await (const chunk of req) {
          chunks.push(chunk)
          size += chunk.length
          if (size > 25 * 1024 * 1024) break
        }
        if (size < 1200) {
          res.writeHead(200, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ text: '' }))
        }

        const form = new FormData()
        form.append('model_id', 'scribe_v1')
        form.append('file', new Blob([Buffer.concat(chunks)]), 'speech.webm')

        const upstream = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
          method: 'POST',
          headers: { 'xi-api-key': key },
          body: form,
        })
        if (!upstream.ok) {
          const errText = await upstream.text()
          res.writeHead(upstream.status, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'STT upstream error', status: upstream.status, details: errText }))
        }
        const data = (await upstream.json()) as any
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ text: (data.text ?? '').trim() }))
      }

      // --- 7. Safe File Image Server (/file) ---
      if (pathname === '/file' && req.method === 'GET') {
        const asked = url.searchParams.get('path') ?? ''
        let real: string | null = null
        try {
          if (isAbsolute(asked)) real = await realpath(asked)
        } catch {
          real = null
        }
        const dot = real ? real.lastIndexOf('.') : -1
        const ext = dot === -1 ? '' : real!.slice(dot).toLowerCase()

        if (!real || !IMAGE_TYPES[ext]) {
          res.writeHead(400, cors)
          return res.end('images only')
        }
        const body = await readFile(real)
        res.writeHead(200, { ...cors, 'content-type': IMAGE_TYPES[ext] })
        return res.end(body)
      }

      // --- 8. Webpage Reader Proxy (/page) ---
      if (pathname === '/page' && req.method === 'GET') {
        const target = url.searchParams.get('url') ?? ''
        const mode = url.searchParams.get('mode') === 'live' ? 'live' : 'reader'
        try {
          const page = await renderPage(target, mode, `http://localhost:${PORT}`)
          res.writeHead(200, { ...cors, ...page.headers })
          return res.end(page.body)
        } catch (err: any) {
          res.writeHead(err.status ?? 502, { ...cors, 'content-type': 'text/html; charset=utf-8' })
          return res.end(`<b>This page could not be opened.</b> ${err?.message ?? ''}`)
        }
      }

      // --- 9. Workspaces Management API ---
      if (pathname === '/api/v1/workspaces' && req.method === 'GET') {
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(
          JSON.stringify({
            workspaces: workspaceManager.getWorkspaces(),
            activeWorkspace: workspaceManager.getActiveWorkspace(),
          }),
        )
      }

      if (pathname === '/api/v1/workspaces' && req.method === 'POST') {
        let body = ''
        for await (const chunk of req) body += chunk
        const { path: folderPath, name, permissions } = JSON.parse(body || '{}')
        if (!folderPath) {
          res.writeHead(400, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'Folder path is required' }))
        }
        try {
          const ws = await workspaceManager.addWorkspace(folderPath, name, permissions)
          res.writeHead(201, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ workspace: ws }))
        } catch (e: any) {
          res.writeHead(400, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: e.message }))
        }
      }

      if (pathname === '/api/v1/workspaces/select' && req.method === 'POST') {
        let body = ''
        for await (const chunk of req) body += chunk
        const { id } = JSON.parse(body || '{}')
        if (!id) {
          res.writeHead(400, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'Workspace id is required' }))
        }
        const ok = workspaceManager.setActiveWorkspace(id)
        res.writeHead(ok ? 200 : 404, { ...cors, 'content-type': 'application/json' })
        return res.end(
          JSON.stringify({
            success: ok,
            activeWorkspace: workspaceManager.getActiveWorkspace(),
          }),
        )
      }

      if (pathname === '/api/v1/workspaces' && req.method === 'DELETE') {
        let body = ''
        for await (const chunk of req) body += chunk
        let id = url.searchParams.get('id')
        if (!id && body) {
          try {
            id = JSON.parse(body).id
          } catch {}
        }
        if (!id) {
          res.writeHead(400, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'Workspace id is required' }))
        }
        const ok = await workspaceManager.revokeWorkspace(id)
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ success: ok }))
      }

      // --- 10. Genuine Windows-Style Local Filesystem API ---
      if (pathname === '/api/v1/fs/drives' && req.method === 'GET') {
        try {
          const drives = await localFilesystemService.getDrives()
          res.writeHead(200, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ drives, defaultPath: localFilesystemService.getDefaultPath() }))
        } catch (err: any) {
          res.writeHead(500, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: err.message }))
        }
      }

      if (pathname === '/api/v1/fs/list' && req.method === 'GET') {
        const reqPath = url.searchParams.get('path') || ''
        try {
          const result = await localFilesystemService.listDirectory(reqPath)
          res.writeHead(200, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify(result))
        } catch (err: any) {
          const status = err.code === 'EACCES' || err.code === 'EPERM' ? 403 : err.code === 'ENOENT' ? 404 : 500
          res.writeHead(status, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: err.message, code: err.code }))
        }
      }

      if (pathname === '/api/v1/fs/read' && req.method === 'GET') {
        const reqPath = url.searchParams.get('path') || ''
        if (!reqPath) {
          res.writeHead(400, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'Path parameter is required' }))
        }
        try {
          const preview = await localFilesystemService.readFilePreview(reqPath)
          res.writeHead(200, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify(preview))
        } catch (err: any) {
          const status = err.code === 'EACCES' || err.code === 'EPERM' ? 403 : err.code === 'ENOENT' ? 404 : 500
          res.writeHead(status, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: err.message, code: err.code }))
        }
      }

      if (pathname === '/api/v1/fs/write' && req.method === 'POST') {
        let body = ''
        for await (const chunk of req) body += chunk
        const { path: reqPath, content = '' } = JSON.parse(body || '{}')
        if (!reqPath) {
          res.writeHead(400, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'Path is required' }))
        }

        try {
          const safePath = localFilesystemService.sanitizePath(reqPath)
          await writeFile(safePath, content, 'utf-8')
          res.writeHead(200, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ success: true, path: safePath }))
        } catch (err: any) {
          res.writeHead(500, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: err.message }))
        }
      }

      if (pathname === '/api/v1/fs/mkdir' && req.method === 'POST') {
        let body = ''
        for await (const chunk of req) body += chunk
        const parsed = JSON.parse(body || '{}')
        const parentPath = parsed.parentPath || parsed.path
        const folderName = parsed.folderName || parsed.name || 'New Folder'

        if (!parentPath) {
          res.writeHead(400, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'parentPath is required' }))
        }

        try {
          const created = await localFilesystemService.createDirectory(parentPath, folderName)
          res.writeHead(201, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ success: true, path: created }))
        } catch (err: any) {
          res.writeHead(500, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: err.message }))
        }
      }

      if (pathname === '/api/v1/fs/rename' && req.method === 'POST') {
        let body = ''
        for await (const chunk of req) body += chunk
        const { oldPath, newName } = JSON.parse(body || '{}')
        if (!oldPath || !newName) {
          res.writeHead(400, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'oldPath and newName are required' }))
        }

        try {
          const updated = await localFilesystemService.renameEntry(oldPath, newName)
          res.writeHead(200, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ success: true, path: updated }))
        } catch (err: any) {
          res.writeHead(500, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: err.message }))
        }
      }

      if (pathname === '/api/v1/fs/delete' && req.method === 'POST') {
        let body = ''
        for await (const chunk of req) body += chunk
        const { targetPath, confirmName } = JSON.parse(body || '{}')
        if (!targetPath || !confirmName) {
          res.writeHead(400, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'targetPath and confirmName are required' }))
        }

        try {
          await localFilesystemService.deleteEntry(targetPath, confirmName)
          res.writeHead(200, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ success: true }))
        } catch (err: any) {
          res.writeHead(500, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: err.message }))
        }
      }

      if (pathname === '/api/v1/fs/reveal' && req.method === 'POST') {
        let body = ''
        for await (const chunk of req) body += chunk
        const { path: reqPath = '.' } = JSON.parse(body || '{}')
        const validation = workspaceManager.validatePath(reqPath, 'read')
        if (!validation.valid || !validation.resolvedPath) {
          res.writeHead(403, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: validation.error || 'Access denied' }))
        }

        const target = validation.resolvedPath
        try {
          if (process.platform === 'win32') {
            spawn('explorer.exe', ['/select,', target], { detached: true, stdio: 'ignore' }).unref()
          } else if (process.platform === 'darwin') {
            spawn('open', ['-R', target], { detached: true, stdio: 'ignore' }).unref()
          } else {
            spawn('xdg-open', [target], { detached: true, stdio: 'ignore' }).unref()
          }
          res.writeHead(200, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ success: true, path: target }))
        } catch (err: any) {
          res.writeHead(500, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: err.message }))
        }
      }

      // --- 11. Controlled Terminal Execution API ---
      if (pathname === '/api/v1/terminal/tasks' && req.method === 'GET') {
        const limit = Number(url.searchParams.get('limit') || 25)
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ tasks: terminalService.getRecentTasks(limit) }))
      }

      if (pathname === '/api/v1/terminal/run' && req.method === 'POST') {
        let body = ''
        for await (const chunk of req) body += chunk
        const { command, cwd, timeoutMs } = JSON.parse(body || '{}')
        if (!command) {
          res.writeHead(400, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'Command is required' }))
        }
        try {
          const task = await terminalService.executeCommand(command, { cwd, timeoutMs })
          res.writeHead(200, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ task }))
        } catch (err: any) {
          res.writeHead(400, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: err.message }))
        }
      }

      if (pathname === '/api/v1/terminal/cancel' && req.method === 'POST') {
        let body = ''
        for await (const chunk of req) body += chunk
        const { taskId } = JSON.parse(body || '{}')
        if (!taskId) {
          res.writeHead(400, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'taskId is required' }))
        }
        const cancelled = terminalService.cancelTask(taskId)
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ cancelled }))
      }

      // --- 12. External Public APIs & Capability Registry API ---
      if (pathname === '/api/v1/apis/catalog' && req.method === 'GET') {
        const query = url.searchParams.get('q') || undefined
        const category = url.searchParams.get('category') || undefined
        const authType = url.searchParams.get('authType') || undefined
        const installedOnly = url.searchParams.get('installedOnly') === '1' || url.searchParams.get('installedOnly') === 'true'

        const entries = apiRegistry.searchCatalog({
          query,
          category,
          authType,
          installedOnly,
        })
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ total: entries.length, entries }))
      }

      if (pathname === '/api/v1/apis/categories' && req.method === 'GET') {
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ categories: catalogSync.getCategories() }))
      }

      if (pathname === '/api/v1/apis/sync' && req.method === 'POST') {
        try {
          const result = await catalogSync.syncFromRemote()
          res.writeHead(200, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ success: true, ...result }))
        } catch (err: any) {
          res.writeHead(500, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: err.message }))
        }
      }

      if (pathname === '/api/v1/apis/credentials' && req.method === 'GET') {
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ credentials: credentialManager.getMaskedCredentials() }))
      }

      if (pathname === '/api/v1/apis/credentials' && req.method === 'POST') {
        let body = ''
        for await (const chunk of req) body += chunk
        const { providerId, providerName, authType, apiKey, oauthToken } = JSON.parse(body || '{}')
        if (!providerId) {
          res.writeHead(400, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'providerId is required' }))
        }
        try {
          const cred = await credentialManager.setCredential(
            providerId,
            providerName || providerId,
            authType || 'apiKey',
            { apiKey, oauthToken },
          )
          res.writeHead(200, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ success: true, providerId: cred.providerId, updatedAt: cred.updatedAt }))
        } catch (err: any) {
          res.writeHead(400, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: err.message }))
        }
      }

      if (pathname === '/api/v1/apis/credentials' && req.method === 'DELETE') {
        let body = ''
        for await (const chunk of req) body += chunk
        const parsed = JSON.parse(body || '{}')
        const providerId = url.searchParams.get('providerId') || parsed.providerId
        if (!providerId) {
          res.writeHead(400, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'providerId is required' }))
        }
        const deleted = await credentialManager.deleteCredential(providerId)
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ success: deleted }))
      }

      if (pathname === '/api/v1/apis/test' && req.method === 'POST') {
        let body = ''
        for await (const chunk of req) body += chunk
        const { providerId } = JSON.parse(body || '{}')
        if (!providerId) {
          res.writeHead(400, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'providerId is required' }))
        }
        try {
          const status = await apiRegistry.getProviderStatus(providerId)
          res.writeHead(200, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ status }))
        } catch (err: any) {
          res.writeHead(400, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: err.message }))
        }
      }

      if (pathname === '/api/v1/apis/execute' && req.method === 'POST') {
        let body = ''
        for await (const chunk of req) body += chunk
        const { providerId, operation, params } = JSON.parse(body || '{}')
        if (!providerId || !operation) {
          res.writeHead(400, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'providerId and operation are required' }))
        }
        try {
          const result = await apiRegistry.execute(providerId, operation, params || {})
          res.writeHead(200, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify(result))
        } catch (err: any) {
          res.writeHead(400, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: err.message }))
        }
      }

      // --- 11. JAVIS BS — Custom Business Suite APIs ---

      // Morning Executive Briefing
      if (pathname === '/api/v1/business/briefing' && req.method === 'GET') {
        const workspaceId = url.searchParams.get('workspaceId') || 'default-workspace'
        const briefing = dailyOperationsAgent.generateMorningBriefing('default', workspaceId)
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify(briefing))
      }

      // Approval Center Requests
      if (pathname === '/api/v1/business/approvals' && req.method === 'GET') {
        const workspaceId = url.searchParams.get('workspaceId') || undefined
        const pending = approvalCenter.getPending(workspaceId)
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ approvals: pending }))
      }

      if (pathname === '/api/v1/business/approvals' && req.method === 'POST') {
        let body = ''
        for await (const chunk of req) body += chunk
        const { id, decision, resolvedBy, editedPayload } = JSON.parse(body || '{}')
        if (!id || !decision) {
          res.writeHead(400, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'id and decision are required' }))
        }
        const resolved = approvalCenter.resolveRequest(id, decision, resolvedBy || 'operator', editedPayload)
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ request: resolved }))
      }

      // CRM Customers & Leads
      if (pathname === '/api/v1/business/crm' && req.method === 'GET') {
        const workspaceId = url.searchParams.get('workspaceId') || 'default-workspace'
        const urgentOnly = url.searchParams.get('urgent') === '1'
        const customers = urgentOnly
          ? crmService.getUrgentAttentionList(workspaceId)
          : crmService.getCustomers(workspaceId)
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ customers }))
      }

      // Forex Trade Audit
      if (pathname === '/api/v1/business/forex/audit' && req.method === 'POST') {
        let body = ''
        for await (const chunk of req) body += chunk
        const auditInput = JSON.parse(body || '{}')
        if (!auditInput.pair || !auditInput.entryPrice || !auditInput.stopLoss || !auditInput.takeProfit) {
          res.writeHead(400, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'pair, entryPrice, stopLoss, and takeProfit are required' }))
        }
        const report = forexAnalysisAuditor.auditTrade(auditInput)
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ report }))
      }

      // Growth Metrics & Business Goals
      if (pathname === '/api/v1/business/growth/metrics' && req.method === 'GET') {
        const workspaceId = url.searchParams.get('workspaceId') || 'default-workspace'
        const growth = businessGrowthAgent.analyzeGrowth(workspaceId)
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify(growth))
      }

      // Automation Rules
      if (pathname === '/api/v1/business/automations' && req.method === 'GET') {
        const workspaceId = url.searchParams.get('workspaceId') || 'default-workspace'
        const rules = automationEngine.getRules(workspaceId)
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ rules }))
      }

      if (pathname === '/api/v1/business/automations/trigger' && req.method === 'POST') {
        let body = ''
        for await (const chunk of req) body += chunk
        const { ruleId, payload } = JSON.parse(body || '{}')
        if (!ruleId) {
          res.writeHead(400, { ...cors, 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'ruleId is required' }))
        }
        const result = await automationEngine.triggerRule(ruleId, payload || {})
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify(result))
      }

      // Multi-Provider AI Usage & Telemetry
      if (pathname === '/api/v1/ai/usage' && req.method === 'GET') {
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify(modelRouter.getUsageSummary()))
      }

      // ===========================================================================
      // Multi-Model AI Operating System REST API (Phase 21-24, 33, 41-43, 46-47)
      // ===========================================================================


    // --- GET /api/v1/models --- List all registered models
    if (pathname === '/api/v1/models' && req.method === 'GET') {
      const filter = url.searchParams.get('filter') // 'local' | 'cloud' | 'all'
      const role = url.searchParams.get('role')

      let models = modelRegistry.getAll()
      if (filter === 'local') models = models.filter((m) => m.isLocal)
      else if (filter === 'cloud') models = models.filter((m) => !m.isLocal)
      if (role) models = models.filter((m) => m.roles.includes(role as never))

      res.writeHead(200, { ...cors, 'content-type': 'application/json' })
      return res.end(JSON.stringify({ models, total: models.length }))
    }

    // --- GET /api/v1/models/:id --- Get single model descriptor
    if (pathname.startsWith('/api/v1/models/') && req.method === 'GET') {
      const modelId = decodeURIComponent(pathname.slice('/api/v1/models/'.length))
      const model = modelRegistry.getById(modelId)
      if (!model) {
        res.writeHead(404, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ error: 'Model not found' }))
      }
      res.writeHead(200, { ...cors, 'content-type': 'application/json' })
      return res.end(JSON.stringify(model))
    }

    // --- POST /api/v1/models/test --- Test connectivity and health of a specific model
    if ((pathname === '/api/v1/models/test' || (pathname.startsWith('/api/v1/models/') && pathname.endsWith('/test'))) && req.method === 'POST') {
      let body = ''
      for await (const chunk of req) body += chunk
      const parsed = JSON.parse(body || '{}')
      let modelId = parsed.modelId
      if (!modelId && pathname.endsWith('/test')) {
        modelId = decodeURIComponent(pathname.slice('/api/v1/models/'.length, -('/test'.length)))
      }
      if (!modelId) {
        res.writeHead(400, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ error: 'modelId is required' }))
      }
      try {
        const result = await modelRouter.testModel(modelId)
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify(result))
      } catch (err: unknown) {
        res.writeHead(500, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ error: String(err) }))
      }
    }

    // --- PATCH /api/v1/models/:id --- Update model configuration (enabled, priority, parameters)
    if (pathname.startsWith('/api/v1/models/') && !pathname.includes('/route') && !pathname.includes('/discover') && !pathname.includes('/preferences') && !pathname.includes('/hardware') && !pathname.includes('/install') && !pathname.includes('/telemetry') && !pathname.includes('/health') && !pathname.includes('/compare') && req.method === 'PATCH') {
      const modelId = decodeURIComponent(pathname.slice('/api/v1/models/'.length))
      let body = ''
      for await (const chunk of req) body += chunk
      const updates = JSON.parse(body || '{}')
      const updated = modelRegistry.update(modelId, updates)
      if (!updated) {
        res.writeHead(404, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ error: 'Model not found' }))
      }
      res.writeHead(200, { ...cors, 'content-type': 'application/json' })
      return res.end(JSON.stringify({ success: true, model: updated }))
    }

    // --- POST /api/v1/models/custom --- Register a new custom model
    if (pathname === '/api/v1/models/custom' && req.method === 'POST') {
      let body = ''
      for await (const chunk of req) body += chunk
      const customData = JSON.parse(body || '{}')
      if (!customData.id || !customData.displayName || !customData.provider || !customData.modelName) {
        res.writeHead(400, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ error: 'id, displayName, provider, and modelName are required' }))
      }
      try {
        const registered = modelRegistry.registerCustom(customData)
        res.writeHead(201, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ success: true, model: registered }))
      } catch (err: unknown) {
        res.writeHead(400, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ error: String(err) }))
      }
    }

    // --- DELETE /api/v1/models/:id --- Remove a custom model
    if (pathname.startsWith('/api/v1/models/') && !pathname.includes('/preferences') && req.method === 'DELETE') {
      const modelId = decodeURIComponent(pathname.slice('/api/v1/models/'.length))
      const ok = modelRegistry.deleteCustom(modelId)
      res.writeHead(ok ? 200 : 400, { ...cors, 'content-type': 'application/json' })
      return res.end(JSON.stringify({ success: ok, message: ok ? 'Custom model deleted' : 'Cannot delete built-in model' }))
    }

    // --- GET /api/v1/models/budget --- Get budget settings
    if (pathname === '/api/v1/models/budget' && req.method === 'GET') {
      res.writeHead(200, { ...cors, 'content-type': 'application/json' })
      return res.end(JSON.stringify(modelRouter.getBudgetConfig()))
    }

    // --- PATCH /api/v1/models/budget --- Update budget settings
    if (pathname === '/api/v1/models/budget' && req.method === 'PATCH') {
      let body = ''
      for await (const chunk of req) body += chunk
      const updates = JSON.parse(body || '{}')
      const config = modelRouter.setBudgetConfig(updates)
      res.writeHead(200, { ...cors, 'content-type': 'application/json' })
      return res.end(JSON.stringify({ success: true, budget: config }))
    }

    // --- POST /api/v1/models/route --- Get routing recommendation for a task
    if (pathname === '/api/v1/models/route' && req.method === 'POST') {
      let body = ''
      for await (const chunk of req) body += chunk
      const { profile, routingMode, privacyPolicy, preferredModelId, requiresVision } = JSON.parse(body || '{}')
      try {
        const result = await aiOrchestrator.route({
          profile: profile || 'GENERAL',
          routingMode,
          privacyPolicy,
          preferredModelId,
          requiresVision: Boolean(requiresVision),
        })
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify(result))
      } catch (err: unknown) {
        res.writeHead(500, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ error: String(err) }))
      }
    }

    // --- POST /api/v1/models/discover --- Discover locally-installed models
    if (pathname === '/api/v1/models/discover' && req.method === 'POST') {
      try {
        const result = await modelDiscovery.discover()
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify(result))
      } catch (err: unknown) {
        res.writeHead(500, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ error: String(err) }))
      }
    }

    // --- GET /api/v1/models/discovery/status --- Last discovery result
    if (pathname === '/api/v1/models/discovery/status' && req.method === 'GET') {
      const result = modelDiscovery.getLastResult()
      res.writeHead(200, { ...cors, 'content-type': 'application/json' })
      return res.end(JSON.stringify(result ?? { message: 'Discovery not yet run' }))
    }

    // --- GET /api/v1/models/hardware --- Hardware compatibility report
    if (pathname === '/api/v1/models/hardware' && req.method === 'GET') {
      try {
        const report = await hardwareAdvisor.getCompatibilityReport()
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify(report))
      } catch (err: unknown) {
        res.writeHead(500, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ error: String(err) }))
      }
    }

    // --- POST /api/v1/models/install --- Initiate model installation (user-consented only)
    if (pathname === '/api/v1/models/install' && req.method === 'POST') {
      let body = ''
      for await (const chunk of req) body += chunk
      const { modelId, provider, userConsented } = JSON.parse(body || '{}')

      if (!userConsented) {
        res.writeHead(400, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ error: 'userConsented must be true. Model installation requires explicit user consent.' }))
      }
      if (!modelId || !provider) {
        res.writeHead(400, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ error: 'modelId and provider are required' }))
      }
      if (provider !== 'ollama') {
        res.writeHead(400, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ error: 'Only ollama provider supports installation via this endpoint' }))
      }

      // Non-blocking pull — stream progress via SSE would be ideal but we return accepted
      res.writeHead(202, { ...cors, 'content-type': 'application/json' })
      res.end(JSON.stringify({ status: 'initiated', modelId, provider, message: 'Pull started in background. Use /api/v1/models/discover to check when complete.' }))

      // Fire and forget — user-initiated
      ollamaAdapter.pullModel(modelId, (pct) => {
        console.log(`[ModelInstall] ${modelId}: ${pct}%`)
      }).then((ok) => {
        if (ok) {
          modelDiscovery.discover().catch(() => {})
          console.log(`[ModelInstall] ${modelId} installed successfully`)
        } else {
          console.warn(`[ModelInstall] ${modelId} pull failed`)
        }
      }).catch((e) => console.warn('[ModelInstall] Error:', e))

      return
    }

    // --- GET /api/v1/models/preferences --- Get AI routing preferences for user
    if (pathname === '/api/v1/models/preferences' && req.method === 'GET') {
      const userId = url.searchParams.get('userId') || 'default'
      const prefs = aiOrchestrator.getPreferences(userId)
      res.writeHead(200, { ...cors, 'content-type': 'application/json' })
      return res.end(JSON.stringify(prefs))
    }

    // --- PATCH /api/v1/models/preferences --- Update AI routing preferences
    if (pathname === '/api/v1/models/preferences' && req.method === 'PATCH') {
      let body = ''
      for await (const chunk of req) body += chunk
      const { userId = 'default', ...prefs } = JSON.parse(body || '{}')
      aiOrchestrator.setPreferences(userId, prefs)
      res.writeHead(200, { ...cors, 'content-type': 'application/json' })
      return res.end(JSON.stringify({ success: true, preferences: aiOrchestrator.getPreferences(userId) }))
    }

    // --- GET /api/v1/models/telemetry --- Model performance telemetry
    if (pathname === '/api/v1/models/telemetry' && req.method === 'GET') {
      const limit = Number(url.searchParams.get('limit') || '50')
      const telemetry = aiOrchestrator.getTelemetry(limit)
      const routerSummary = modelRouter.getUsageSummary()
      res.writeHead(200, { ...cors, 'content-type': 'application/json' })
      return res.end(JSON.stringify({ telemetry, routerSummary }))
    }

    // --- GET /api/v1/models/health --- Provider health status
    if (pathname === '/api/v1/models/health' && req.method === 'GET') {
      const cloudHealth = modelRouter.getHealthReport()
      const [ollamaUp, llamaCppAdapterModule] = await Promise.allSettled([
        ollamaAdapter.checkAvailability(),
        import('./agent/providers/openai-compatible-adapter.js'),
      ])
      const ollamaAvailable = ollamaUp.status === 'fulfilled' ? ollamaUp.value : false
      const llamaCppAvailable = llamaCppAdapterModule.status === 'fulfilled'
        ? await llamaCppAdapterModule.value.llamaCppAdapter.checkAvailability()
        : false

      res.writeHead(200, { ...cors, 'content-type': 'application/json' })
      return res.end(JSON.stringify({
        cloud: cloudHealth,
        local: {
          ollama: { name: 'ollama', available: ollamaAvailable },
          llamacpp: { name: 'llamacpp', available: llamaCppAvailable },
        },
      }))
    }

    // --- GET /api/v1/models/compare --- Compare two models
    if (pathname === '/api/v1/models/compare' && req.method === 'GET') {
      const idA = url.searchParams.get('a')
      const idB = url.searchParams.get('b')
      const modelA = idA ? modelRegistry.getById(idA) : null
      const modelB = idB ? modelRegistry.getById(idB) : null

      if (!modelA || !modelB) {
        res.writeHead(404, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ error: 'One or both model IDs not found' }))
      }

      const comparison = {
        modelA,
        modelB,
        differences: {
          isLocal: modelA.isLocal !== modelB.isLocal,
          contextWindow: modelA.contextWindow - modelB.contextWindow,
          costPerMillion: (modelA.costPerMillionTokens ?? 0) - (modelB.costPerMillionTokens ?? 0),
          hasToolCalling: {
            a: modelA.capabilities.includes('tool_calling'),
            b: modelB.capabilities.includes('tool_calling'),
          },
          hasVision: {
            a: modelA.capabilities.includes('vision'),
            b: modelB.capabilities.includes('vision'),
          },
        },
      }
      res.writeHead(200, { ...cors, 'content-type': 'application/json' })
      return res.end(JSON.stringify(comparison))
    }

    // --- POST /api/v1/ai/chat or /api/ai/chat --- Normalized AI completion
    if ((pathname === '/api/v1/ai/chat' || pathname === '/api/ai/chat') && req.method === 'POST') {
      let body = ''
      for await (const chunk of req) body += chunk
      const { prompt, text, userId = 'default' } = JSON.parse(body || '{}')
      const input = prompt || text
      if (!input) {
        res.writeHead(400, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ error: 'prompt or text is required' }))
      }

      try {
        const result = await aiOrchestrator.ask(
          input,
          {
            onText: () => {},
            onTool: () => {},
          },
          { userId },
        )
        res.writeHead(result.error ? 502 : 200, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify(result))
      } catch (err: unknown) {
        res.writeHead(500, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ error: String(err) }))
      }
    }

    // --- POST /api/v1/ai/stream or /api/ai/stream --- Server-Sent Events (SSE) streaming
    if ((pathname === '/api/v1/ai/stream' || pathname === '/api/ai/stream') && req.method === 'POST') {
      let body = ''
      for await (const chunk of req) body += chunk
      const { prompt, text, userId = 'default' } = JSON.parse(body || '{}')
      const input = prompt || text
      if (!input) {
        res.writeHead(400, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ error: 'prompt or text is required' }))
      }

      res.writeHead(200, {
        ...cors,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })

      try {
        const result = await aiOrchestrator.ask(
          input,
          {
            onText: (delta) => {
              res.write(`data: ${JSON.stringify({ type: 'text', delta })}\n\n`)
            },
            onTool: (name) => {
              res.write(`data: ${JSON.stringify({ type: 'tool', name })}\n\n`)
            },
          },
          { userId },
        )
        res.write(`data: ${JSON.stringify({ type: 'done', text: result.text, costUsd: result.costUsd, modelUsed: result.modelUsed })}\n\n`)
        res.write('data: [DONE]\n\n')
        return res.end()
      } catch (err: unknown) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: String(err) })}\n\n`)
        return res.end()
      }
    }

    // =========================================================================
    // WebHunt Delta Intelligence & CRM REST Endpoints
    // =========================================================================

    // --- POST /api/v1/webhunt/auth/login --- Authenticate against WebHunt
    if (pathname === '/api/v1/webhunt/auth/login' && req.method === 'POST') {
      let body = ''
      for await (const chunk of req) body += chunk
      const { email, password } = JSON.parse(body || '{}')
      if (!email || !password) {
        res.writeHead(400, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'Email and password are required.' }))
      }

      const result = await webHuntService.login(email, password)
      res.writeHead(result.success ? 200 : 401, { ...cors, 'content-type': 'application/json' })
      return res.end(JSON.stringify(result))
    }

    // --- POST /api/v1/webhunt/auth/logout --- Clear active session
    if (pathname === '/api/v1/webhunt/auth/logout' && req.method === 'POST') {
      webHuntService.logout()
      res.writeHead(200, { ...cors, 'content-type': 'application/json' })
      return res.end(JSON.stringify({ success: true, message: 'Logged out of WebHunt' }))
    }

    // --- GET /api/v1/webhunt/auth/me --- Check current session status
    if (pathname === '/api/v1/webhunt/auth/me' && req.method === 'GET') {
      const authHeader = req.headers.authorization
      const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined
      const result = await webHuntService.getCurrentUser(token)
      res.writeHead(result.authenticated ? 200 : 401, { ...cors, 'content-type': 'application/json' })
      return res.end(JSON.stringify(result))
    }

    // --- GET /api/v1/webhunt/status --- Integration connection & auth status
    if (pathname === '/api/v1/webhunt/status' && req.method === 'GET') {
      const status = await webHuntService.getStatus()
      res.writeHead(200, { ...cors, 'content-type': 'application/json' })
      return res.end(JSON.stringify(status))
    }

    // --- GET /api/v1/webhunt/radar/physical --- Physical lead discovery
    if (pathname === '/api/v1/webhunt/radar/physical' && req.method === 'GET') {
      const niche = url.searchParams.get('niche') || 'business'
      const location = url.searchParams.get('location') || undefined
      const country = url.searchParams.get('country') || 'KE'
      const radius = url.searchParams.get('radius') ? Number(url.searchParams.get('radius')) : 25

      const result = await webHuntService.searchPhysicalRadar({ niche, location, country, radius })
      res.writeHead(200, { ...cors, 'content-type': 'application/json' })
      return res.end(JSON.stringify(result))
    }

    // --- GET /api/v1/webhunt/radar/remote --- Remote opportunity discovery
    if (pathname === '/api/v1/webhunt/radar/remote' && req.method === 'GET') {
      const query = url.searchParams.get('query') || 'developer'
      const category = url.searchParams.get('category') || undefined

      const result = await webHuntService.searchRemoteRadar({ query, category })
      res.writeHead(200, { ...cors, 'content-type': 'application/json' })
      return res.end(JSON.stringify(result))
    }

    // --- GET /api/v1/webhunt/crm/leads --- List CRM pipeline leads
    if (pathname === '/api/v1/webhunt/crm/leads' && req.method === 'GET') {
      const status = url.searchParams.get('status') || undefined
      const search = url.searchParams.get('search') || undefined
      const pipelineType = url.searchParams.get('pipelineType') || undefined

      const leads = await webHuntService.getCRMLeads('default', { status, search, pipelineType })
      res.writeHead(200, { ...cors, 'content-type': 'application/json' })
      return res.end(JSON.stringify({ success: true, count: leads.length, leads }))
    }

    // --- GET /api/v1/webhunt/crm/leads/:id --- Single lead details & history
    if (pathname?.startsWith('/api/v1/webhunt/crm/leads/') && req.method === 'GET') {
      const leadId = pathname.slice('/api/v1/webhunt/crm/leads/'.length)
      const lead = await webHuntService.getLeadById(leadId)
      if (!lead) {
        res.writeHead(404, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ success: false, error: 'Lead not found in WebHunt CRM' }))
      }
      res.writeHead(200, { ...cors, 'content-type': 'application/json' })
      return res.end(JSON.stringify({ success: true, lead }))
    }

    // --- POST /api/v1/webhunt/crm/leads --- Save lead to CRM
    if (pathname === '/api/v1/webhunt/crm/leads' && req.method === 'POST') {
      let body = ''
      for await (const chunk of req) body += chunk
      const payload = JSON.parse(body || '{}')
      const result = await webHuntService.saveLeadToCRM(payload.lead || payload)
      res.writeHead(result.success ? 201 : 400, { ...cors, 'content-type': 'application/json' })
      return res.end(JSON.stringify(result))
    }

    // --- PATCH /api/v1/webhunt/crm/leads/:id --- Update lead status/notes
    if (pathname?.startsWith('/api/v1/webhunt/crm/leads/') && req.method === 'PATCH') {
      const leadId = pathname.slice('/api/v1/webhunt/crm/leads/'.length)
      let body = ''
      for await (const chunk of req) body += chunk
      const updates = JSON.parse(body || '{}')
      const result = await webHuntService.updateLead(leadId, updates)
      res.writeHead(result.success ? 200 : 400, { ...cors, 'content-type': 'application/json' })
      return res.end(JSON.stringify(result))
    }

    // --- DELETE /api/v1/webhunt/crm/leads/:id --- Archive / delete lead
    if (pathname?.startsWith('/api/v1/webhunt/crm/leads/') && req.method === 'DELETE') {
      const leadId = pathname.slice('/api/v1/webhunt/crm/leads/'.length)
      const result = await webHuntService.deleteLead(leadId)
      res.writeHead(result.success ? 200 : 400, { ...cors, 'content-type': 'application/json' })
      return res.end(JSON.stringify(result))
    }

    // --- POST /api/v1/webhunt/pitch/generate --- Fact-grounded proposal generator
    if (pathname === '/api/v1/webhunt/pitch/generate' && req.method === 'POST') {
      let body = ''
      for await (const chunk of req) body += chunk
      const { leadId, lead: directLead, templateType = 'local_website_pitch', profile } = JSON.parse(body || '{}')

      let targetLead = directLead
      if (!targetLead && leadId) {
        targetLead = await webHuntService.getLeadById(leadId)
      }

      if (!targetLead) {
        res.writeHead(400, { ...cors, 'content-type': 'application/json' })
        return res.end(JSON.stringify({ error: 'Lead or valid leadId required for pitch generation' }))
      }

      const proposal = webHuntService.generatePitch(targetLead, templateType, profile)
      res.writeHead(200, { ...cors, 'content-type': 'application/json' })
      return res.end(JSON.stringify({ success: true, proposal }))
    }

    // --- GET /api/v1/webhunt/searches --- Saved searches & history
    if (pathname === '/api/v1/webhunt/searches' && req.method === 'GET') {
      const history = [
        { query: 'Auto Repair in Nairobi', mode: 'physical', timestamp: Date.now() - 3600000, resultsCount: 15 },
        { query: 'React Remote Engineer', mode: 'online', timestamp: Date.now() - 7200000, resultsCount: 24 },
      ]
      const saved = [
        { id: 'search-1', niche: 'Auto Repair', location: 'Nairobi', country: 'KE', qualifiedLeads: 12, createdAt: new Date().toISOString() },
        { id: 'search-2', niche: 'Plumbers', location: 'Kitale', country: 'KE', qualifiedLeads: 8, createdAt: new Date().toISOString() },
      ]
      res.writeHead(200, { ...cors, 'content-type': 'application/json' })
      return res.end(JSON.stringify({ success: true, history, saved }))
    }


      // Fallback
      res.writeHead(404, cors)
      res.end('Not found')
    } catch (err) {
      console.error('[GACKS Gateway] Request error:', err)
      if (!res.headersSent) {
        res.writeHead(500, cors)
      }
      res.end()
    }
  })

  // --- WebSocket Server ---

  const wss = new WebSocketServer({
    server,
    verifyClient: ({ origin, req }, done) => {
      const p = (req.url ?? '/').split('?')[0]
      if (p !== '/' && p !== '/ws') {
        return done(false, 403, 'Forbidden')
      }
      if (!originAllowed(origin)) {
        console.warn(`[GACKS Gateway] Rejected websocket from origin ${origin ?? '(none)'}`)
        return done(false, 403, 'Forbidden')
      }
      done(true)
    },
  })

  wss.on('connection', (socket: WebSocket) => {
    console.log('[GACKS Gateway] Client connected to live agent runtime.')

    const send = (msg: unknown) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(msg))
      }
    }

    let answering: string | null = null
    const sendTurn = (msg: Record<string, unknown>) => send({ ...msg, ask: answering, id: answering })

    const waiting = new Map<string, { resolve: (val: unknown) => void; timer: NodeJS.Timeout }>()
    let asks = 0

    const askClient = (kind: string, args: unknown = {}, timeoutMs = 25_000) =>
      new Promise((resolve, reject) => {
        if (socket.readyState !== WebSocket.OPEN) {
          return reject(new Error('Interface is not connected'))
        }
        const id = `q${++asks}`
        const timer = setTimeout(() => {
          waiting.delete(id)
          reject(new Error('Interface did not respond in time'))
        }, timeoutMs)
        waiting.set(id, { resolve, timer })
        send({ type: kind, id, ...((args as object) || {}) })
      })

    // Announce ready status with registered tools and mission state
    send({
      type: 'ready',
      servers: toolRegistry.getToolNames(),
      mission: db.getActiveMission(),
    })

    socket.on('message', async (raw: Buffer) => {
      let msg: any
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }

      if (msg.type === 'ping') {
        send({ type: 'pong', timestamp: Date.now() })
        return
      }

      if (msg.type === 'ask' && typeof msg.text === 'string') {
        const text = msg.text.trim()
        const id = typeof msg.id === 'string' ? msg.id : null
        const source = typeof msg.source === 'string' ? msg.source : 'user'

        // Reject presentation / caption text erroneously routed to conversation engine
        if (source === 'caption' || source === 'assistant' || source === 'system') {
          console.warn(`[GACKS Gateway] Discarded ask from presentation/non-user source: ${source}`)
          return
        }

        if (!text || text.length === 0) {
          return
        }

        answering = id

        try {
          const turn = await orchestrator.ask(
            text,
            {
              onText: (delta) => sendTurn({ type: 'text', delta }),
              onTool: (name) => sendTurn({ type: 'tool', name }),
              onPlan: (plan) => send({ type: 'plan', plan }),
              onStep: (step) => send({ type: 'plan_step', step }),
            },
            {
              sendUi: send,
              askClient,
              userId: 'default',
            },
          )

          if (turn.error) {
            sendTurn({ type: 'error', message: turn.text })
          } else {
            sendTurn({ type: 'done', text: turn.text, costUsd: turn.costUsd ?? 0 })
          }
        } catch (err: any) {
          console.error('[GACKS Gateway] Turn execution failure:', err)
          sendTurn({ type: 'error', message: String(err?.message ?? err) })
        }
      }

      if (msg.type === 'reply' && typeof msg.id === 'string') {
        const slot = waiting.get(msg.id)
        if (slot) {
          waiting.delete(msg.id)
          clearTimeout(slot.timer)
          slot.resolve(msg)
        }
      }

      if (msg.type === 'interrupt') {
        orchestrator.interrupt()
      }
    })

    socket.on('close', () => {
      console.log('[GACKS Gateway] Client disconnected')
      for (const slot of waiting.values()) {
        clearTimeout(slot.timer)
      }
      waiting.clear()
    })
  })

  return { server, wss, port: PORT }
}
