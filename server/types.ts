/**
 * GACKS P.A. V2 — Core Domain Types and Contracts
 */

export type RiskLevel = 0 | 1 | 2 | 3 | 4

export const RiskLevels = {
  READ_ONLY: 0 as RiskLevel,
  LOW_RISK_WRITE: 1 as RiskLevel,
  EXTERNAL_SIDE_EFFECT: 2 as RiskLevel,
  DESTRUCTIVE_SECURITY: 3 as RiskLevel,
  FINANCIAL_HIGH_CONSEQUENCE: 4 as RiskLevel,
} as const

export type VerificationStatus =
  | 'verified_success'
  | 'unverified_success'
  | 'partial_success'
  | 'failure'
  | 'pending'

export interface ToolResult<T = unknown> {
  success: boolean
  tool: string
  durationMs: number
  data?: T
  error?: string | null
  verification?: {
    status: VerificationStatus
    details?: string
  }
}

export type PlanStepStatus =
  | 'pending'
  | 'running'
  | 'blocked'
  | 'failed'
  | 'completed'
  | 'skipped'

export interface PlanStep {
  id: string
  description: string
  status: PlanStepStatus
  tool?: string | null
  args?: Record<string, unknown>
  dependencies: string[]
  result?: ToolResult | null
  verificationStatus?: VerificationStatus
  verificationDetails?: string
}

export interface Plan {
  id: string
  goal: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused'
  steps: PlanStep[]
  createdAt: number
  updatedAt: number
}

export type MissionPhase =
  | 'PLANNING'
  | 'DIAGNOSIS'
  | 'IMPLEMENTATION'
  | 'VERIFICATION'
  | 'DEPLOYMENT'

export interface MissionState {
  id: string
  title: string
  goal: string
  progress: number // 0 to 100
  currentPhase: MissionPhase
  phaseStatuses: Record<MissionPhase, 'pending' | 'active' | 'completed' | 'failed'>
  plan?: Plan
  startedAt: number
  updatedAt: number
  completedAt?: number | null
}

export type MemoryCategory = 'working' | 'episodic' | 'semantic' | 'procedural'
export type MemoryScope = 'user' | 'workspace' | 'project' | 'customer' | 'task' | 'session'

export interface MemoryRecord {
  id: string
  userId: string
  workspaceId?: string
  scope?: MemoryScope
  category: MemoryCategory
  content: string
  importance: number // 1 to 5
  confidence: number // 0 to 1
  source?: string
  tags: string[]
  metadata?: Record<string, unknown>
  createdAt: number
  updatedAt: number
  accessedAt: number
  accessCount: number
}

export interface EntityRecord {
  id: string
  userId: string
  workspaceId?: string
  name: string
  type: 'person' | 'project' | 'service' | 'device' | 'file' | 'goal' | 'task' | 'company' | 'customer' | 'campaign'
  properties: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

export interface EntityRelationRecord {
  id: string
  userId: string
  workspaceId?: string
  sourceId: string
  targetId: string
  relation:
    | 'works_on'
    | 'uses'
    | 'depends_on'
    | 'belongs_to'
    | 'related_to'
    | 'created_by'
    | 'deployed_on'
    | 'manages'
  metadata?: Record<string, unknown>
  createdAt: number
}

export type ModelProfile =
  | 'FAST'
  | 'GENERAL'
  | 'REASONING'
  | 'CODING'
  | 'VISION'
  | 'LONG_CONTEXT'
  | 'BUSINESS_ANALYSIS'
  | 'RESEARCH'
  | 'DOCUMENT'
  | 'LOW_COST'

/** Functional role of a model — determines routing priority */
export type ModelRole =
  | 'GENERAL'
  | 'REASONING'
  | 'CODING'
  | 'VISION'
  | 'FAST'
  | 'LOCAL'
  | 'AGENT'
  | 'EMBEDDING'
  | 'SPEECH'
  | 'VOICE'
  | 'IMAGE'

/** Fine-grained capabilities a model may possess */
export type ModelCapability =
  | 'text_generation'
  | 'tool_calling'
  | 'code_completion'
  | 'vision'
  | 'embedding'
  | 'streaming'
  | 'long_context'
  | 'reasoning'
  | 'multi_turn'
  | 'json_mode'
  | 'image_generation'
  | 'speech_to_text'
  | 'text_to_speech'

/** How the router is allowed to dispatch requests */
export type RoutingMode = 'AUTO' | 'LOCAL_ONLY' | 'CLOUD_ONLY' | 'OFFLINE'

/** Privacy policy governing where data may flow */
export type PrivacyPolicy = 'LOCAL_ONLY' | 'HYBRID' | 'CLOUD_ALLOWED'

/** License category for a model */
export type ModelLicense =
  | 'proprietary'
  | 'apache-2.0'
  | 'mit'
  | 'llama-community'
  | 'gpl'
  | 'cc-by-4.0'
  | 'other'

/** Cloud AI providers */
export type CloudProviderName =
  | 'gemini'
  | 'anthropic'
  | 'openai'
  | 'deepseek'
  | 'azure'
  | 'bedrock'
  | 'groq'
  | 'mistral'
  | 'openrouter'
  | 'litellm'

/** Local AI providers (self-hosted) */
export type LocalProviderName = 'ollama' | 'llamacpp'

/** Union of all provider names */
export type AIProviderName = CloudProviderName | LocalProviderName

/** Full descriptor for a registered AI model */
export interface ModelDescriptor {
  id: string                        // unique stable ID e.g. "gemini-2.5-flash"
  displayName: string               // human-readable name
  provider: AIProviderName
  modelName: string                 // exact API model name
  roles: ModelRole[]
  capabilities: ModelCapability[]
  contextWindow: number             // max tokens in context
  maxOutputTokens: number
  license: ModelLicense
  isLocal: boolean                  // true = runs locally, no data leaves device
  requiresGpu: boolean
  minVramGb: number                 // 0 if CPU-only
  quantization?: string             // e.g. "Q4_K_M", "Q8_0", undefined for cloud
  sizeGb?: number                   // download size for local models
  costPerMillionTokens?: number     // undefined for local/free
  defaultTemperature: number
  defaultTopP: number
  defaultMaxTokens: number
  tags: string[]
  description: string
  version?: string
  deprecated?: boolean
  enabled?: boolean                 // enabled status in Model Hub
  priority?: number                // priority score / routing weight (higher is preferred)
  fallbackOrder?: number           // order in fallback chain
  custom?: boolean                 // true if added dynamically by user
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

/** Routing request passed to AIOrchestrator */
export interface AIRoutingRequest {
  profile: ModelProfile
  routingMode?: RoutingMode
  privacyPolicy?: PrivacyPolicy
  preferredModelId?: string         // user-pinned model
  taskClassification?: string
  estimatedTokens?: number
  requiresVision?: boolean
  requiresToolCalling?: boolean
}

/** Result of model routing/selection */
export interface AIRoutingResult {
  selectedModel: ModelDescriptor
  fallbackChain: ModelDescriptor[]
  rationale: string
  routingMode: RoutingMode
}

/** Request to install a local model (must be user-initiated) */
export interface ModelInstallRequest {
  modelId: string
  provider: LocalProviderName
  userConsented: boolean
  consentTimestamp: number
}

/** Status of a model installation */
export interface ModelInstallStatus {
  modelId: string
  provider: LocalProviderName
  status: 'pending' | 'downloading' | 'verifying' | 'installed' | 'failed' | 'cancelled'
  progressPercent?: number
  errorMessage?: string
  installedAt?: number
}

/** Normalized AI error codes across all providers */
export type AIErrorCode =
  | 'QUOTA_EXCEEDED'
  | 'AUTH_ERROR'
  | 'MODEL_NOT_FOUND'
  | 'CONTEXT_TOO_LONG'
  | 'CONTENT_FILTERED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'PROVIDER_OFFLINE'
  | 'OOM'
  | 'UNKNOWN'

export interface NormalizedAIError {
  code: AIErrorCode
  provider: AIProviderName
  model: string
  message: string
  retryable: boolean
  raw?: string
}

export interface ProviderHealth {
  name: string
  available: boolean
  latencyMs: number
  recentErrors: number
  rateLimitRemaining?: number
  lastChecked: number
}

export interface ModelTelemetryRecord {
  id: string
  timestamp: number
  provider: AIProviderName
  model: string
  profile: ModelProfile
  latencyMs: number
  estimatedTokens: number
  estimatedCostUsd: number
  success: boolean
  fallbackEvents: number
  error?: string
  isLocal?: boolean
  routingMode?: RoutingMode
}

export interface BusinessGoal {
  id: string
  workspaceId: string
  title: string
  metric: string
  currentValue: number
  targetValue: number
  deadline: string
  status: 'on_track' | 'at_risk' | 'behind' | 'achieved'
}

export interface CustomerRecord {
  id: string
  workspaceId: string
  name: string
  email?: string
  phone?: string
  channel?: 'whatsapp' | 'email' | 'web' | 'meta'
  status: 'lead' | 'active' | 'churn_risk' | 'churned'
  sentiment?: 'positive' | 'neutral' | 'negative'
  ltvUsd: number
  tags: string[]
  notes: string[]
  lastContactAt: number
  createdAt: number
}

export interface CampaignDraft {
  id: string
  workspaceId: string
  platform: 'meta' | 'email' | 'whatsapp' | 'social'
  name: string
  objective: string
  targetAudience: string
  copyHeadline: string
  copyBody: string
  dailyBudgetUsd: number
  status: 'draft' | 'pending_approval' | 'approved' | 'published' | 'rejected'
  createdAt: number
}

export interface ForexAuditReport {
  id: string
  pair: string
  timeframe: string
  direction: 'LONG' | 'SHORT' | 'WAIT'
  entryPrice: number
  stopLoss: number
  takeProfit: number
  riskPercent: number
  riskRewardRatio: number
  positionSizeLots: number
  marketContext: string
  strengths: string[]
  riskFlags: string[]
  invalidationLevel: number
  safetyDisclaimer: string
  auditedAt: number
}

export interface ApprovalRequest {
  id: string
  workspaceId: string
  action: string
  reason: string
  provider: string
  target: string
  potentialImpact: 'LOW' | 'MEDIUM' | 'HIGH' | 'FINANCIAL_HIGH'
  costUsd?: number
  status: 'pending' | 'approved' | 'rejected' | 'edited'
  payload: Record<string, unknown>
  createdAt: number
  resolvedAt?: number
  resolvedBy?: string
}

export interface AutomationRule {
  id: string
  workspaceId: string
  title: string
  trigger: 'schedule' | 'webhook' | 'lead_created' | 'low_inventory' | 'negative_sentiment'
  scheduleCron?: string
  condition?: string
  actionDescription: string
  actionTool: string
  requiresApproval: boolean
  enabled: boolean
  lastRunAt?: number
  runCount: number
}

export interface AuditEvent {
  id: string
  timestamp: number
  userId: string
  sessionId: string
  agentRunId: string
  tool?: string
  action: string
  inputsMetadata: Record<string, unknown>
  permissionDecision: 'ALLOWED' | 'DENIED' | 'CONFIRMED'
  resultSuccess: boolean
  durationMs: number
  verificationStatus: VerificationStatus
  errorMessage?: string
}

export interface SystemHealthReport {
  ok: boolean
  service?: string
  timestamp: number
  version: string
  environment: 'development' | 'production'
  ai?: boolean
  stt?: boolean
  tts?: boolean
  browser?: boolean
  filesystem?: boolean
  android?: boolean
  imageGeneration?: boolean
  mcp?: boolean
  osAutomation?: boolean
  terminal?: boolean
  webhunt?: boolean
  memory?: boolean
  services: {
    ai: { status: 'ONLINE' | 'DEGRADED' | 'OFFLINE'; provider: string; model: string }
    memory: { status: 'ONLINE' | 'OFFLINE'; engine: string; count: number }
    tools: { status: 'ONLINE' | 'OFFLINE'; count: number }
    voice: { status: 'ONLINE' | 'OFFLINE'; tts: boolean; stt: boolean; engine: string }
    vision: { status: 'ONLINE' | 'OFFLINE'; camera: boolean; screen: boolean }
    integrations: {
      github: 'CONNECTED' | 'NOT_CONFIGURED'
      vercel: 'CONNECTED' | 'NOT_CONFIGURED'
      email: 'CONNECTED' | 'NOT_CONFIGURED'
      whatsapp: 'CONNECTED' | 'NOT_CONFIGURED'
    }
    pythonAi?: { status: 'ONLINE' | 'OFFLINE' | 'DEGRADED'; service: string; version: string; capabilities: string[] }
    rustNative?: { status: 'ONLINE' | 'OFFLINE' | 'DEGRADED'; service: string; version: string; capabilities: string[] }
  }
}

