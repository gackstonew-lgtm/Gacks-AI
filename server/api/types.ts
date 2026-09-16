/**
 * External API Integration Layer - Types & Interfaces
 *
 * Provides a structured contract for the public-apis catalog,
 * credential management, typed adapters, and capability resolution.
 */

export type ApiAuthType = 'none' | 'apiKey' | 'OAuth' | 'User-Agent' | 'custom'

export type ApiAdapterStatus =
  | 'installed'        // Adapter implemented and executable
  | 'needs_credential' // Adapter implemented but requires user API key
  | 'catalog_only'     // Documented in catalog, no executable adapter yet
  | 'unsupported'      // Incompatible or blocked by policy

export type ApiHealthStatus =
  | 'available'
  | 'degraded'
  | 'authentication_required'
  | 'rate_limited'
  | 'unavailable'
  | 'not_configured'

export interface ApiCatalogEntry {
  id: string
  name: string
  description: string
  category: string
  authType: ApiAuthType
  https: boolean
  cors: 'yes' | 'no' | 'unknown'
  documentationUrl: string
  baseUrl?: string
  adapterStatus: ApiAdapterStatus
  priority: 1 | 2 | 3 | 4 // 1: No-auth general, 2: Simple apiKey, 3: OAuth, 4: Complex setup
  capabilities: string[]
  provider?: string
}

export interface ApiCredential {
  providerId: string
  providerName: string
  authType: ApiAuthType
  apiKey?: string
  oauthToken?: string
  refreshToken?: string
  expiresAt?: number
  updatedAt: number
  customHeaders?: Record<string, string>
}

export interface ApiAdapterContext {
  userId?: string
  credential?: ApiCredential
  signal?: AbortSignal
}

export interface ApiExecutionResult<T = unknown> {
  success: boolean
  provider: string
  operation: string
  data?: T
  rawResponse?: string
  statusCode?: number
  durationMs: number
  cached?: boolean
  error?: string
  rateLimitRemaining?: number
  rateLimitReset?: number
  /**
   * Flag confirming response has been wrapped as untrusted external data
   */
  isUntrustedData: true
}

export interface ApiAdapter {
  id: string
  name: string
  category: string
  description: string
  authType: ApiAuthType
  baseUrl: string
  capabilities: string[]
  priority: 1 | 2 | 3 | 4

  validateConfig(credential?: ApiCredential): { valid: boolean; error?: string }
  healthCheck(context?: ApiAdapterContext): Promise<{ status: ApiHealthStatus; latencyMs?: number; message?: string }>
  execute(
    operation: string,
    params: Record<string, unknown>,
    context?: ApiAdapterContext,
  ): Promise<ApiExecutionResult>
}
