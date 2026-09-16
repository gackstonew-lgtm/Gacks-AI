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

export type AIProviderName =
  | 'gemini'
  | 'anthropic'
  | 'openai'
  | 'groq'
  | 'mistral'
  | 'openrouter'

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
  timestamp: number
  version: string
  environment: 'development' | 'production'
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
  }
}
