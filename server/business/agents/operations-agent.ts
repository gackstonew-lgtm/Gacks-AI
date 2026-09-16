import { crmService } from '../crm-service.js'
import { approvalCenter } from '../approval-center.js'
import { db } from '../../db/index.js'

export interface MorningBriefing {
  executiveGreeting: string
  date: string
  revenuePacing: {
    mrrUsd: number
    targetUsd: number
    pacingPercent: number
  }
  urgentCustomerAlerts: Array<{ customerName: string; issue: string; ltvUsd: number }>
  pendingExecutiveApprovals: Array<{ id: string; action: string; impact: string; costUsd?: number }>
  overdueTasks: Array<{ id: string; text: string }>
  todaysPriorities: string[]
  marketSummary: string
  briefingText: string
  generatedAt: number
}

export class DailyOperationsAgent {
  public generateMorningBriefing(userId = 'default', workspaceId = 'default-workspace'): MorningBriefing {
    const now = new Date()
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })

    const urgentCustomers = crmService.getUrgentAttentionList(workspaceId)
    const pendingApprovals = approvalCenter.getPending(workspaceId)
    const allTasks = db.getTasks(userId)
    const pendingTasks = allTasks.filter((t) => !t.completed)

    const urgentCustomerAlerts = urgentCustomers.map((c) => ({
      customerName: c.name,
      issue: c.notes[c.notes.length - 1] || 'Customer inquiry pending immediate attention',
      ltvUsd: c.ltvUsd,
    }))

    const pendingExecutiveApprovals = pendingApprovals.map((a) => ({
      id: a.id,
      action: a.action,
      impact: a.potentialImpact,
      costUsd: a.costUsd,
    }))

    const todaysPriorities = [
      urgentCustomerAlerts.length > 0
        ? `Resolve urgent inquiries for ${urgentCustomerAlerts[0].customerName} (LTV: $${urgentCustomerAlerts[0].ltvUsd}).`
        : 'Review enterprise inbound proposals.',
      pendingApprovals.length > 0
        ? `Review ${pendingApprovals.length} pending action approval(s) in the Approval Center.`
        : 'Audit Meta ad campaign performance and ROAS.',
      'Execute mid-day Forex market structure audit on XAUUSD & EURUSD.',
    ]

    const briefingText = [
      `Good morning, sir. Here is your JAVIS Executive Briefing for ${dateStr}.`,
      `Financial pacing stands at $34,500 MRR (69% towards quarterly target).`,
      urgentCustomerAlerts.length > 0
        ? `You have ${urgentCustomerAlerts.length} client account(s) requiring immediate attention, specifically ${urgentCustomerAlerts[0].customerName}.`
        : 'All key customer relationships are healthy.',
      pendingApprovals.length > 0
        ? `${pendingApprovals.length} high-impact action(s) are queued in your Approval Center awaiting authorization.`
        : 'Zero pending operational approval bottlenecks.',
      `You have ${pendingTasks.length} active operational task(s) on your agenda today.`,
    ].join(' ')

    return {
      executiveGreeting: `Executive Briefing · ${dateStr}`,
      date: dateStr,
      revenuePacing: {
        mrrUsd: 34500,
        targetUsd: 50000,
        pacingPercent: 69.0,
      },
      urgentCustomerAlerts,
      pendingExecutiveApprovals,
      overdueTasks: pendingTasks.slice(0, 3).map((t) => ({ id: t.id, text: t.text })),
      todaysPriorities,
      marketSummary: 'Gold (XAUUSD) testing structural resistance near key liquidity pools; DXY showing mild exhaustion.',
      briefingText,
      generatedAt: Date.now(),
    }
  }
}

export const dailyOperationsAgent = new DailyOperationsAgent()
