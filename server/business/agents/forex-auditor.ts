import type { ForexAuditReport } from '../../types.js'

export interface TradeAuditInput {
  pair: string
  timeframe?: string
  direction: 'LONG' | 'SHORT'
  entryPrice: number
  stopLoss: number
  takeProfit: number
  accountBalanceUsd?: number
  riskPercent?: number
  marketContext?: string
}

export class ForexAnalysisAuditor {
  public auditTrade(input: TradeAuditInput): ForexAuditReport {
    const {
      pair,
      timeframe = '4H',
      direction,
      entryPrice,
      stopLoss,
      takeProfit,
      accountBalanceUsd = 10000,
      riskPercent = 1.0,
      marketContext = 'Key structural liquidity sweep with momentum confirmation',
    } = input

    // 1. Core Mathematical Risk & Reward Calculations
    const riskPipsOrDistance = Math.abs(entryPrice - stopLoss)
    const rewardDistance = Math.abs(takeProfit - entryPrice)

    const riskRewardRatio = riskPipsOrDistance > 0 ? Number((rewardDistance / riskPipsOrDistance).toFixed(2)) : 0

    // Position sizing calculation based on account balance & risk %
    const maxRiskCapital = (accountBalanceUsd * riskPercent) / 100
    // Standard lot estimation (assumes $10 per pip for 1.0 lot on major pairs / gold adjustments)
    const isGold = pair.toUpperCase().includes('XAU') || pair.toUpperCase().includes('GOLD')
    const pointValue = isGold ? 100 : 10
    const estimatedLots = riskPipsOrDistance > 0
      ? Number((maxRiskCapital / (riskPipsOrDistance * pointValue)).toFixed(2))
      : 0.1

    // 2. Structural & Safety Rule Validations
    const strengths: string[] = []
    const riskFlags: string[] = []

    // Check invalidation alignment
    if (direction === 'LONG' && stopLoss >= entryPrice) {
      riskFlags.push('CRITICAL: Stop Loss must be positioned below Entry Price for Long positions.')
    } else if (direction === 'SHORT' && stopLoss <= entryPrice) {
      riskFlags.push('CRITICAL: Stop Loss must be positioned above Entry Price for Short positions.')
    } else {
      strengths.push('Stop Loss location aligns logically with trade direction bias.')
    }

    if (direction === 'LONG' && takeProfit <= entryPrice) {
      riskFlags.push('CRITICAL: Take Profit must be above Entry Price for Long positions.')
    } else if (direction === 'SHORT' && takeProfit >= entryPrice) {
      riskFlags.push('CRITICAL: Take Profit must be below Entry Price for Short positions.')
    }

    // Risk / Reward evaluation
    if (riskRewardRatio >= 2.0) {
      strengths.push(`Favorable Risk-to-Reward ratio of 1:${riskRewardRatio} (exceeds 1:2 minimum threshold).`)
    } else if (riskRewardRatio >= 1.5) {
      strengths.push(`Acceptable Risk-to-Reward ratio of 1:${riskRewardRatio}.`)
    } else {
      riskFlags.push(`Sub-optimal Risk-to-Reward ratio of 1:${riskRewardRatio} (industry standard advises >= 1:2).`)
    }

    // Risk percentage guard
    if (riskPercent > 2.0) {
      riskFlags.push(`High risk allocation (${riskPercent}% of account). Recommend capping single trade exposure <= 2.0%.`)
    } else {
      strengths.push(`Conservative risk allocation (${riskPercent}% of capital = $${maxRiskCapital.toFixed(2)}).`)
    }

    const invalidationLevel = stopLoss

    return {
      id: `forex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      pair: pair.toUpperCase(),
      timeframe,
      direction,
      entryPrice,
      stopLoss,
      takeProfit,
      riskPercent,
      riskRewardRatio,
      positionSizeLots: Math.max(0.01, estimatedLots),
      marketContext,
      strengths,
      riskFlags,
      invalidationLevel,
      safetyDisclaimer:
        'DISCLAIMER: JAVIS Forex Auditor operates strictly as an analytical decision-support tool, NOT an automated trading bot or financial advisor. All market projections carry risk of loss. Past market structure does not guarantee future results. Autonomous trading execution is disabled by default.',
      auditedAt: Date.now(),
    }
  }
}

export const forexAnalysisAuditor = new ForexAnalysisAuditor()
