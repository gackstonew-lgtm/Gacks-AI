import { sandbox } from '../../security/sandbox.js'
import { workspaceManager } from '../../security/workspace.js'
import type {
  ApiAdapter,
  ApiAuthType,
  ApiAdapterContext,
  ApiExecutionResult,
  ApiHealthStatus,
  ApiCredential,
} from '../types.js'

const MAX_RESPONSE_BYTES = 512 * 1024 // 512KB max payload cap

export abstract class BaseApiAdapter implements ApiAdapter {
  abstract id: string
  abstract name: string
  abstract category: string
  abstract description: string
  abstract authType: ApiAuthType
  abstract baseUrl: string
  abstract capabilities: string[]
  abstract priority: 1 | 2 | 3 | 4

  public validateConfig(credential?: ApiCredential): { valid: boolean; error?: string } {
    if (this.authType === 'apiKey') {
      if (!credential?.apiKey) {
        return {
          valid: false,
          error: `Provider '${this.name}' requires a configured API key. Please configure credentials in Settings > Integrations.`,
        }
      }
    }
    if (this.authType === 'OAuth') {
      if (!credential?.oauthToken) {
        return {
          valid: false,
          error: `Provider '${this.name}' requires an active OAuth connection.`,
        }
      }
    }
    return { valid: true }
  }

  /**
   * Safe outbound HTTP fetch with SSRF verification, timeout watchdog,
   * size limits, and secret redaction.
   */
  protected async safeFetch(
    url: string,
    options: {
      method?: string
      headers?: Record<string, string>
      body?: string
      timeoutMs?: number
    } = {},
    context: ApiAdapterContext = {},
  ): Promise<{
    ok: boolean
    status: number
    data: any
    rawText: string
    rateLimitRemaining?: number
    rateLimitReset?: number
  }> {
    // 1. SSRF URL Validation
    const urlCheck = sandbox.validateSafeUrl(url)
    if (!urlCheck.valid || !urlCheck.url) {
      throw new Error(`SSRF Block: URL '${url}' was refused by the security gate. ${urlCheck.error || ''}`)
    }

    const timeoutMs = Math.min(options.timeoutMs ?? 10_000, 30_000)
    const timeoutSignal = AbortSignal.timeout(timeoutMs)
    const combinedSignal = context.signal
      ? AbortSignal.any([timeoutSignal, context.signal])
      : timeoutSignal

    const headers: Record<string, string> = {
      'User-Agent': 'GACKS-PA/2.0 (AI Operator Runtime)',
      Accept: 'application/json, text/plain, */*',
      ...(options.headers || {}),
    }

    // Apply isolated credential if required
    if (this.authType === 'apiKey' && context.credential?.apiKey) {
      // Header or custom bearer
      if (!headers.Authorization && !headers['x-api-key']) {
        headers['x-api-key'] = context.credential.apiKey
      }
    } else if (this.authType === 'OAuth' && context.credential?.oauthToken) {
      headers.Authorization = `Bearer ${context.credential.oauthToken}`
    }

    const response = await fetch(urlCheck.url.toString(), {
      method: options.method || 'GET',
      headers,
      body: options.body,
      signal: combinedSignal,
    })

    const rateLimitRemaining = response.headers.has('x-ratelimit-remaining')
      ? Number(response.headers.get('x-ratelimit-remaining'))
      : undefined
    const rateLimitReset = response.headers.has('x-ratelimit-reset')
      ? Number(response.headers.get('x-ratelimit-reset'))
      : undefined

    // 2. Read body with byte-cap defense
    const rawBuffer = await response.arrayBuffer()
    if (rawBuffer.byteLength > MAX_RESPONSE_BYTES) {
      throw new Error(`Response payload exceeded safe limit of ${MAX_RESPONSE_BYTES / 1024}KB.`)
    }

    const rawText = workspaceManager.redactSecrets(new TextDecoder('utf-8').decode(rawBuffer))

    let parsedData: any
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json') || rawText.trim().startsWith('{') || rawText.trim().startsWith('[')) {
      try {
        parsedData = JSON.parse(rawText)
      } catch {
        parsedData = { text: rawText }
      }
    } else {
      parsedData = { text: rawText }
    }

    return {
      ok: response.ok,
      status: response.status,
      data: parsedData,
      rawText,
      rateLimitRemaining,
      rateLimitReset,
    }
  }

  /**
   * Wrap external result in strict untrusted data boundaries to defend against prompt injection.
   */
  protected wrapUntrustedResult<T>(
    operation: string,
    data: T,
    durationMs: number,
    statusCode = 200,
  ): ApiExecutionResult<T> {
    return {
      success: true,
      provider: this.name,
      operation,
      data,
      statusCode,
      durationMs,
      isUntrustedData: true,
    }
  }

  abstract execute(
    operation: string,
    params: Record<string, unknown>,
    context?: ApiAdapterContext,
  ): Promise<ApiExecutionResult>

  public async healthCheck(context: ApiAdapterContext = {}): Promise<{
    status: ApiHealthStatus
    latencyMs?: number
    message?: string
  }> {
    const configCheck = this.validateConfig(context.credential)
    if (!configCheck.valid) {
      return { status: 'authentication_required', message: configCheck.error }
    }

    const start = Date.now()
    try {
      const res = await this.safeFetch(this.baseUrl, { timeoutMs: 5000 }, context)
      const latencyMs = Date.now() - start
      if (res.status === 429) {
        return { status: 'rate_limited', latencyMs, message: 'Provider rate limit exceeded.' }
      }
      if (res.status === 401 || res.status === 403) {
        return { status: 'authentication_required', latencyMs, message: 'Authentication rejected by provider.' }
      }
      if (res.ok || res.status < 500) {
        return { status: 'available', latencyMs }
      }
      return { status: 'degraded', latencyMs, message: `Upstream returned status ${res.status}` }
    } catch (err: any) {
      return { status: 'unavailable', message: err.message }
    }
  }
}
