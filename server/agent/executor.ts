import { toolRegistry, type ToolContext } from '../tools/registry.js'
import { verifier } from './verifier.js'
import { RecoveryManager, recoveryManager } from './recovery.js'
import type { PlanStep, ToolResult } from '../types.js'

export class Executor {
  /**
   * Execute an individual plan step with bounded retries and verification.
   */
  public async executeStep(step: PlanStep, context: ToolContext = {}): Promise<ToolResult> {
    step.status = 'running'

    if (!step.tool) {
      step.status = 'completed'
      step.verificationStatus = 'verified_success'
      return {
        success: true,
        tool: 'internal_reasoning',
        durationMs: 0,
        verification: { status: 'verified_success' },
      }
    }

    let attempts = 0
    let lastResult: ToolResult | null = null

    while (attempts <= RecoveryManager.MAX_TOOL_RETRIES) {
      attempts++
      lastResult = await toolRegistry.executeTool(step.tool, step.args || {}, context)

      if (lastResult.success) {
        // Run verification check
        const v = verifier.verifyToolExecution(step.tool, (lastResult.data as Record<string, unknown>) || {})
        lastResult.verification = { status: v.status, details: v.details }
        step.status = v.status === 'failure' ? 'failed' : 'completed'
        step.verificationStatus = v.status
        step.verificationDetails = v.details
        step.result = lastResult
        return lastResult
      }

      // Check if recoverable
      const errorClass = recoveryManager.classifyError(lastResult.error)
      if (!recoveryManager.shouldRetry(errorClass, attempts)) {
        break
      }
      await recoveryManager.waitBackoff(attempts)
    }

    step.status = 'failed'
    step.verificationStatus = 'failure'
    step.verificationDetails = lastResult?.error || 'Execution failed.'
    step.result = lastResult

    return (
      lastResult || {
        success: false,
        tool: step.tool,
        durationMs: 0,
        error: 'Execution failed after retries.',
      }
    )
  }
}

export const executor = new Executor()
