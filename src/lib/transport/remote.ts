import type {
  AgentTransport,
  AskHandlers,
  CaptureRequest,
  CaptureResult,
  ConnectionState,
  GatewayStatus,
} from './types'
import type { Blade, Panel } from '../../store'
import { BRIDGE_WS_URL } from '../../config'

type Frame = {
  type?: string
  delta?: string
  name?: string
  text?: string
  message?: string
  panel?: Panel
  blade?: Blade
  op?: string
  args?: unknown
  id?: string
  ask?: string
  reason?: string
  mode?: string
  seconds?: number
  when?: string
  servers?: Array<string | { name?: string }>
  mission?: any
  costUsd?: number
}

export type GatewayErrorCode =
  | 'GATEWAY_NOT_CONFIGURED'
  | 'GATEWAY_NOT_RUNNING'
  | 'GATEWAY_CONNECTION_REFUSED'
  | 'GATEWAY_TIMEOUT'
  | 'GATEWAY_AUTH_FAILED'
  | 'GATEWAY_CLOSED'
  | 'GATEWAY_PROTOCOL_ERROR'
  | 'GATEWAY_RUNTIME_ERROR'

export class GatewayError extends Error {
  constructor(
    public readonly code: GatewayErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'GatewayError'
  }
}

export class RemoteAgentTransport implements AgentTransport {
  private askSeq = 0
  private socket: WebSocket | null = null
  private connecting: Promise<WebSocket> | null = null
  private servers: string[] = []
  private status: GatewayStatus = 'disconnected'
  private statusListeners: Set<(s: GatewayStatus) => void> = new Set()

  private onServers: ((s: string[]) => void) | null = null
  private onPanel: ((panel: Panel) => void) | null = null
  private onBlade: ((blade: Blade) => void) | null = null
  private onUi: ((op: string, args: any) => void) | null = null
  private onCapture: ((req: CaptureRequest) => Promise<CaptureResult>) | null = null
  private onCaptureScreen: ((req: { reason?: string }) => Promise<CaptureResult>) | null = null
  private onConnection: ((state: ConnectionState) => void) | null = null
  private onMission: ((mission: any) => void) | null = null

  private firstReady = this.deferred()
  private everConnected = false
  private attempt = 0
  private reconnectTimer: number | null = null
  private readonly RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000]

  private heartbeatTimer: number | null = null
  private heartbeatAwaitingPong = false
  private readonly HEARTBEAT_INTERVAL_MS = 25000

  private pending: { finish: (fallback?: string) => void } | null = null

  private deferred() {
    let resolve!: () => void
    const promise = new Promise<void>((r) => {
      resolve = r
    })
    return { promise, resolve }
  }

  public getStatus(): GatewayStatus {
    return this.status
  }

  public watchStatus(fn: (s: GatewayStatus) => void): () => void {
    this.statusListeners.add(fn)
    fn(this.status)
    return () => this.statusListeners.delete(fn)
  }

  private setStatus(newStatus: GatewayStatus) {
    if (this.status === newStatus) return
    this.status = newStatus
    this.statusListeners.forEach((fn) => {
      try {
        fn(newStatus)
      } catch {}
    })
  }

  public isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN
  }

  public connectedLabels(): string[] {
    return this.servers
  }

  public watchServers(fn: (s: string[]) => void) {
    this.onServers = fn
    if (this.servers.length > 0) fn(this.servers)
  }

  public watchPanels(fn: (p: Panel) => void) {
    this.onPanel = fn
  }

  public watchBlades(fn: (b: Blade) => void) {
    this.onBlade = fn
  }

  public watchUi(fn: (op: string, args: any) => void) {
    this.onUi = fn
  }

  public watchCapture(fn: (req: CaptureRequest) => Promise<CaptureResult>) {
    this.onCapture = fn
  }

  public watchCaptureScreen(fn: (req: { reason?: string }) => Promise<CaptureResult>) {
    this.onCaptureScreen = fn
  }

  public watchConnection(fn: (s: ConnectionState) => void) {
    this.onConnection = fn
  }

  public watchMission(fn: (mission: any) => void) {
    this.onMission = fn
  }

  private startHeartbeat(ws: WebSocket) {
    this.stopHeartbeat()
    this.heartbeatAwaitingPong = false
    this.heartbeatTimer = window.setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        this.stopHeartbeat()
        return
      }
      if (this.heartbeatAwaitingPong) {
        console.warn('[GACKS Gateway] Heartbeat timeout — terminating stale socket')
        this.stopHeartbeat()
        try {
          ws.close()
        } catch {}
        return
      }
      this.heartbeatAwaitingPong = true
      try {
        ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }))
      } catch {
        this.stopHeartbeat()
      }
    }, this.HEARTBEAT_INTERVAL_MS)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    this.heartbeatAwaitingPong = false
  }

  private scheduleReconnect() {
    if (!BRIDGE_WS_URL) return
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    const delayIndex = Math.min(this.attempt, this.RECONNECT_DELAYS.length - 1)
    const baseDelay = this.RECONNECT_DELAYS[delayIndex]
    const jitter = Math.floor(Math.random() * 500)
    const delay = baseDelay + jitter

    this.attempt += 1
    this.setStatus('reconnecting')
    console.log(`[GACKS Gateway] Reconnecting in ${delay}ms (attempt ${this.attempt})...`)

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      void this.connect().catch(() => {})
    }, delay)
  }

  private dispatch(ws: WebSocket) {
    ws.addEventListener('message', (e: MessageEvent) => {
      let msg: Frame
      try {
        msg = JSON.parse(e.data as string)
      } catch {
        return
      }

      if (msg.type === 'pong') {
        this.heartbeatAwaitingPong = false
        return
      }

      if (msg.type === 'ready') {
        this.servers = (msg.servers ?? [])
          .map((s) => (typeof s === 'string' ? s : s.name ?? ''))
          .filter(Boolean)
        this.onServers?.(this.servers)
        if (msg.mission) {
          this.onMission?.(msg.mission)
        }
        this.firstReady.resolve()
      } else if (msg.type === 'mission_updated' && msg.mission) {
        this.onMission?.(msg.mission)
      } else if (msg.type === 'panel' && msg.panel) {
        this.onPanel?.(msg.panel)
      } else if (msg.type === 'blade' && msg.blade) {
        this.onBlade?.(msg.blade)
      } else if (msg.type === 'capture' && msg.id) {
        const id = msg.id
        const reply = (payload: CaptureResult | Record<string, unknown>) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'reply', id, ...payload }))
          }
        }
        if (!this.onCapture) {
          reply({ error: 'The interface has no camera handler.' })
        } else {
          this.onCapture({
            mode: msg.mode === 'watch' ? 'watch' : 'look',
            reason: msg.reason ?? '',
            seconds: Math.max(2, Math.min(15, Number(msg.seconds) || 6)),
            when: msg.when === 'past' ? 'past' : 'now',
          })
            .then(reply)
            .catch((err) => reply({ error: String(err?.message ?? err) }))
        }
      } else if (msg.type === 'capture_screen' && msg.id) {
        const id = msg.id
        const reply = (payload: CaptureResult | Record<string, unknown>) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'reply', id, ...payload }))
          }
        }
        if (!this.onCaptureScreen) {
          reply({ error: 'The interface has no screen capture handler.' })
        } else {
          this.onCaptureScreen({ reason: msg.reason ?? '' })
            .then(reply)
            .catch((err) => reply({ error: String(err?.message ?? err) }))
        }
      } else if (msg.type === 'ui' && msg.op) {
        this.onUi?.(msg.op, (msg.args ?? {}) as Record<string, unknown>)
      }
    })
  }

  public connect(): Promise<WebSocket> {
    if (this.socket?.readyState === WebSocket.OPEN) return Promise.resolve(this.socket)
    if (this.connecting) return this.connecting

    if (!BRIDGE_WS_URL) {
      this.setStatus('disconnected')
      this.onConnection?.('lost')
      const err = new GatewayError(
        'GATEWAY_NOT_CONFIGURED',
        'GACKS Agent Gateway URL is unconfigured. In production, configure VITE_BRIDGE_URL.',
      )
      return Promise.reject(err)
    }

    this.setStatus('connecting')
    this.firstReady = this.deferred()

    this.connecting = new Promise<WebSocket>((resolve, reject) => {
      let ws: WebSocket
      try {
        console.log(`[GACKS Gateway] Target: ${BRIDGE_WS_URL}`)
        ws = new WebSocket(BRIDGE_WS_URL)
      } catch (err) {
        this.connecting = null
        this.setStatus('error')
        return reject(
          new GatewayError('GATEWAY_CONNECTION_REFUSED', `Failed to construct WebSocket: ${String(err)}`, err),
        )
      }

      let settled = false

      const settle = (err: GatewayError | null) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        this.connecting = null
        if (err) {
          this.setStatus('error')
          reject(err)
        } else {
          this.setStatus('connected')
          resolve(ws)
        }
      }

      const timer = window.setTimeout(() => {
        try {
          ws.close()
        } catch {}
        settle(new GatewayError('GATEWAY_TIMEOUT', `GACKS Agent Gateway not responding at ${BRIDGE_WS_URL}`))
      }, 7000)

      ws.onopen = () => {
        console.log('[GACKS Gateway] Connected successfully.')
        this.socket = ws
        this.attempt = 0
        this.startHeartbeat(ws)
        this.dispatch(ws)
        settle(null)
        this.onConnection?.(this.everConnected ? 'reconnected' : 'open')
        this.everConnected = true
      }

      ws.onerror = (evt) => {
        console.warn('[GACKS Gateway] WebSocket error encountered.')
        settle(
          new GatewayError(
            'GATEWAY_CONNECTION_REFUSED',
            `Cannot connect to GACKS Agent Gateway at ${BRIDGE_WS_URL}`,
            evt,
          ),
        )
      }

      ws.onclose = () => {
        this.stopHeartbeat()
        settle(new GatewayError('GATEWAY_CLOSED', 'GACKS Agent connection closed.'))
        if (this.socket === ws) {
          this.socket = null
          console.log('[GACKS Gateway] Disconnected from gateway.')
          this.setStatus('disconnected')
          this.onConnection?.('lost')
          this.scheduleReconnect()
        }
      }
    })

    return this.connecting
  }

  public async warm(): Promise<void> {
    if (!BRIDGE_WS_URL) return
    try {
      await this.connect()
      await Promise.race([
        this.firstReady.promise,
        new Promise<void>((resolve) => setTimeout(resolve, 2500)),
      ])
    } catch {
      // Warm up failure silently swallowed to not disturb boot sequence
    }
  }

  public async ask(
    prompt: string,
    handlers: AskHandlers,
  ): Promise<{ text: string; tools: string[] }> {
    if (this.pending) this.cancel()

    let cancelledWhileDialling = false
    this.pending = {
      finish: () => {
        cancelledWhileDialling = true
      },
    }

    let ws: WebSocket
    try {
      ws = await this.connect()
    } catch (err) {
      this.pending = null
      throw err
    }

    if (cancelledWhileDialling) {
      this.pending = null
      return { text: '', tools: [] }
    }

    const id = `a${++this.askSeq}`
    const tools: string[] = []
    let text = ''

    return new Promise((resolve, reject) => {
      let done = false
      let timer = 0

      const cleanup = () => {
        done = true
        this.pending = null
        clearTimeout(timer)
        ws.removeEventListener('message', onMessage)
        ws.removeEventListener('close', onClose)
        ws.removeEventListener('error', onError)
      }

      const finish = (fallback = '') => {
        if (done) return
        cleanup()
        resolve({ text: (text || fallback).trim(), tools })
      }

      const fail = (err: Error) => {
        if (done) return
        cleanup()
        reject(err)
      }

      const arm = () => {
        clearTimeout(timer)
        timer = window.setTimeout(() => {
          fail(new GatewayError('GATEWAY_TIMEOUT', 'The agent gateway went quiet — turn timed out.'))
        }, 120_000)
      }

      const onMessage = (e: MessageEvent) => {
        arm()
        let msg: Frame
        try {
          msg = JSON.parse(e.data as string)
        } catch {
          return
        }

        if (msg.ask && msg.ask !== id) return

        try {
          switch (msg.type) {
            case 'text':
              text += msg.delta ?? ''
              handlers.onText(msg.delta ?? '')
              break

            case 'tool':
              if (!msg.name) break
              tools.push(msg.name)
              handlers.onTool(msg.name)
              break

            case 'done':
              finish(msg.text ?? '')
              break

            case 'error':
              fail(new GatewayError('GATEWAY_RUNTIME_ERROR', msg.message ?? 'Agent runtime reported an error.'))
              break
          }
        } catch (err) {
          fail(err instanceof Error ? err : new Error(String(err)))
        }
      }

      const onClose = () => {
        fail(new GatewayError('GATEWAY_CLOSED', 'Gateway disconnected during answer.'))
      }
      const onError = (evt: Event) => {
        fail(new GatewayError('GATEWAY_CONNECTION_REFUSED', 'Gateway connection error during turn.', evt))
      }

      this.pending = { finish }
      ws.addEventListener('message', onMessage)
      ws.addEventListener('close', onClose)
      ws.addEventListener('error', onError)
      arm()

      try {
        ws.send(JSON.stringify({ type: 'ask', text: prompt, id }))
      } catch (err) {
        fail(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }

  public cancel(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'interrupt' }))
    }
    this.pending?.finish()
  }

  public disconnect(): void {
    this.stopHeartbeat()
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.socket) {
      try {
        this.socket.close()
      } catch {}
      this.socket = null
    }
    this.setStatus('disconnected')
  }
}

export const remoteTransport = new RemoteAgentTransport()
