import { db } from '../db/index.js'
import type { AuditEvent, VerificationStatus } from '../types.js'

export class AuditLogger {
  public log({
    userId = 'default',
    sessionId = 'session-default',
    agentRunId = 'run-default',
    tool,
    action,
    inputs = {},
    permissionDecision = 'ALLOWED',
    resultSuccess = true,
    durationMs = 0,
    verificationStatus = 'unverified_success',
    errorMessage,
  }: {
    userId?: string
    sessionId?: string
    agentRunId?: string
    tool?: string
    action: string
    inputs?: Record<string, unknown>
    permissionDecision?: 'ALLOWED' | 'DENIED' | 'CONFIRMED'
    resultSuccess?: boolean
    durationMs?: number
    verificationStatus?: VerificationStatus
    errorMessage?: string
  }): AuditEvent {
    const sanitizedInputs = this.redactSecrets(inputs)

    const event: AuditEvent = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      userId,
      sessionId,
      agentRunId,
      tool,
      action,
      inputsMetadata: sanitizedInputs,
      permissionDecision,
      resultSuccess,
      durationMs,
      verificationStatus,
      errorMessage,
    }

    db.logAudit(event)
    return event
  }

  public getRecent(limit = 50): AuditEvent[] {
    return db.getAuditLogs(limit)
  }

  private redactSecrets(obj: Record<string, unknown>): Record<string, unknown> {
    const redacted: Record<string, unknown> = {}
    const secretKeys = /(key|token|secret|auth|password|credential|bearer|private)/i

    for (const [key, value] of Object.entries(obj)) {
      if (secretKeys.test(key) && typeof value === 'string') {
        redacted[key] = value.length > 8 ? `${value.slice(0, 3)}***${value.slice(-3)}` : '***'
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        redacted[key] = this.redactSecrets(value as Record<string, unknown>)
      } else {
        redacted[key] = value
      }
    }

    return redacted
  }
}

export const auditLogger = new AuditLogger()
