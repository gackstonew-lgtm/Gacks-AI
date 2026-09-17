import type { Blade, Panel } from '../../store'

export type ConnectionState = 'open' | 'lost' | 'reconnected'
export type GatewayStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error'

export interface AskHandlers {
  onText: (delta: string) => void
  onTool: (name: string) => void
}

export interface CaptureRequest {
  mode: 'look' | 'watch'
  reason: string
  seconds: number
  when: 'now' | 'past'
}

export interface CaptureResult {
  data?: string
  mimeType?: string
  error?: string
}

export interface AgentTransport {
  ask: (prompt: string, handlers: AskHandlers) => Promise<{ text: string; tools: string[] }>
  cancel: () => void
  isConnected: () => boolean
  warm: () => Promise<void>
  watchServers: (fn: (servers: string[]) => void) => void
  watchPanels: (fn: (panel: Panel) => void) => void
  watchBlades: (fn: (blade: Blade) => void) => void
  watchUi: (fn: (op: string, args: any) => void) => void
  watchCapture: (fn: (req: CaptureRequest) => Promise<CaptureResult>) => void
  watchCaptureScreen: (fn: (req: { reason?: string }) => Promise<CaptureResult>) => void
  watchConnection: (fn: (state: ConnectionState) => void) => void
  connectedLabels: () => string[]
}
