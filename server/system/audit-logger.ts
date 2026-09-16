import type { CapabilityId, RiskLevel } from './capability-registry.js'

export interface SystemAuditEntry {
  id: string
  timestamp: number
  capability: CapabilityId
  action: string
  initiator: 'ai' | 'operator' | 'system'
  inputs: Record<string, unknown>
  riskLevel: RiskLevel
  confirmationState: 'granted' | 'confirmed' | 'blocked' | 'denied'
  success: boolean
  durationMs: number
  error?: string
  resultSummary?: string
}

const SENSITIVE_KEY_REGEX = /(key|token|secret|password|credential|auth|bearer|private)/i

function sanitizeInputs(inputs: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(inputs)) {
    if (SENSITIVE_KEY_REGEX.test(k)) {
      sanitized[k] = '***REDACTED***'
    } else if (typeof v === 'string' && v.length > 500) {
      sanitized[k] = v.slice(0, 500) + '... [truncated]'
    } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      sanitized[k] = sanitizeInputs(v as Record<string, unknown>)
    } else {
      sanitized[k] = v
    }
  }
  return sanitized
}

export class SystemAuditLogger {
  private entries: SystemAuditEntry[] = []
  private maxEntries = 500

  public log(params: {
    capability: CapabilityId
    action: string
    initiator?: 'ai' | 'operator' | 'system'
    inputs?: Record<string, unknown>
    riskLevel: RiskLevel
    confirmationState: 'granted' | 'confirmed' | 'blocked' | 'denied'
    success: boolean
    durationMs: number
    error?: string
    resultSummary?: string
  }): SystemAuditEntry {
    const entry: SystemAuditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      capability: params.capability,
      action: params.action,
      initiator: params.initiator || 'ai',
      inputs: sanitizeInputs(params.inputs || {}),
      riskLevel: params.riskLevel,
      confirmationState: params.confirmationState,
      success: params.success,
      durationMs: params.durationMs,
      error: params.error,
      resultSummary: params.resultSummary,
    }

    this.entries.unshift(entry)
    if (this.entries.length > this.maxEntries) {
      this.entries.length = this.maxEntries
    }

    return entry
  }

  public getEntries(limit = 50, capability?: CapabilityId): SystemAuditEntry[] {
    let filtered = this.entries
    if (capability) {
      filtered = filtered.filter((e) => e.capability === capability)
    }
    return filtered.slice(0, limit)
  }

  public clear(): void {
    this.entries = []
  }
}

export const systemAuditLogger = new SystemAuditLogger()
