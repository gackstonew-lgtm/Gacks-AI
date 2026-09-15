/**
 * Safe development diagnostics & request lifecycle tracer for GACKS P.A.
 * Tracks every turn without logging sensitive tokens, keys, or private contents.
 */

export type LifecycleStage =
  | 'REQUEST_RECEIVED'
  | 'STT_STARTED'
  | 'TRANSCRIPT_RECEIVED'
  | 'QUERY_SENT_TO_BRIDGE'
  | 'CLAUDE_SESSION_STARTED'
  | 'CLAUDE_PROCESSING'
  | 'TOOL_REQUESTED'
  | 'TOOL_COMPLETED'
  | 'CLAUDE_RESPONSE_RECEIVED'
  | 'RESPONSE_SENT_TO_FRONTEND'
  | 'TTS_STARTED'
  | 'TTS_COMPLETED'
  | 'PIPELINE_ERROR'
  | 'FALLBACK_TRIGGERED'

export interface TraceEvent {
  id: string
  timestamp: number
  stage: LifecycleStage
  detail?: string
  meta?: Record<string, unknown>
}

class DiagnosticTracer {
  private traces: TraceEvent[] = []
  private maxTraces = 50

  log(stage: LifecycleStage, id: string, detail?: string, meta?: Record<string, unknown>): void {
    const ev: TraceEvent = {
      id,
      timestamp: Date.now(),
      stage,
      detail: detail ? String(detail).slice(0, 160) : undefined,
      meta,
    }
    this.traces.push(ev)
    if (this.traces.length > this.maxTraces) {
      this.traces.shift()
    }
    console.log(`[GACKS P.A TRACE] [${id}] [${stage}] ${detail ?? ''}`)
  }

  getRecent(): TraceEvent[] {
    return [...this.traces]
  }

  clear(): void {
    this.traces = []
  }
}

export const tracer = new DiagnosticTracer()

if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__gacksTracer = tracer
}
