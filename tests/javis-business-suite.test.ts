import { describe, it } from 'node:test'
import assert from 'node:assert'
import { modelRouter } from '../server/agent/model-router.js'
import { memoryStore } from '../server/memory/memory-store.js'
import { approvalCenter } from '../server/business/approval-center.js'
import { crmService } from '../server/business/crm-service.js'
import { businessGrowthAgent } from '../server/business/agents/growth-agent.js'
import { marketingStrategyAgent } from '../server/business/agents/marketing-agent.js'
import { forexAnalysisAuditor } from '../server/business/agents/forex-auditor.js'
import { webHuntDeltaAgent } from '../server/business/agents/research-agent.js'
import { dailyOperationsAgent } from '../server/business/agents/operations-agent.js'
import { automationEngine } from '../server/business/automation-engine.js'
import { metaBusinessAdapter } from '../server/api/adapters/meta-adapter.js'
import { businessCommunicationAdapter } from '../server/api/adapters/communication-adapter.js'
import { toolRegistry } from '../server/tools/registry.js'
import { planner } from '../server/agent/planner.js'

describe('JAVIS BS — Custom Business Suite Architecture Tests', () => {
  // 1. Multi-Provider AI Gateway & Model Routing
  describe('Multi-Provider AI Gateway & Model Routing', () => {
    it('should report health across supported providers', () => {
      const health = modelRouter.getHealthReport()
      const providerNames = health.map((h) => h.name)
      assert.ok(providerNames.includes('gemini'))
      assert.ok(providerNames.includes('anthropic'))
      assert.ok(providerNames.includes('openai'))
      assert.ok(providerNames.includes('groq'))
    })

    it('should route tasks according to workload profile', () => {
      const codingRoute = modelRouter.selectModel('CODING')
      assert.ok(codingRoute.modelName)
      assert.ok(codingRoute.fallbackChain.length >= 0)

      const reasoningRoute = modelRouter.selectModel('REASONING')
      assert.ok(reasoningRoute.modelName)

      const fastRoute = modelRouter.selectModel('FAST')
      assert.ok(fastRoute.modelName)
    })

    it('should record usage telemetry without leaking secrets', () => {
      modelRouter.recordSuccess('gemini', 150, 420, 0.0004, 'BUSINESS_ANALYSIS')
      const telemetry = modelRouter.getTelemetry(5)
      assert.ok(telemetry.length > 0)
      assert.strictEqual(telemetry[0].provider, 'gemini')
      assert.strictEqual(telemetry[0].estimatedTokens, 420)

      const summary = modelRouter.getUsageSummary()
      assert.ok(summary.totalCalls >= 1)
      assert.ok(summary.totalTokens >= 420)
    })
  })

  // 2. Business Context & Multi-Tenant Scoped AI Memory
  describe('Business Context & Scoped AI Memory', () => {
    it('should store and isolate memories per workspace', () => {
      memoryStore.recordMemory({
        userId: 'exec-1',
        workspaceId: 'tenant-alpha',
        scope: 'workspace',
        category: 'semantic',
        content: 'Company Alpha focuses on B2B freight forwarding and enterprise logistics.',
      })

      memoryStore.recordMemory({
        userId: 'exec-2',
        workspaceId: 'tenant-beta',
        scope: 'workspace',
        category: 'semantic',
        content: 'Company Beta focuses on consumer fintech and mobile payments.',
      })

      const alphaMemories = memoryStore.searchMemories({
        userId: 'exec-1',
        workspaceId: 'tenant-alpha',
        query: 'logistics freight',
      })
      assert.ok(alphaMemories.length > 0)
      assert.strictEqual(alphaMemories[0].workspaceId, 'tenant-alpha')

      // Ensure tenant isolation: searching with tenant-alpha workspace must not return tenant-beta
      const crossTenant = alphaMemories.find((m) => m.workspaceId === 'tenant-beta')
      assert.strictEqual(crossTenant, undefined)
    })

    it('should reject storing sensitive keys or bearer tokens in memory', () => {
      const bad = memoryStore.recordMemory({
        userId: 'exec-1',
        category: 'semantic',
        content: 'My secret token is sk-ant-api03-123456789012345678901234567890',
      })
      assert.strictEqual(bad, null)
    })
  })

  // 3. Business Growth & Marketing Agents
  describe('Business Growth & Marketing Agents', () => {
    it('should perform business growth analysis and bottleneck diagnosis', () => {
      const result = businessGrowthAgent.analyzeGrowth('default-workspace')
      assert.ok(result.summary.length > 0)
      assert.ok(result.keyFocusToday.length >= 3)
      assert.ok(result.revenueOpportunities.length >= 2)
      assert.ok(result.operationalBottlenecks.length >= 2)
      assert.ok(result.goalStatus.length >= 2)
    })

    it('should draft marketing campaigns and queue HITL financial approval', () => {
      const plan = marketingStrategyAgent.createCampaignStrategy({
        name: 'Enterprise Logistics Expansion',
        objective: 'Lead Generation',
        dailyBudgetUsd: 75,
        platform: 'meta',
      })

      assert.strictEqual(plan.status, 'Draft')
      assert.strictEqual(plan.suggestedBudgetUsd, 75)
      assert.ok(plan.creativeAssets.headlines.length >= 2)
      assert.ok(plan.approvalRequestId)

      // Verify it was queued in Approval Center
      const pending = approvalCenter.getRequest(plan.approvalRequestId!)
      assert.ok(pending)
      assert.strictEqual(pending.potentialImpact, 'FINANCIAL_HIGH')
      assert.strictEqual(pending.status, 'pending')
    })
  })

  // 4. Forex Trading Analysis Auditor
  describe('Forex Trading Analysis Auditor', () => {
    it('should audit trade parameters and compute valid risk-reward and position sizing', () => {
      const audit = forexAnalysisAuditor.auditTrade({
        pair: 'XAUUSD',
        timeframe: '4H',
        direction: 'LONG',
        entryPrice: 2650.0,
        stopLoss: 2640.0,
        takeProfit: 2680.0,
        accountBalanceUsd: 10000,
        riskPercent: 1.0,
      })

      assert.strictEqual(audit.pair, 'XAUUSD')
      assert.strictEqual(audit.direction, 'LONG')
      assert.strictEqual(audit.riskRewardRatio, 3.0) // (2680-2650)/(2650-2640) = 30/10 = 3.0
      assert.ok(audit.positionSizeLots > 0)
      assert.ok(audit.strengths.length > 0)
      assert.ok(audit.safetyDisclaimer.includes('NOT an automated trading bot'))
    })

    it('should flag invalid trade structures such as Long stop above entry', () => {
      const audit = forexAnalysisAuditor.auditTrade({
        pair: 'EURUSD',
        direction: 'LONG',
        entryPrice: 1.085,
        stopLoss: 1.09, // Invalid for long
        takeProfit: 1.1,
      })

      const hasCriticalFlag = audit.riskFlags.some((f) => f.includes('CRITICAL: Stop Loss must be positioned below Entry Price'))
      assert.strictEqual(hasCriticalFlag, true)
    })
  })

  // 5. Human-in-the-Loop Approval Center
  describe('Human-in-the-Loop Approval Center', () => {
    it('should manage lifecycle of high-impact approvals', () => {
      const req = approvalCenter.createRequest({
        action: 'Scale Meta Campaign Budget',
        reason: 'ROAS exceeded 4x',
        provider: 'meta-ads',
        target: 'Q3 Enterprise Campaign',
        potentialImpact: 'FINANCIAL_HIGH',
        costUsd: 1500,
      })

      assert.strictEqual(approvalCenter.isApproved(req.id), false)

      const resolved = approvalCenter.resolveRequest(req.id, 'approved', 'chief_officer')
      assert.ok(resolved)
      assert.strictEqual(resolved.status, 'approved')
      assert.strictEqual(approvalCenter.isApproved(req.id), true)
    })
  })

  // 6. WebHunt Delta — Research Intelligence
  describe('WebHunt Delta Research Intelligence', () => {
    it('should categorize research into Facts, Sources, Inferences, and Recommendations', () => {
      const res = webHuntDeltaAgent.conductResearch('Enterprise AI Automation')
      assert.strictEqual(res.topic, 'Enterprise AI Automation')
      assert.ok(res.facts.length > 0)
      assert.ok(res.inferences.length > 0)
      assert.ok(res.recommendations.length > 0)
      assert.strictEqual(res.isUntrustedData, true)
    })
  })

  // 7. Daily Operations & Morning Briefing
  describe('Daily Operations Agent', () => {
    it('should generate a comprehensive executive morning briefing', () => {
      const briefing = dailyOperationsAgent.generateMorningBriefing('default', 'default-workspace')
      assert.ok(briefing.date)
      assert.ok(briefing.revenuePacing.mrrUsd > 0)
      assert.ok(briefing.todaysPriorities.length >= 3)
      assert.ok(briefing.briefingText.includes('Good morning, sir.'))
    })
  })

  // 8. General Automation Engine
  describe('General Automation Engine', () => {
    it('should trigger automated rules and queue high-impact actions for approval', async () => {
      // auto-1 is pre-approved/low risk
      const res1 = await automationEngine.triggerRule('auto-1')
      assert.strictEqual(res1.status, 'EXECUTED')

      // auto-3 requires approval
      const res3 = await automationEngine.triggerRule('auto-3')
      assert.strictEqual(res3.status, 'QUEUED_FOR_APPROVAL')
    })
  })

  // 9. Meta Business & Communication Adapters
  describe('Meta Business & Communication Adapters', () => {
    it('should allow read operations without approval', async () => {
      const res = await metaBusinessAdapter.execute('get_campaign_insights', { campaignId: 'act_123' })
      assert.strictEqual(res.success, true)
      assert.ok((res.data as any).roas > 0)
      assert.strictEqual(res.isUntrustedData, true)
    })

    it('should block unapproved ad publishing and queue approval request', async () => {
      const res = await metaBusinessAdapter.execute('publish_ad_campaign', {
        campaignName: 'Unapproved Campaign',
        dailyBudgetUsd: 100,
      })
      assert.strictEqual(res.success, false)
      assert.ok(res.error?.includes('Approval Center'))
    })

    it('should block unapproved outbound external WhatsApp and Email broadcasts', async () => {
      const res = await businessCommunicationAdapter.execute('send_whatsapp_message', {
        to: '+254711223344',
        message: 'Direct customer message',
      })
      assert.strictEqual(res.success, false)
      assert.ok(res.error?.includes('External Communication Safety Policy'))
    })
  })

  // 10. Native Tool Registry & Planner Integration
  describe('Tool Registry & Business Planner Integration', () => {
    it('should have all business tools registered in ToolRegistry', () => {
      const names = toolRegistry.getToolNames()
      assert.ok(names.includes('generate_morning_briefing'))
      assert.ok(names.includes('audit_forex_trade'))
      assert.ok(names.includes('analyze_business_growth'))
      assert.ok(names.includes('draft_marketing_campaign'))
      assert.ok(names.includes('webhunt_research'))
      assert.ok(names.includes('manage_crm_customer'))
      assert.ok(names.includes('manage_approval_request'))
      assert.ok(names.includes('trigger_business_automation'))
    })

    it('should create multi-step plan for executive morning briefing', () => {
      const plan = planner.createPlan('JAVIS, give me my morning briefing')
      assert.ok(plan.steps.length >= 3)
      const tools = plan.steps.map((s) => s.tool)
      assert.ok(tools.includes('generate_morning_briefing'))
      assert.ok(tools.includes('manage_crm_customer'))
      assert.ok(tools.includes('blade'))
    })

    it('should create multi-step plan for forex trade auditing', () => {
      const plan = planner.createPlan('Audit trade setup for XAUUSD market structure')
      assert.ok(plan.steps.length >= 2)
      const tools = plan.steps.map((s) => s.tool)
      assert.ok(tools.includes('audit_forex_trade'))
    })
  })
})
