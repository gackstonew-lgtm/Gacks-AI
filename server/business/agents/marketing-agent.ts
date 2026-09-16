import { approvalCenter } from '../approval-center.js'
import type { CampaignDraft } from '../../types.js'

export interface MarketingStrategyPlan {
  status: 'Strategy' | 'Draft' | 'Recommendation' | 'Scheduled Action' | 'Executed Action'
  campaignName: string
  objective: string
  targetPersona: {
    title: string
    painPoints: string[]
    coreDesires: string[]
    demographics: string
  }
  messagingAngle: string
  creativeAssets: {
    headlines: string[]
    primaryCopyOptions: string[]
    callToAction: string
  }
  suggestedBudgetUsd: number
  platform: 'meta' | 'email' | 'whatsapp' | 'social'
  abTestVariables: string[]
  approvalStatus: 'pending_approval' | 'draft' | 'approved'
  approvalRequestId?: string
}

export class MarketingStrategyAgent {
  private drafts: Map<string, CampaignDraft> = new Map()

  public createCampaignStrategy({
    workspaceId = 'default-workspace',
    name,
    objective,
    dailyBudgetUsd,
    platform = 'meta',
  }: {
    workspaceId?: string
    name: string
    objective: string
    dailyBudgetUsd: number
    platform?: 'meta' | 'email' | 'whatsapp' | 'social'
  }): MarketingStrategyPlan {
    const draftId = `camp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

    const headlines = [
      'Stop Managing Operations in Spreadsheets. Deploy JAVIS BS.',
      'The AI Operating System Built for High-Performance Business Owners.',
      'Automate Customer Inquiries, Reports & Growth Analysis Overnight.',
    ]

    const copyOptions = [
      'Struggling to track customer follow-ups, financial leaks, and daily operations? JAVIS Custom Business Suite consolidates your intelligence, CRM, and automation into one secure command center.',
      'Empower your company with a 24/7 AI operator. From real-time revenue audits to automated WhatsApp customer support, JAVIS keeps you ahead.',
    ]

    const draftRecord: CampaignDraft = {
      id: draftId,
      workspaceId,
      platform,
      name,
      objective,
      targetAudience: 'SME Founders, Managing Directors, Operations Managers, Tech Entrepreneurs (Ages 28-55)',
      copyHeadline: headlines[0],
      copyBody: copyOptions[0],
      dailyBudgetUsd,
      status: 'pending_approval',
      createdAt: Date.now(),
    }

    this.drafts.set(draftId, draftRecord)

    // Financial action requires Human-in-the-Loop Approval Center request
    const approvalReq = approvalCenter.createRequest({
      workspaceId,
      action: `Publish ${platform.toUpperCase()} Ad Campaign: ${name}`,
      reason: `Launch paid marketing campaign targeting ${draftRecord.targetAudience} with $${dailyBudgetUsd}/day budget.`,
      provider: platform === 'meta' ? 'meta-ads' : 'marketing-agent',
      target: name,
      potentialImpact: 'FINANCIAL_HIGH',
      costUsd: dailyBudgetUsd * 30, // 30-day projection
      payload: {
        draftId,
        campaignName: name,
        dailyBudgetUsd,
        headline: headlines[0],
        platform,
      },
    })

    return {
      status: 'Draft',
      campaignName: name,
      objective,
      targetPersona: {
        title: 'High-Growth Business Operator',
        painPoints: ['Fragmented tools', 'Delayed customer follow-ups', 'Lack of real-time profitability visibility'],
        coreDesires: ['Automated business reporting', 'Consolidated CRM & communications', 'Auditable AI control'],
        demographics: 'Business owners, founders, and executives managing 5-100 staff.',
      },
      messagingAngle: 'Executive efficiency and operational sovereignty through custom AI orchestration.',
      creativeAssets: {
        headlines,
        primaryCopyOptions: copyOptions,
        callToAction: 'Book Private Demonstration',
      },
      suggestedBudgetUsd: dailyBudgetUsd,
      platform,
      abTestVariables: ['Headline Angle (Pain vs Aspiration)', 'Video Hook vs Static Visual', 'Landing Page Call to Action'],
      approvalStatus: 'pending_approval',
      approvalRequestId: approvalReq.id,
    }
  }

  public getDrafts(workspaceId = 'default-workspace'): CampaignDraft[] {
    return Array.from(this.drafts.values()).filter((d) => d.workspaceId === workspaceId)
  }
}

export const marketingStrategyAgent = new MarketingStrategyAgent()
