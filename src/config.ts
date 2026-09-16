/**
 * GACKS P.A. V2 Configuration
 *
 * Production-grade client configuration. Zero sensitive provider tokens or API
 * keys are bundled into the client bundle. All credentials remain secure
 * within the server runtime.
 */

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
 * Automatically resolves to current origin over WSS when deployed over HTTPS,
 * or ws://localhost:8787 in local development.
 */
function resolveGatewayWsUrl(): string {
  const custom = str(import.meta.env.VITE_BRIDGE_URL)
  if (custom) return custom

  if (typeof window !== 'undefined' && window.location) {
    if (window.location.protocol === 'https:') {
      return `wss://${window.location.host}/ws`
    }
    return `ws://${window.location.hostname}:8787`
  }
  return 'ws://localhost:8787'
}

export const BRIDGE_WS_URL = resolveGatewayWsUrl()
export const BRIDGE_HTTP_URL = BRIDGE_WS_URL.replace(/^ws/, 'http').replace(/\/ws\/?$/, '')

/**
 * Speech output configuration.
 */
export const USE_ELEVENLABS = flag(
  'VITE_USE_ELEVENLABS',
  import.meta.env.VITE_USE_ELEVENLABS,
  false,
)

export const TTS_ENGINE: 'kokoro' | 'system' = choice(
  'VITE_TTS_ENGINE',
  import.meta.env.VITE_TTS_ENGINE,
  ['kokoro', 'system'] as const,
  'system',
)

export const KOKORO_VOICE = choice(
  'VITE_KOKORO_VOICE',
  import.meta.env.VITE_KOKORO_VOICE,
  ['bm_george', 'bm_fable', 'bm_lewis', 'bm_daniel'] as const,
  'bm_george',
)

export const BACKEND: 'bridge' | 'direct' = 'bridge'

export const env = {
  anthropicKey: '',
  elevenKey: '',
  elevenVoiceId:
    str(import.meta.env.VITE_ELEVENLABS_VOICE_ID) ?? 'JBFqnCBsd6RMkjVDRZzb',
  porcupineKey: str(import.meta.env.VITE_PICOVOICE_ACCESS_KEY) ?? '',
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
