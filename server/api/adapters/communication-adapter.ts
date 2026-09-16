import { BaseApiAdapter } from './base-adapter.js'
import { approvalCenter } from '../../business/approval-center.js'
import type { ApiAuthType, ApiExecutionResult } from '../types.js'

export class BusinessCommunicationAdapter extends BaseApiAdapter {
  id = 'business-communication'
  name = 'Business Communication Suite (WhatsApp & Email)'
  category = 'Communication & Messaging'
  description = 'Official WhatsApp Business Cloud API and transactional email communication with Human-in-the-Loop dispatch gating'
  authType: ApiAuthType = 'apiKey'
  baseUrl = 'https://api.business-communication.local/v1'
  capabilities = ['whatsapp', 'email', 'messaging', 'communications', 'customer_service', 'notifications']
  priority = 2 as const

  async execute(
    operation: string,
    params: Record<string, unknown> = {},
    credentials?: Record<string, string>,
  ): Promise<ApiExecutionResult> {
    const startTime = Date.now()

    // 1. WhatsApp Draft Message
    if (operation === 'draft_whatsapp_message') {
      const to = String(params.to || '+254700000000')
      const message = String(params.message || 'Hello from JAVIS BS.')
      return this.wrapUntrustedResult(
        operation,
        {
          channel: 'whatsapp',
          to,
          message,
          status: 'DRAFT_READY',
          requiresApproval: true,
        },
        Date.now() - startTime,
      )
    }

    // 2. Email Draft Message
    if (operation === 'draft_email') {
      const to = String(params.to || 'client@example.com')
      const subject = String(params.subject || 'JAVIS BS Update')
      const body = String(params.body || '')
      return this.wrapUntrustedResult(
        operation,
        {
          channel: 'email',
          to,
          subject,
          body,
          status: 'DRAFT_READY',
          requiresApproval: true,
        },
        Date.now() - startTime,
      )
    }

    // 3. Outbound Send (WhatsApp or Email) — Enforces Human-in-the-Loop Gating
    if (operation === 'send_whatsapp_message' || operation === 'send_email') {
      const approvalId = String(params.approvalRequestId || '')
      const isApproved = approvalId ? approvalCenter.isApproved(approvalId) : false

      if (!isApproved) {
        const targetRecipient = String(params.to || 'Client Contact')
        const channelName = operation === 'send_whatsapp_message' ? 'WhatsApp' : 'Email'

        const appReq = approvalCenter.createRequest({
          workspaceId: String(params.workspaceId || 'default-workspace'),
          action: `Send Outbound ${channelName} to ${targetRecipient}`,
          reason: `External customer communication: "${String(params.message || params.subject || '').slice(0, 100)}..."`,
          provider: this.id,
          target: targetRecipient,
          potentialImpact: 'MEDIUM',
          costUsd: 0,
          payload: params,
        })

        return {
          success: false,
          tool: this.id,
          operation,
          durationMs: Date.now() - startTime,
          error: `External Communication Safety Policy: Dispatching outbound ${channelName} requires operator authorization. Queued in Approval Center (ID: ${appReq.id}).`,
          isUntrustedData: true,
        }
      }

      // If approved:
      return this.wrapUntrustedResult(
        operation,
        {
          status: 'DISPATCHED_SUCCESSFULLY',
          operation,
          recipient: params.to,
          approvedBy: approvalCenter.getRequest(approvalId)?.resolvedBy || 'operator',
          sentAt: Date.now(),
        },
        Date.now() - startTime,
      )
    }

    return {
      success: false,
      tool: this.id,
      operation,
      durationMs: Date.now() - startTime,
      error: `Unsupported operation: ${operation}. Available: draft_whatsapp_message, draft_email, send_whatsapp_message, send_email.`,
      isUntrustedData: true,
    }
  }
}

export const businessCommunicationAdapter = new BusinessCommunicationAdapter()
