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

export interface NetworkAdapterInfo {
  adapterName: string
  adapterType?: string
  linkSpeed?: string
  status: 'Up' | 'Connected' | 'Disconnected' | 'Unknown'
}

export interface SystemMetrics {
  cpuUsagePercent: number
  memoryUsagePercent: number
  memoryUsedBytes: number
  memoryTotalBytes: number
  memoryFreeBytes: number
  storageUsagePercent: number
  storageUsedBytes: number
  storageTotalBytes: number
  storageDrive: string
  network: NetworkAdapterInfo
  operationalState: 'operational' | 'degraded' | 'unavailable'
  statusMessage: string
  timestamp: number
}

export type CapabilityId =
  | 'system_metrics'
  | 'hardware_devices'
  | 'filesystem'
  | 'processes'
  | 'applications'
  | 'clipboard'
  | 'notifications'
  | 'windows_services'

export type PermissionState = 'granted' | 'prompt' | 'denied' | 'admin_required' | 'unavailable'

export type RiskLevel = 'read' | 'write' | 'control' | 'destructive' | 'privileged'

export interface CapabilityMeta {
  id: CapabilityId
  name: string
  description: string
  category: 'Telemetry' | 'Devices' | 'OS Operations' | 'Security'
  riskLevel: RiskLevel
  defaultState: PermissionState
  currentState: PermissionState
  supportedOnPlatform: boolean
  requiresAdmin: boolean
  lastUsedTimestamp?: number
}

export interface CapabilityRegistryStatus {
  platform: string
  isWindows: boolean
  isLocalEnvironment: boolean
  capabilities: Record<CapabilityId, CapabilityMeta>
  timestamp: number
}

export interface SystemCapabilities {
  localSystemAccess: boolean
  systemMetrics: boolean
  filesystemAccess: boolean
  platform: string
  isWindows?: boolean
  capabilities?: Record<CapabilityId, CapabilityMeta>
}

export interface CpuTelemetry {
  model: string
  physicalCores: number
  logicalCores: number
  speedMhz: number
  utilizationPercent: number
  architecture: string
}

export interface MemoryTelemetry {
  totalBytes: number
  usedBytes: number
  freeBytes: number
  usagePercent: number
}

export interface GpuTelemetry {
  available: boolean
  name: string
  driverVersion?: string
  videoProcessor?: string
  adapterRamBytes?: number
  status: string
}

export interface PowerTelemetry {
  hasBattery: boolean
  acConnected: boolean
  chargePercent: number
  status: string
}

export interface DisplayTelemetry {
  name: string
  resolution: string
  refreshRateHz: number
  status: string
}

export interface DriveTelemetry {
  drive: string
  label: string
  totalBytes: number
  usedBytes: number
  freeBytes: number
  usagePercent: number
}

export interface HardwareReport {
  cpu: CpuTelemetry
  memory: MemoryTelemetry
  gpu: GpuTelemetry
  power: PowerTelemetry
  displays: DisplayTelemetry[]
  drives: DriveTelemetry[]
  uptimeSeconds: number
  platform: string
  hostname: string
  timestamp: number
}

export interface WifiInfo {
  connected: boolean
  ssid?: string
  signalPercent?: number
  interfaceName?: string
  radioType?: string
  state?: string
}

export interface BluetoothDevice {
  name: string
  status: string
  present: boolean
}

export interface NetworkInterfaceInfo {
  name: string
  description?: string
  linkSpeed?: string
  status: string
  macAddress?: string
}

export interface AudioDevice {
  name: string
  manufacturer?: string
  status: string
}

export interface PrinterInfo {
  name: string
  driverName?: string
  isDefault: boolean
  status: string
  jobCount: number
}

export interface DevicesReport {
  wifi: WifiInfo
  bluetoothDevices: BluetoothDevice[]
  networkAdapters: NetworkInterfaceInfo[]
  audioDevices: AudioDevice[]
  printers: PrinterInfo[]
  timestamp: number
}

export interface ProcessItem {
  pid: number
  name: string
  cpuSeconds: number
  memoryBytes: number
  memoryMb: number
  responding: boolean
  isSystemProcess: boolean
}

export interface DesktopApp {
  name: string
  version?: string
  publisher?: string
  installLocation?: string
  isRunning?: boolean
  pid?: number
}

export interface WindowsServiceInfo {
  name: string
  displayName: string
  status: string
  startType?: string
}

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

export interface LocalDrive {
  drive: string
  path: string
  label: string
}

export interface LocalFileItem {
  name: string
  path: string
  type: 'dir' | 'file'
  size?: number
  extension?: string
  modifiedAt?: number
  isSensitive?: boolean
  isReadOnly?: boolean
}

export interface DirectoryListingResult {
  currentPath: string
  parentPath: string | null
  drive: string
  items: LocalFileItem[]
  totalItems: number
  totalDirs: number
  totalFiles: number
}

export interface FilePreviewResult {
  path: string
  name: string
  size: number
  modifiedAt: number
  content: string
  isBinary: boolean
  truncated: boolean
}

// ===========================================================================
// Multi-Model AI OS Types (Phase 3-5, 21-22, 31-32, 46-47)
// ===========================================================================

export type ModelRole = 'GENERAL' | 'REASONING' | 'CODING' | 'VISION' | 'FAST' | 'LOCAL' | 'AGENT' | 'EMBEDDING' | 'SPEECH' | 'VOICE' | 'IMAGE'
export type ModelCapability = 'text_generation' | 'tool_calling' | 'code_completion' | 'vision' | 'embedding' | 'streaming' | 'long_context' | 'reasoning' | 'multi_turn' | 'json_mode' | 'image_generation' | 'speech_to_text' | 'text_to_speech'
export type RoutingMode = 'AUTO' | 'LOCAL_ONLY' | 'CLOUD_ONLY' | 'OFFLINE'
export type PrivacyPolicy = 'LOCAL_ONLY' | 'HYBRID' | 'CLOUD_ALLOWED'

export interface ModelDescriptor {
  id: string
  displayName: string
  provider: string
  modelName: string
  roles: ModelRole[]
  capabilities: ModelCapability[]
  contextWindow: number
  maxOutputTokens: number
  license: string
  isLocal: boolean
  requiresGpu: boolean
  minVramGb: number
  quantization?: string
  sizeGb?: number
  costPerMillionTokens?: number
  defaultTemperature: number
  defaultTopP: number
  defaultMaxTokens: number
  tags: string[]
  description: string
  version?: string
  deprecated?: boolean
  enabled?: boolean
  priority?: number
  fallbackOrder?: number
  custom?: boolean
  parameters?: {
    temperature?: number
    maxTokens?: number
    topP?: number
  }
}

export interface ModelTestResult {
  modelId: string
  provider: string
  status: 'CONNECTED' | 'DEGRADED' | 'NOT_CONFIGURED' | 'ERROR'
  latencyMs: number
  sampleResponse?: string
  error?: string
  testedAt: number
}

export interface BudgetConfig {
  dailyLimitUsd?: number
  monthlyLimitUsd?: number
  maxCostPerRequestUsd?: number
  alertThresholdPercent?: number
  enforceStrictLimits?: boolean
}

export interface AIUserPreferences {
  preferredModelId?: string
  routingMode: RoutingMode
  privacyPolicy: PrivacyPolicy
  allowCloudFallback: boolean
  preferLocalWhenAvailable: boolean
}

export interface AIRoutingResult {
  selectedModel: ModelDescriptor
  fallbackChain: ModelDescriptor[]
  rationale: string
  routingMode: RoutingMode
}

export interface ModelDiscoveryResult {
  ollama: { reachable: boolean; models: string[]; registered: number }
  llamacpp: { reachable: boolean; models: string[]; registered: number }
  totalDiscovered: number
  discoveredAt: number
}

export interface HardwareProfile {
  totalRamGb: number
  availableRamGb: number
  gpuVramGb: number
  hasGpu: boolean
  cpuCores: number
  cpuModel: string
  canRunLocal: boolean
  recommendedMaxModelSizeGb: number
}

export interface ModelRecommendation {
  model: ModelDescriptor
  reason: string
  fitScore: number
  canRun: boolean
}

export interface HardwareCompatibilityReport {
  profile: HardwareProfile
  recommendations: ModelRecommendation[]
  recommendedLocalModel: ModelDescriptor | null
  cloudFallbackAdvised: boolean
}

export interface ModelHealthReport {
  cloud: Array<{ name: string; available: boolean; latencyMs: number; recentErrors: number; lastChecked: number }>
  local: {
    ollama: { name: string; available: boolean }
    llamacpp: { name: string; available: boolean }
  }
}

export interface ModelTelemetryEntry {
  id: string
  timestamp: number
  provider: string
  model: string
  profile: string
  latencyMs: number
  estimatedTokens: number
  estimatedCostUsd: number
  success: boolean
  fallbackEvents: number
  error?: string
  isLocal?: boolean
  routingMode?: string
}

export type WebHuntPipelineStatus =
  | 'NEW'
  | 'QUALIFIED'
  | 'CONTACTED'
  | 'INTERESTED'
  | 'NEGOTIATION'
  | 'CLOSED'
  | 'NOT_INTERESTED'
  | 'SAVED'
  | 'PREPARING'
  | 'APPLIED'
  | 'INTERVIEW'
  | 'OFFER'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'ARCHIVED'

export interface WebHuntPhysicalLead {
  id: string
  type: 'physical'
  businessName: string
  phone: string
  phoneFormatted: string
  phoneStatus: 'verified' | 'unverified' | 'unavailable'
  address?: string | null
  city?: string | null
  state?: string | null
  category?: string | null
  rating?: number | null
  reviewCount?: number | null
  hasWebsite: boolean
  noWebsiteConfidence: 'High' | 'Medium' | 'Verified'
  sourceProvider: string
  status: WebHuntPipelineStatus
  estimatedValue: number
  notes?: string | null
  tags?: string[]
  contactedAt?: string | null
  createdAt?: string | Date
  email?: string | null
  whatsapp?: string | null
  contactPageUrl?: string | null
  bookingUrl?: string | null
  socialProfiles?: {
    facebook?: string | null
    instagram?: string | null
    linkedin?: string | null
    twitter?: string | null
  }
}

export interface WebHuntRemoteJob {
  id: string
  type: 'online'
  title: string
  company: string
  location: string
  country: string
  isRemote: boolean
  remoteType: string
  category?: string | null
  tags: string[]
  url: string
  postedDate: string
  salary: string
  source: string
  status: WebHuntPipelineStatus
  estimatedValue: number
  notes?: string | null
  email?: string | null
  whatsapp?: string | null
  contactPageUrl?: string | null
  createdAt?: string | Date
}

export type WebHuntLeadItem = WebHuntPhysicalLead | WebHuntRemoteJob

export interface WebHuntSearchResult {
  leads: WebHuntLeadItem[]
  totalFetched: number
  qualifiedLeads: number
  searchId?: string
  cached?: boolean
}

export interface WebHuntGeneratedProposal {
  templateType: string
  title: string
  subject: string
  greeting: string
  body: string
  callToAction: string
  candidateName: string
  candidateTitle: string
  matchedSkills?: string[]
  unmatchedSkills?: string[]
  leadContext?: {
    businessName: string
    category?: string
    location?: string
    hasWebsite?: boolean
    phone?: string
    email?: string
  }
}

export interface WebHuntUser {
  id: string
  email: string
  name?: string | null
  role: string
  status?: string
  isVerified?: boolean
  profile?: any
}

export interface WebHuntAuthResponse {
  success: boolean
  authenticated?: boolean
  token?: string
  user?: WebHuntUser
  subscription?: {
    hasActiveSubscription: boolean
    plan?: string
    status?: string
  }
  error?: string
}

export interface WebHuntIntegrationStatus {
  connected: boolean
  baseUrl: string
  authenticated: boolean
  userEmail?: string
  userId?: string
  userName?: string
  plan?: string
  role?: string
  hasActiveSubscription?: boolean
  latencyMs: number
  sourceOfTruth: 'PRODUCTION_API' | 'LOCAL_FALLBACK'
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

    // 1. Guard against unconfigured gateway on static cloud hosting
    if (!this.baseUrl) {
      return {
        ok: false,
        status: 0,
        error: 'Remote Agent Gateway unconfigured. In production, configure VITE_API_URL.',
        isOffline: true,
      }
    }

    // 2. Circuit breaker: If known offline and in cooldown, skip background polling to prevent console flood
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

  // --- Real Hardware Telemetry ---

  public async getSystemMetrics(signal?: AbortSignal, isBackground = false): Promise<ApiResponse<SystemMetrics>> {
    return this.request<SystemMetrics>('/api/v1/system/metrics', {
      method: 'GET',
      signal,
      timeoutMs: 4500,
      isBackground,
    })
  }

  public async getSystemCapabilities(): Promise<ApiResponse<SystemCapabilities>> {
    return this.request<SystemCapabilities>('/api/v1/system/capabilities', {
      method: 'GET',
      timeoutMs: 3000,
    })
  }

  public async getCapabilities(): Promise<ApiResponse<SystemCapabilities>> {
    return this.getSystemCapabilities()
  }

  // --- Genuine Local Filesystem Operations ---

  public async getFsDrives(): Promise<ApiResponse<{ drives: LocalDrive[]; defaultPath: string }>> {
    return this.request<{ drives: LocalDrive[]; defaultPath: string }>('/api/v1/fs/drives', {
      method: 'GET',
      timeoutMs: 4000,
    })
  }

  public async listDirectory(path?: string, signal?: AbortSignal): Promise<ApiResponse<DirectoryListingResult>> {
    const qs = path ? `?path=${encodeURIComponent(path)}` : ''
    return this.request<DirectoryListingResult>(`/api/v1/fs/list${qs}`, {
      method: 'GET',
      signal,
      timeoutMs: 6000,
    })
  }

  public async readFilePreview(filePath: string, signal?: AbortSignal): Promise<ApiResponse<FilePreviewResult>> {
    return this.request<FilePreviewResult>(`/api/v1/fs/read?path=${encodeURIComponent(filePath)}`, {
      method: 'GET',
      signal,
      timeoutMs: 6000,
    })
  }

  public async createFolder(parentPath: string, folderName: string): Promise<ApiResponse<{ success: boolean; path: string }>> {
    return this.request('/api/v1/fs/mkdir', {
      method: 'POST',
      body: JSON.stringify({ parentPath, folderName }),
    })
  }

  public async renameFile(oldPath: string, newName: string): Promise<ApiResponse<{ success: boolean; path: string }>> {
    return this.request('/api/v1/fs/rename', {
      method: 'POST',
      body: JSON.stringify({ oldPath, newName }),
    })
  }

  public async deleteFile(targetPath: string, confirmName: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request('/api/v1/fs/delete', {
      method: 'POST',
      body: JSON.stringify({ targetPath, confirmName }),
    })
  }

  // --- Windows OS Operating System Integrations ---

  public async setCapabilityPermission(
    id: CapabilityId,
    state: PermissionState,
  ): Promise<ApiResponse<{ success: boolean; capability: CapabilityMeta }>> {
    return this.request<{ success: boolean; capability: CapabilityMeta }>('/api/v1/system/capabilities/permission', {
      method: 'PATCH',
      body: JSON.stringify({ id, state }),
    })
  }

  public async getHardwareReport(
    signal?: AbortSignal,
    isBackground = false,
  ): Promise<ApiResponse<HardwareReport>> {
    return this.request<HardwareReport>('/api/v1/system/hardware', {
      method: 'GET',
      signal,
      timeoutMs: 4500,
      isBackground,
    })
  }

  public async getDevicesReport(
    signal?: AbortSignal,
    isBackground = false,
  ): Promise<ApiResponse<DevicesReport>> {
    return this.request<DevicesReport>('/api/v1/system/devices', {
      method: 'GET',
      signal,
      timeoutMs: 4500,
      isBackground,
    })
  }

  public async getProcesses(
    limit = 35,
    signal?: AbortSignal,
  ): Promise<ApiResponse<{ total: number; processes: ProcessItem[] }>> {
    return this.request<{ total: number; processes: ProcessItem[] }>(
      `/api/v1/system/processes?limit=${limit}`,
      {
        method: 'GET',
        signal,
        timeoutMs: 5000,
      },
    )
  }

  public async terminateProcess(
    pid: number,
    confirmName: string,
    hasConfirmation = false,
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request<{ success: boolean; message: string }>('/api/v1/system/processes/terminate', {
      method: 'POST',
      body: JSON.stringify({ pid, confirmName, hasConfirmation }),
    })
  }

  public async getInstalledAndRunningApps(
    signal?: AbortSignal,
  ): Promise<ApiResponse<{ installed: DesktopApp[]; running: DesktopApp[] }>> {
    return this.request<{ installed: DesktopApp[]; running: DesktopApp[] }>('/api/v1/system/apps', {
      method: 'GET',
      signal,
      timeoutMs: 6000,
    })
  }

  public async launchApp(
    app: string,
    hasConfirmation = false,
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request<{ success: boolean; message: string }>('/api/v1/system/apps/launch', {
      method: 'POST',
      body: JSON.stringify({ app, hasConfirmation }),
    })
  }

  public async getClipboard(
    hasConfirmation = false,
  ): Promise<ApiResponse<{ success: boolean; text?: string; error?: string }>> {
    const qs = hasConfirmation ? '?confirm=1' : ''
    return this.request<{ success: boolean; text?: string; error?: string }>(
      `/api/v1/system/clipboard${qs}`,
      {
        method: 'GET',
        timeoutMs: 4000,
      },
    )
  }

  public async setClipboard(
    text: string,
    hasConfirmation = false,
  ): Promise<ApiResponse<{ success: boolean; error?: string }>> {
    return this.request<{ success: boolean; error?: string }>('/api/v1/system/clipboard', {
      method: 'POST',
      body: JSON.stringify({ text, hasConfirmation }),
    })
  }

  public async sendSystemNotification(
    title: string,
    message: string,
  ): Promise<ApiResponse<{ success: boolean; error?: string }>> {
    return this.request<{ success: boolean; error?: string }>('/api/v1/system/notify', {
      method: 'POST',
      body: JSON.stringify({ title, message }),
    })
  }

  public async getWindowsServices(
    limit = 30,
    signal?: AbortSignal,
  ): Promise<ApiResponse<{ services: WindowsServiceInfo[] }>> {
    return this.request<{ services: WindowsServiceInfo[] }>(
      `/api/v1/system/services?limit=${limit}`,
      {
        method: 'GET',
        signal,
        timeoutMs: 4500,
      },
    )
  }

  public async getSystemAuditLog(
    limit = 50,
    capability?: string,
    signal?: AbortSignal,
  ): Promise<ApiResponse<{ total: number; entries: SystemAuditEntry[] }>> {
    const qs = capability ? `&capability=${encodeURIComponent(capability)}` : ''
    return this.request<{ total: number; entries: SystemAuditEntry[] }>(
      `/api/v1/system/audit-log?limit=${limit}${qs}`,
      {
        method: 'GET',
        signal,
        timeoutMs: 4000,
      },
    )
  }

  // ===========================================================================
  // Multi-Model AI OS API Methods (Phase 21-24, 33, 41-43, 46-47)
  // ===========================================================================

  public async getModels(
    filter?: 'local' | 'cloud' | 'all',
    role?: string,
    signal?: AbortSignal,
  ): Promise<ApiResponse<{ models: ModelDescriptor[]; total: number }>> {
    const qs = new URLSearchParams()
    if (filter) qs.set('filter', filter)
    if (role) qs.set('role', role)
    const q = qs.toString() ? `?${qs.toString()}` : ''
    return this.request<{ models: ModelDescriptor[]; total: number }>(
      `/api/v1/models${q}`,
      { method: 'GET', signal, timeoutMs: 5000 },
    )
  }

  public async getModelById(
    modelId: string,
    signal?: AbortSignal,
  ): Promise<ApiResponse<ModelDescriptor>> {
    return this.request<ModelDescriptor>(
      `/api/v1/models/${encodeURIComponent(modelId)}`,
      { method: 'GET', signal, timeoutMs: 3000 },
    )
  }

  public async routeModel(
    request: { profile?: string; routingMode?: RoutingMode; privacyPolicy?: PrivacyPolicy; preferredModelId?: string; requiresVision?: boolean },
    signal?: AbortSignal,
  ): Promise<ApiResponse<AIRoutingResult>> {
    return this.request<AIRoutingResult>(
      '/api/v1/models/route',
      { method: 'POST', body: JSON.stringify(request), signal, timeoutMs: 5000 },
    )
  }

  public async discoverLocalModels(signal?: AbortSignal): Promise<ApiResponse<ModelDiscoveryResult>> {
    return this.request<ModelDiscoveryResult>(
      '/api/v1/models/discover',
      { method: 'POST', body: '{}', signal, timeoutMs: 15000 },
    )
  }

  public async getDiscoveryStatus(signal?: AbortSignal): Promise<ApiResponse<ModelDiscoveryResult>> {
    return this.request<ModelDiscoveryResult>(
      '/api/v1/models/discovery/status',
      { method: 'GET', signal, timeoutMs: 3000 },
    )
  }

  public async getHardwareCompatibility(signal?: AbortSignal): Promise<ApiResponse<HardwareCompatibilityReport>> {
    return this.request<HardwareCompatibilityReport>(
      '/api/v1/models/hardware',
      { method: 'GET', signal, timeoutMs: 8000 },
    )
  }

  public async installModel(
    modelId: string,
    provider: string,
    userConsented: true,
    signal?: AbortSignal,
  ): Promise<ApiResponse<{ status: string; modelId: string; message: string }>> {
    return this.request<{ status: string; modelId: string; message: string }>(
      '/api/v1/models/install',
      {
        method: 'POST',
        body: JSON.stringify({ modelId, provider, userConsented }),
        signal,
        timeoutMs: 10000,
      },
    )
  }

  public async getModelPreferences(userId = 'default', signal?: AbortSignal): Promise<ApiResponse<AIUserPreferences>> {
    return this.request<AIUserPreferences>(
      `/api/v1/models/preferences?userId=${encodeURIComponent(userId)}`,
      { method: 'GET', signal, timeoutMs: 3000 },
    )
  }

  public async updateModelPreferences(
    prefs: Partial<AIUserPreferences> & { userId?: string },
    signal?: AbortSignal,
  ): Promise<ApiResponse<{ success: boolean; preferences: AIUserPreferences }>> {
    return this.request<{ success: boolean; preferences: AIUserPreferences }>(
      '/api/v1/models/preferences',
      { method: 'PATCH', body: JSON.stringify(prefs), signal, timeoutMs: 3000 },
    )
  }

  public async getModelTelemetry(limit = 50, signal?: AbortSignal): Promise<ApiResponse<{ telemetry: ModelTelemetryEntry[]; routerSummary: Record<string, unknown> }>> {
    return this.request<{ telemetry: ModelTelemetryEntry[]; routerSummary: Record<string, unknown> }>(
      `/api/v1/models/telemetry?limit=${limit}`,
      { method: 'GET', signal, timeoutMs: 5000 },
    )
  }

  public async getModelHealth(signal?: AbortSignal): Promise<ApiResponse<ModelHealthReport>> {
    return this.request<ModelHealthReport>(
      '/api/v1/models/health',
      { method: 'GET', signal, timeoutMs: 10000 },
    )
  }

  public async testModel(
    modelId: string,
    signal?: AbortSignal,
  ): Promise<ApiResponse<ModelTestResult>> {
    return this.request<ModelTestResult>(
      '/api/v1/models/test',
      { method: 'POST', body: JSON.stringify({ modelId }), signal, timeoutMs: 15000 },
    )
  }

  public async updateModel(
    modelId: string,
    updates: Partial<ModelDescriptor>,
    signal?: AbortSignal,
  ): Promise<ApiResponse<{ success: boolean; model: ModelDescriptor }>> {
    return this.request<{ success: boolean; model: ModelDescriptor }>(
      `/api/v1/models/${encodeURIComponent(modelId)}`,
      { method: 'PATCH', body: JSON.stringify(updates), signal, timeoutMs: 5000 },
    )
  }

  public async registerCustomModel(
    data: Partial<ModelDescriptor> & { id: string; displayName: string; provider: string; modelName: string },
    signal?: AbortSignal,
  ): Promise<ApiResponse<{ success: boolean; model: ModelDescriptor }>> {
    return this.request<{ success: boolean; model: ModelDescriptor }>(
      '/api/v1/models/custom',
      { method: 'POST', body: JSON.stringify(data), signal, timeoutMs: 5000 },
    )
  }

  public async deleteCustomModel(
    modelId: string,
    signal?: AbortSignal,
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request<{ success: boolean; message: string }>(
      `/api/v1/models/${encodeURIComponent(modelId)}`,
      { method: 'DELETE', signal, timeoutMs: 5000 },
    )
  }

  public async getBudget(signal?: AbortSignal): Promise<ApiResponse<BudgetConfig>> {
    return this.request<BudgetConfig>(
      '/api/v1/models/budget',
      { method: 'GET', signal, timeoutMs: 4000 },
    )
  }

  public async updateBudget(
    updates: Partial<BudgetConfig>,
    signal?: AbortSignal,
  ): Promise<ApiResponse<{ success: boolean; budget: BudgetConfig }>> {
    return this.request<{ success: boolean; budget: BudgetConfig }>(
      '/api/v1/models/budget',
      { method: 'PATCH', body: JSON.stringify(updates), signal, timeoutMs: 4000 },
    )
  }

  public async compareModels(
    idA: string,
    idB: string,
    signal?: AbortSignal,
  ): Promise<ApiResponse<{ modelA: ModelDescriptor; modelB: ModelDescriptor; differences: Record<string, unknown> }>> {
    return this.request<{ modelA: ModelDescriptor; modelB: ModelDescriptor; differences: Record<string, unknown> }>(
      `/api/v1/models/compare?a=${encodeURIComponent(idA)}&b=${encodeURIComponent(idB)}`,
      { method: 'GET', signal, timeoutMs: 5000 },
    )
  }

  // ---------------------------------------------------------------------------
  // WebHunt Delta Intelligence & CRM Client Methods
  // ---------------------------------------------------------------------------

  public async webHuntLogin(
    email: string,
    password: string,
    signal?: AbortSignal
  ): Promise<ApiResponse<WebHuntAuthResponse>> {
    return this.request<WebHuntAuthResponse>('/api/v1/webhunt/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      signal,
      timeoutMs: 8000,
    })
  }

  public async webHuntLogout(signal?: AbortSignal): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request<{ success: boolean; message: string }>('/api/v1/webhunt/auth/logout', {
      method: 'POST',
      signal,
      timeoutMs: 4000,
    })
  }

  public async webHuntGetMe(signal?: AbortSignal): Promise<ApiResponse<WebHuntAuthResponse>> {
    return this.request<WebHuntAuthResponse>('/api/v1/webhunt/auth/me', {
      method: 'GET',
      signal,
      timeoutMs: 6000,
    })
  }

  public async webHuntGetStatus(signal?: AbortSignal): Promise<ApiResponse<WebHuntIntegrationStatus>> {
    return this.request<WebHuntIntegrationStatus>('/api/v1/webhunt/status', { method: 'GET', signal, timeoutMs: 6000 })
  }

  public async webHuntSearchPhysical(
    params: { niche: string; location?: string; country?: string; radius?: number },
    signal?: AbortSignal
  ): Promise<ApiResponse<WebHuntSearchResult>> {
    const qs = new URLSearchParams({
      niche: params.niche,
      country: params.country || 'KE',
      radius: String(params.radius || 25),
    })
    if (params.location) qs.set('location', params.location)
    return this.request<WebHuntSearchResult>(`/api/v1/webhunt/radar/physical?${qs.toString()}`, { method: 'GET', signal, timeoutMs: 20000 })
  }

  public async webHuntSearchRemote(
    params: { query: string; category?: string },
    signal?: AbortSignal
  ): Promise<ApiResponse<WebHuntSearchResult>> {
    const qs = new URLSearchParams({ query: params.query })
    if (params.category) qs.set('category', params.category)
    return this.request<WebHuntSearchResult>(`/api/v1/webhunt/radar/remote?${qs.toString()}`, { method: 'GET', signal, timeoutMs: 20000 })
  }

  public async webHuntGetLeads(
    params?: { status?: string; search?: string; pipelineType?: string },
    signal?: AbortSignal
  ): Promise<ApiResponse<{ success: boolean; count: number; leads: WebHuntLeadItem[] }>> {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.search) qs.set('search', params.search)
    if (params?.pipelineType) qs.set('pipelineType', params.pipelineType)
    const url = `/api/v1/webhunt/crm/leads${qs.toString() ? `?${qs.toString()}` : ''}`
    return this.request<{ success: boolean; count: number; leads: WebHuntLeadItem[] }>(url, { method: 'GET', signal, timeoutMs: 6000 })
  }

  public async webHuntGetLead(id: string, signal?: AbortSignal): Promise<ApiResponse<{ success: boolean; lead: WebHuntLeadItem }>> {
    return this.request<{ success: boolean; lead: WebHuntLeadItem }>(`/api/v1/webhunt/crm/leads/${encodeURIComponent(id)}`, { method: 'GET', signal, timeoutMs: 6000 })
  }

  public async webHuntSaveLead(lead: Partial<WebHuntLeadItem>, signal?: AbortSignal): Promise<ApiResponse<{ success: boolean; leadId?: string; error?: string }>> {
    return this.request<{ success: boolean; leadId?: string; error?: string }>('/api/v1/webhunt/crm/leads', {
      method: 'POST',
      body: JSON.stringify({ lead }),
      signal,
      timeoutMs: 8000,
    })
  }

  public async webHuntUpdateLead(
    id: string,
    updates: { status?: WebHuntPipelineStatus; notes?: string; estimatedValue?: number },
    signal?: AbortSignal
  ): Promise<ApiResponse<{ success: boolean; error?: string }>> {
    return this.request<{ success: boolean; error?: string }>(`/api/v1/webhunt/crm/leads/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
      signal,
      timeoutMs: 6000,
    })
  }

  public async webHuntDeleteLead(id: string, signal?: AbortSignal): Promise<ApiResponse<{ success: boolean; error?: string }>> {
    return this.request<{ success: boolean; error?: string }>(`/api/v1/webhunt/crm/leads/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      signal,
      timeoutMs: 6000,
    })
  }

  public async webHuntGeneratePitch(
    payload: { leadId?: string; lead?: WebHuntLeadItem; templateType?: string; profile?: any },
    signal?: AbortSignal
  ): Promise<ApiResponse<{ success: boolean; proposal: WebHuntGeneratedProposal }>> {
    return this.request<{ success: boolean; proposal: WebHuntGeneratedProposal }>('/api/v1/webhunt/pitch/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
      timeoutMs: 8000,
    })
  }

  public async webHuntGetSearches(signal?: AbortSignal): Promise<ApiResponse<{ success: boolean; history: any[]; saved: any[] }>> {
    return this.request<{ success: boolean; history: any[]; saved: any[] }>('/api/v1/webhunt/searches', { method: 'GET', signal, timeoutMs: 6000 })
  }
}

export const apiClient = new ApiClient()
