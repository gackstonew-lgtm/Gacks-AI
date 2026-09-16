import { catalogSync } from './catalog-sync.js'
import { credentialManager } from './credential-manager.js'
import { weatherAdapter } from './adapters/weather-adapter.js'
import { geocodingAdapter } from './adapters/geocoding-adapter.js'
import { currencyAdapter } from './adapters/currency-adapter.js'
import { vulnerabilityAdapter } from './adapters/vulnerability-adapter.js'
import { dictionaryAdapter } from './adapters/dictionary-adapter.js'
import { worldTimeAdapter } from './adapters/time-adapter.js'
import { githubAdapter } from './adapters/github-adapter.js'
import { metaBusinessAdapter } from './adapters/meta-adapter.js'
import { businessCommunicationAdapter } from './adapters/communication-adapter.js'
import type {
  ApiAdapter,
  ApiCatalogEntry,
  ApiExecutionResult,
  ApiHealthStatus,
} from './types.js'

export class ApiRegistry {
  private adapters: Map<string, ApiAdapter> = new Map()
  private cache: Map<string, { data: any; expiresAt: number }> = new Map()

  constructor() {
    this.registerBuiltinAdapters()
  }

  private registerBuiltinAdapters() {
    this.registerAdapter(weatherAdapter)
    this.registerAdapter(geocodingAdapter)
    this.registerAdapter(currencyAdapter)
    this.registerAdapter(vulnerabilityAdapter)
    this.registerAdapter(dictionaryAdapter)
    this.registerAdapter(worldTimeAdapter)
    this.registerAdapter(githubAdapter)
    this.registerAdapter(metaBusinessAdapter)
    this.registerAdapter(businessCommunicationAdapter)
  }

  public registerAdapter(adapter: ApiAdapter) {
    this.adapters.set(adapter.id, adapter)
    catalogSync.setInstalledAdapter(adapter.id, 'installed')
  }

  public getAdapter(id: string): ApiAdapter | undefined {
    return this.adapters.get(id.toLowerCase().trim())
  }

  public getAdapters(): ApiAdapter[] {
    return Array.from(this.adapters.values())
  }

  /**
   * Search catalog entries by query, category, authType, or adapterStatus.
   */
  public searchCatalog(options: {
    query?: string
    category?: string
    authType?: string
    installedOnly?: boolean
  } = {}): ApiCatalogEntry[] {
    let list = catalogSync.getEntries()

    if (options.category && options.category !== 'all') {
      const cat = options.category.toLowerCase()
      list = list.filter((e) => e.category.toLowerCase() === cat)
    }

    if (options.authType && options.authType !== 'all') {
      list = list.filter((e) => e.authType === options.authType)
    }

    if (options.installedOnly) {
      list = list.filter((e) => this.adapters.has(e.id))
    }

    if (options.query && options.query.trim()) {
      const q = options.query.toLowerCase().trim()
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.capabilities.some((c) => c.includes(q)),
      )
    }

    return list
  }

  /**
   * Resolve an executable capability for a given intent.
   * e.g. "weather" -> weatherAdapter, "vulnerabilities" -> vulnerabilityAdapter
   */
  public resolveCapability(intent: string): {
    adapter?: ApiAdapter
    entry?: ApiCatalogEntry
    status: 'available' | 'needs_credential' | 'catalog_only' | 'not_found'
    reason?: string
  } {
    const q = intent.toLowerCase().trim()

    // 1. Check direct capability matches among installed adapters
    for (const adapter of this.adapters.values()) {
      if (
        adapter.capabilities.some((cap) => q.includes(cap)) ||
        adapter.name.toLowerCase().includes(q) ||
        adapter.category.toLowerCase().includes(q)
      ) {
        if (adapter.authType === 'apiKey' && !credentialManager.hasCredential(adapter.id)) {
          // Allow GitHub fallback to unauthenticated public API
          if (adapter.id !== 'github-api') {
            return {
              adapter,
              status: 'needs_credential',
              reason: `Adapter '${adapter.name}' is available but requires user API key configuration.`,
            }
          }
        }
        return { adapter, status: 'available' }
      }
    }

    // 2. Check catalog entries without an installed adapter
    const catalogMatch = catalogSync.getEntries().find(
      (e) =>
        e.capabilities.some((cap) => q.includes(cap)) ||
        e.name.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q),
    )

    if (catalogMatch) {
      return {
        entry: catalogMatch,
        status: 'catalog_only',
        reason: `Service '${catalogMatch.name}' is listed in the API catalog (${catalogMatch.documentationUrl}), but an automated adapter is not installed yet.`,
      }
    }

    return { status: 'not_found', reason: `No matching API capability found for '${intent}'.` }
  }

  /**
   * Execute an API operation through its verified adapter with credential isolation.
   */
  public async execute(
    providerId: string,
    operation: string,
    params: Record<string, unknown> = {},
  ): Promise<ApiExecutionResult> {
    const adapter = this.adapters.get(providerId.toLowerCase().trim())
    if (!adapter) {
      return {
        success: false,
        provider: providerId,
        operation,
        durationMs: 0,
        error: `Provider '${providerId}' is not an installed executable adapter.`,
        isUntrustedData: true,
      }
    }

    // Isolated credential lookup
    const credential = credentialManager.getCredential(adapter.id)
    const configCheck = adapter.validateConfig(credential)
    if (!configCheck.valid && adapter.id !== 'github-api') {
      return {
        success: false,
        provider: adapter.name,
        operation,
        durationMs: 0,
        error: configCheck.error,
        isUntrustedData: true,
      }
    }

    // Check safe read-only cache for idempotent queries (5 min TTL)
    const cacheKey = `${adapter.id}:${operation}:${JSON.stringify(params)}`
    const cached = this.cache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return {
        success: true,
        provider: adapter.name,
        operation,
        data: cached.data,
        durationMs: 0,
        cached: true,
        isUntrustedData: true,
      }
    }

    const result = await adapter.execute(operation, params, { credential })

    if (result.success && result.data && ['get_forecast', 'convert_currency', 'define_word', 'get_timezone_time'].includes(operation)) {
      this.cache.set(cacheKey, { data: result.data, expiresAt: Date.now() + 5 * 60 * 1000 })
    }

    return result
  }

  /**
   * Get overall provider health status and configuration status.
   */
  public async getProviderStatus(providerId: string): Promise<{
    id: string
    name: string
    category: string
    authType: string
    configured: boolean
    health: ApiHealthStatus
    message?: string
  }> {
    const adapter = this.adapters.get(providerId.toLowerCase().trim())
    if (!adapter) {
      throw new Error(`Unknown provider adapter: ${providerId}`)
    }

    const credential = credentialManager.getCredential(adapter.id)
    const configured = adapter.authType === 'none' || credentialManager.hasCredential(adapter.id)
    const healthRes = await adapter.healthCheck({ credential })

    return {
      id: adapter.id,
      name: adapter.name,
      category: adapter.category,
      authType: adapter.authType,
      configured,
      health: healthRes.status,
      message: healthRes.message,
    }
  }
}

export const apiRegistry = new ApiRegistry()
