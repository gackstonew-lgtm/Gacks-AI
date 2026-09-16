/**
 * Centralized API Client with Circuit Breaker & Offline Resilience
 * 
 * Provides unified, typed access to the Agent Gateway / Business Suite API.
 * Prevents network error flooding when the local bridge/server is offline,
 * manages request timeouts, supports AbortSignal cancellation, and provides
 * graceful degraded fallbacks.
 */

import { BRIDGE_HTTP_URL } from '../config'

export interface ApiResponse<T = any> {
  ok: boolean
  status: number
  data?: T
  error?: string
  isOffline?: boolean
}

export interface SystemHealthReport {
  ok: boolean
  timestamp: number
  version?: string
  environment?: string
  services?: Record<string, any>
  status?: string
}

class ApiClient {
  private baseUrl = BRIDGE_HTTP_URL
  private isGatewayOnline: boolean | null = null
  private lastFailureTime = 0
  private failureCount = 0
  private offlineCooldownMs = 25000 // 25 seconds cooldown between background retries when offline
  private listeners: Set<(online: boolean | null) => void> = new Set()

  public get onlineStatus(): boolean | null {
    return this.isGatewayOnline
  }

  public subscribeStatus(listener: (online: boolean | null) => void): () => void {
    this.listeners.add(listener)
    listener(this.isGatewayOnline)
    return () => this.listeners.delete(listener)
  }

  private notifyStatus(status: boolean | null) {
    if (this.isGatewayOnline !== status) {
      this.isGatewayOnline = status
      this.listeners.forEach((fn) => {
        try {
          fn(status)
        } catch {}
      })
    }
  }

  public resetCircuitBreaker(): void {
    this.lastFailureTime = 0
    this.failureCount = 0
  }

  public async request<T = any>(
    path: string,
    options: RequestInit & { timeoutMs?: number; isBackground?: boolean } = {},
  ): Promise<ApiResponse<T>> {
    const isBackground = Boolean(options.isBackground)
    const now = Date.now()

    // 1. Circuit breaker: If known offline and in cooldown, skip background polling to prevent console flood
    if (isBackground && this.isGatewayOnline === false && now - this.lastFailureTime < this.offlineCooldownMs) {
      return {
        ok: false,
        status: 0,
        error: 'Gateway offline (cooldown active)',
        isOffline: true,
      }
    }

    const controller = new AbortController()
    const timeout = options.timeoutMs || 6000
    const timer = setTimeout(() => controller.abort(), timeout)

    // Chain caller's signal if provided
    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort())
    }

    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      })

      clearTimeout(timer)

      // Gateway responded successfully
      this.failureCount = 0
      this.notifyStatus(true)

      let data: any = null
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        try {
          data = await response.json()
        } catch {
          data = null
        }
      }

      return {
        ok: response.ok,
        status: response.status,
        data: data as T,
        error: response.ok ? undefined : (data?.error || `HTTP ${response.status}`),
        isOffline: false,
      }
    } catch (err: any) {
      clearTimeout(timer)
      const isAbort = err.name === 'AbortError'
      const isNetError = err instanceof TypeError || err.message?.includes('fetch') || isAbort

      this.lastFailureTime = Date.now()
      this.failureCount++
      this.notifyStatus(false)

      return {
        ok: false,
        status: 0,
        error: isAbort ? 'Request timed out' : (err.message || 'Network connection failed'),
        isOffline: isNetError,
      }
    }
  }

  // --- Specialized Business & System Methods ---

  public async getHealth(signal?: AbortSignal, isBackground = false): Promise<ApiResponse<SystemHealthReport>> {
    return this.request<SystemHealthReport>('/api/v1/health', {
      method: 'GET',
      signal,
      timeoutMs: 4000,
      isBackground,
    })
  }

  public async getBriefing(workspaceId = 'default-workspace'): Promise<ApiResponse<any>> {
    return this.request(`/api/v1/business/briefing?workspaceId=${encodeURIComponent(workspaceId)}`, {
      method: 'GET',
    })
  }

  public async getApprovals(workspaceId?: string): Promise<ApiResponse<{ approvals: any[] }>> {
    const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ''
    return this.request<{ approvals: any[] }>(`/api/v1/business/approvals${qs}`, {
      method: 'GET',
    })
  }

  public async resolveApproval(id: string, decision: 'approved' | 'rejected', resolvedBy = 'operator'): Promise<ApiResponse<any>> {
    return this.request('/api/v1/business/approvals', {
      method: 'POST',
      body: JSON.stringify({ id, decision, resolvedBy }),
    })
  }

  public async getCrm(): Promise<ApiResponse<{ customers: any[] }>> {
    return this.request<{ customers: any[] }>('/api/v1/business/crm', {
      method: 'GET',
    })
  }

  public async auditForex(params: {
    pair: string
    direction: 'LONG' | 'SHORT'
    entryPrice: number
    stopLoss: number
    takeProfit: number
    riskPercent: number
  }): Promise<ApiResponse<{ report: any }>> {
    return this.request<{ report: any }>('/api/v1/business/forex/audit', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  public async getCredentials(): Promise<ApiResponse<{ credentials: any[] }>> {
    return this.request<{ credentials: any[] }>('/api/v1/apis/credentials', {
      method: 'GET',
      timeoutMs: 4000,
    })
  }

  public async executeAdapter(providerId: string, operation: string, params: Record<string, unknown> = {}): Promise<ApiResponse<any>> {
    return this.request('/api/v1/apis/execute', {
      method: 'POST',
      body: JSON.stringify({ providerId, operation, params }),
    })
  }

  public async testProvider(providerId: string): Promise<ApiResponse<any>> {
    return this.request('/api/v1/apis/test', {
      method: 'POST',
      body: JSON.stringify({ providerId }),
    })
  }
}

export const apiClient = new ApiClient()
