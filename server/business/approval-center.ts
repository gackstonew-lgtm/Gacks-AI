import { auditLogger } from '../security/audit.js'
import type { ApprovalRequest } from '../types.js'

export class ApprovalCenter {
  private requests: Map<string, ApprovalRequest> = new Map()

  public createRequest({
    workspaceId = 'default-workspace',
    action,
    reason,
    provider,
    target,
    potentialImpact,
    costUsd = 0,
    payload = {},
  }: {
    workspaceId?: string
    action: string
    reason: string
    provider: string
    target: string
    potentialImpact: 'LOW' | 'MEDIUM' | 'HIGH' | 'FINANCIAL_HIGH'
    costUsd?: number
    payload?: Record<string, unknown>
  }): ApprovalRequest {
    const id = `appr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const request: ApprovalRequest = {
      id,
      workspaceId,
      action,
      reason,
      provider,
      target,
      potentialImpact,
      costUsd,
      status: 'pending',
      payload,
      createdAt: Date.now(),
    }

    this.requests.set(id, request)

    auditLogger.log({
      action: 'APPROVAL_REQUESTED',
      tool: provider,
      inputs: { requestId: id, action, target, costUsd, potentialImpact },
      permissionDecision: 'CONFIRMED',
      resultSuccess: true,
    })

    return request
  }

  public getPending(workspaceId?: string): ApprovalRequest[] {
    const all = Array.from(this.requests.values())
    return all.filter((r) => r.status === 'pending' && (!workspaceId || r.workspaceId === workspaceId))
  }

  public getRequest(id: string): ApprovalRequest | undefined {
    return this.requests.get(id)
  }

  public resolveRequest(
    id: string,
    decision: 'approved' | 'rejected' | 'edited',
    resolvedBy = 'operator',
    editedPayload?: Record<string, unknown>,
  ): ApprovalRequest | null {
    const req = this.requests.get(id)
    if (!req) return null

    req.status = decision
    req.resolvedAt = Date.now()
    req.resolvedBy = resolvedBy
    if (editedPayload && decision === 'edited') {
      req.payload = { ...req.payload, ...editedPayload }
    }

    auditLogger.log({
      action: `APPROVAL_${decision.toUpperCase()}`,
      tool: req.provider,
      inputs: { requestId: id, action: req.action, resolvedBy },
      permissionDecision: decision === 'approved' || decision === 'edited' ? 'ALLOWED' : 'DENIED',
      resultSuccess: decision !== 'rejected',
    })

    return req
  }

  public isApproved(id: string): boolean {
    const req = this.requests.get(id)
    return req?.status === 'approved' || req?.status === 'edited'
  }
}

export const approvalCenter = new ApprovalCenter()
