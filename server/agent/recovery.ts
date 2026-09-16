export type ErrorClass =
  | 'RATE_LIMIT'
  | 'TRANSIENT_NETWORK'
  | 'POLICY_BLOCKED'
  | 'FATAL'

export class RecoveryManager {
  public static readonly MAX_TOOL_RETRIES = 2
  public static readonly MAX_PLAN_RETRIES = 2
  public static readonly MAX_AGENT_STEPS = 20

  public classifyError(err: unknown): ErrorClass {
    const msg = String((err as Error)?.message ?? err).toLowerCase()

    if (/429|quota|rate limit|resource_exhausted/i.test(msg)) {
      return 'RATE_LIMIT'
    }
    if (/econnrefused|timeout|etimedout|fetch failed|network|503/i.test(msg)) {
      return 'TRANSIENT_NETWORK'
    }
    if (/policy|permission|denied|forbidden|blocked/i.test(msg)) {
      return 'POLICY_BLOCKED'
    }
    return 'FATAL'
  }

  public shouldRetry(errorClass: ErrorClass, attemptsSoFar: number): boolean {
    if (attemptsSoFar >= RecoveryManager.MAX_TOOL_RETRIES) return false
    return errorClass === 'RATE_LIMIT' || errorClass === 'TRANSIENT_NETWORK'
  }

  public async waitBackoff(attempt: number): Promise<void> {
    const delay = Math.min(4000, 500 * Math.pow(2, attempt))
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
}

export const recoveryManager = new RecoveryManager()
