/**
 * GACKS P.A. V2 Configuration
 *
 * Production-grade client configuration. Zero sensitive provider tokens or API
 * keys are bundled into the client bundle. All credentials remain secure
 * within the server runtime.
 */

function getEnv(key: string): unknown {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      return (import.meta as any).env[key]
    }
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key]
    }
  } catch {}
  return undefined
}

function str(raw: unknown): string | undefined {
  const value = typeof raw === 'string' ? raw.trim() : ''
  return value === '' ? undefined : value
}

function choice<T extends string>(
  name: string,
  raw: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = str(raw)
  if (value === undefined) return fallback
  if ((allowed as readonly string[]).includes(value)) return value as T
  console.warn(
    `[gacks-pa] ${name}="${value}" is not one of ${allowed.join(' | ')} — using "${fallback}".`,
  )
  return fallback
}

function flag(_name: string, raw: unknown, fallback: boolean): boolean {
  const value = str(raw)?.toLowerCase()
  if (value === undefined) return fallback
  if (value === 'true' || value === '1') return true
  if (value === 'false' || value === '0') return false
  return fallback
}

/**
 * Target Agent Gateway URL.
 * Automatically resolves to custom VITE_BRIDGE_URL / VITE_WS_URL,
 * ws://localhost:8787/ws in local development,
 * or empty string in remote production when a dedicated backend is not configured.
 */
function resolveGatewayWsUrl(): string {
  const custom = str(getEnv('VITE_BRIDGE_URL')) || str(getEnv('VITE_WS_URL'))
  if (custom) {
    if (custom.startsWith('http://')) return custom.replace('http://', 'ws://')
    if (custom.startsWith('https://')) return custom.replace('https://', 'wss://')
    return custom
  }

  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname
    const isLocal =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '[::1]' ||
      /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname)
    if (isLocal) {
      const port = str(getEnv('VITE_GATEWAY_PORT')) || str(getEnv('VITE_BRIDGE_PORT')) || '8787'
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      return `${proto}//${hostname}:${port}/ws`
    }
    // In production on static cloud hosts (e.g. Vercel), do NOT default to wss://${host}/ws
    // unless explicitly configured via VITE_BRIDGE_URL.
    return ''
  }
  return 'ws://localhost:8787/ws'
}

function resolveGatewayHttpUrl(): string {
  const custom = str(getEnv('VITE_BRIDGE_HTTP_URL')) || str(getEnv('VITE_API_URL'))
  if (custom) return custom.replace(/\/+$/, '')

  const ws = resolveGatewayWsUrl()
  if (ws) {
    return ws.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:').replace(/\/ws\/?$/i, '')
  }
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname
    const isLocal =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '[::1]' ||
      /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname)
    if (isLocal) {
      const port = str(getEnv('VITE_GATEWAY_PORT')) || str(getEnv('VITE_BRIDGE_PORT')) || '8787'
      const proto = window.location.protocol === 'https:' ? 'https:' : 'http:'
      return `${proto}//${hostname}:${port}`
    }
  }
  return 'http://localhost:8787'
}

export const BRIDGE_WS_URL = resolveGatewayWsUrl()
export const BRIDGE_HTTP_URL = resolveGatewayHttpUrl()
export const IS_GATEWAY_CONFIGURED = Boolean(BRIDGE_WS_URL || BRIDGE_HTTP_URL)

/**
 * Speech output configuration.
 */
export const USE_ELEVENLABS = flag(
  'VITE_USE_ELEVENLABS',
  getEnv('VITE_USE_ELEVENLABS'),
  false,
)

export const ENABLE_SCREEN_CAPTIONS = flag(
  'VITE_ENABLE_SCREEN_CAPTIONS',
  getEnv('VITE_ENABLE_SCREEN_CAPTIONS'),
  false,
)

export const TTS_ENGINE: 'kokoro' | 'system' = choice(
  'VITE_TTS_ENGINE',
  getEnv('VITE_TTS_ENGINE'),
  ['kokoro', 'system'] as const,
  'system',
)

export const KOKORO_VOICE = choice(
  'VITE_KOKORO_VOICE',
  getEnv('VITE_KOKORO_VOICE'),
  ['bm_george', 'bm_fable', 'bm_lewis', 'bm_daniel'] as const,
  'bm_george',
)

export const BACKEND: 'bridge' | 'direct' = 'bridge'

export const env = {
  anthropicKey: '',
  elevenKey: '',
  elevenVoiceId:
    str(getEnv('VITE_ELEVENLABS_VOICE_ID')) ?? 'JBFqnCBsd6RMkjVDRZzb',
  porcupineKey: str(getEnv('VITE_PICOVOICE_ACCESS_KEY')) ?? '',
}

export const WAKE_ENGINE: 'speech' | 'porcupine' = env.porcupineKey
  ? 'porcupine'
  : 'speech'

export const MODEL = 'gemini-2.5-flash'
export const FAST_MODE = true

export type McpServer = {
  name: string
  label: string
  enabled: boolean
}

/**
 * Safe client server definitions without tokens.
 */
export const MCP_SERVERS: McpServer[] = [
  { name: 'github', label: 'GitHub', enabled: true },
  { name: 'vercel', label: 'Vercel', enabled: true },
  { name: 'email', label: 'Email', enabled: true },
  { name: 'whatsapp', label: 'WhatsApp', enabled: true },
]

export const activeServers = () => MCP_SERVERS.filter((s) => s.enabled)

export const SYSTEM_PROMPT = `You are Insight, the AI intelligence and operating core of Insight Business Suite. You are speaking out loud.
The hard rule: replies under 60 words for conversational responses.
Tone: Dry, precise, quietly amused, understated competence.`
