import type {
  AgentTransport,
  AskHandlers,
  CaptureRequest,
  CaptureResult,
  ConnectionState,
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
}

export class RemoteAgentTransport implements AgentTransport {
  private askSeq = 0
  private socket: WebSocket | null = null
  private connecting: Promise<WebSocket> | null = null
  private servers: string[] = []
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
  private reconnectTimer = 0
  private readonly RECONNECT_DELAYS = [500, 1000, 2000, 4000, 8000]

  private pending: { finish: (fallback?: string) => void } | null = null

  private deferred() {
    let resolve!: () => void
    const promise = new Promise<void>((r) => {
      resolve = r
    })
    return { promise, resolve }
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

  private scheduleReconnect() {
    if (this.attempt >= this.RECONNECT_DELAYS.length) return
    const delay = this.RECONNECT_DELAYS[this.attempt]
    this.attempt += 1
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = window.setTimeout(() => {
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

  private connect(): Promise<WebSocket> {
    if (this.socket?.readyState === WebSocket.OPEN) return Promise.resolve(this.socket)
    if (this.connecting) return this.connecting

    this.firstReady = this.deferred()

    this.connecting = new Promise<WebSocket>((resolve, reject) => {
      let ws: WebSocket
      try {
        ws = new WebSocket(BRIDGE_WS_URL)
      } catch (err) {
        this.connecting = null
        return reject(err)
      }

      let settled = false

      const settle = (err: Error | null) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        this.connecting = null
        if (err) reject(err)
        else resolve(ws)
      }

      const timer = setTimeout(() => {
        ws.close()
        settle(new Error('GACKS Agent Gateway not responding'))
      }, 7000)

      ws.onopen = () => {
        this.socket = ws
        this.attempt = 0
        this.dispatch(ws)
        settle(null)
        this.onConnection?.(this.everConnected ? 'reconnected' : 'open')
        this.everConnected = true
      }

      ws.onerror = () => {
        settle(new Error(`Cannot connect to GACKS Agent Gateway at ${BRIDGE_WS_URL}`))
      }

      ws.onclose = () => {
        settle(new Error('GACKS Agent connection closed.'))
        if (this.socket === ws) {
          this.socket = null
          this.onConnection?.('lost')
          this.scheduleReconnect()
        }
      }
    })

    return this.connecting
  }

  public async warm(): Promise<void> {
    await this.connect()
    await Promise.race([
      this.firstReady.promise,
      new Promise<void>((resolve) => setTimeout(resolve, 2500)),
    ])
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
          fail(new Error('The agent gateway went quiet — turn timed out.'))
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
              fail(new Error(msg.message ?? 'Agent runtime reported an error.'))
              break
          }
        } catch (err) {
          fail(err instanceof Error ? err : new Error(String(err)))
        }
      }

      const onClose = () => {
        fail(new Error('Gateway disconnected during answer.'))
      }
      const onError = () => {
        fail(new Error('Gateway connection error.'))
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
}

export const remoteTransport = new RemoteAgentTransport()
