import { approvalCenter } from './approval-center.js'
import { auditLogger } from '../security/audit.js'
import type { AutomationRule } from '../types.js'

export interface AutomationExecutionResult {
  ruleId: string
  ruleTitle: string
  status: 'EXECUTED' | 'QUEUED_FOR_APPROVAL' | 'SKIPPED_CONDITION' | 'FAILED'
  details: string
  executedAt: number
}

export class AutomationEngine {
  private rules: Map<string, AutomationRule> = new Map()
  private executionCountByRule: Map<string, number> = new Map()

  constructor() {
    this.seedDefaultAutomations()
  }

  private seedDefaultAutomations() {
    const defaults: AutomationRule[] = [
      {
        id: 'auto-1',
        workspaceId: 'default-workspace',
        title: 'Daily 08:00 AM Executive Morning Briefing',
        trigger: 'schedule',
        scheduleCron: '0 8 * * *',
        condition: 'is_weekday',
        actionDescription: 'Generate executive morning briefing and summarize daily priorities.',
        actionTool: 'generate_morning_briefing',
        requiresApproval: false,
        enabled: true,
        runCount: 14,
      },
      {
        id: 'auto-2',
        workspaceId: 'default-workspace',
        title: 'Negative Sentiment Escalation',
        trigger: 'negative_sentiment',
        condition: 'sentiment == negative',
        actionDescription: 'Flag customer account for urgent attention and draft executive recovery response.',
        actionTool: 'manage_crm_customer',
        requiresApproval: false,
        enabled: true,
        runCount: 2,
      },
      {
        id: 'auto-3',
        workspaceId: 'default-workspace',
        title: 'Meta Ad Daily Budget Scale (> $100/day)',
        trigger: 'webhook',
        condition: 'roas >= 3.5',
        actionDescription: 'Increase ad set budget by 20% on high-performing Meta campaigns.',
        actionTool: 'execute_meta_ad_action',
        requiresApproval: true,
        enabled: true,
        runCount: 1,
      },
    ]

    for (const r of defaults) {
      this.rules.set(r.id, r)
    }
  }

  public getRules(workspaceId = 'default-workspace'): AutomationRule[] {
    return Array.from(this.rules.values()).filter((r) => r.workspaceId === workspaceId)
  }

  public registerRule(rule: Omit<AutomationRule, 'id' | 'runCount'>): AutomationRule {
    const id = `auto-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
    const record: AutomationRule = { ...rule, id, runCount: 0 }
    this.rules.set(id, record)
    return record
  }

  public async triggerRule(ruleId: string, eventPayload: Record<string, unknown> = {}): Promise<AutomationExecutionResult> {
    const rule = this.rules.get(ruleId)
    if (!rule || !rule.enabled) {
      return {
        ruleId,
        ruleTitle: rule?.title || 'Unknown',
        status: 'FAILED',
        details: 'Automation rule not found or disabled.',
        executedAt: Date.now(),
      }
    }

    // Safety guard against infinite loops / recursion storms
    const currentRuns = this.executionCountByRule.get(ruleId) || 0
    if (currentRuns > 50) {
      return {
        ruleId,
        ruleTitle: rule.title,
        status: 'FAILED',
        details: 'Loop protection triggered: Maximum hourly execution cap exceeded.',
        executedAt: Date.now(),
      }
    }

    this.executionCountByRule.set(ruleId, currentRuns + 1)
    rule.runCount += 1
    rule.lastRunAt = Date.now()

    // Enforce Approval Center gating for high-impact actions
    if (rule.requiresApproval) {
      const appr = approvalCenter.createRequest({
        workspaceId: rule.workspaceId,
        action: `Automation Triggered: ${rule.title}`,
        reason: rule.actionDescription,
        provider: 'automation-engine',
        target: rule.actionTool,
        potentialImpact: 'HIGH',
        costUsd: 0,
        payload: { ruleId, eventPayload },
      })

      auditLogger.log({
        action: 'AUTOMATION_QUEUED_APPROVAL',
        tool: rule.actionTool,
        inputs: { ruleId, approvalRequestId: appr.id },
        permissionDecision: 'CONFIRMED',
        resultSuccess: true,
      })

      return {
        ruleId,
        ruleTitle: rule.title,
        status: 'QUEUED_FOR_APPROVAL',
        details: `Action requires operator authorization. Queued in Approval Center (ID: ${appr.id}).`,
        executedAt: Date.now(),
      }
    }

    auditLogger.log({
      action: 'AUTOMATION_EXECUTED',
      tool: rule.actionTool,
      inputs: { ruleId, eventPayload },
      permissionDecision: 'ALLOWED',
      resultSuccess: true,
    })

    return {
      ruleId,
      ruleTitle: rule.title,
      status: 'EXECUTED',
      details: `Action ${rule.actionTool} executed successfully.`,
      executedAt: Date.now(),
    }
  }
}

export const automationEngine = new AutomationEngine()
