import { planner } from './planner.js'
import { db } from '../db/index.js'
import { aiOrchestrator } from './ai-orchestrator.js'
import type { ToolContext } from '../tools/registry.js'
import type { Plan, PlanStep } from '../types.js'

export interface AskHandlers {
  onText: (delta: string) => void
  onTool: (name: string) => void
  onPlan?: (plan: Plan) => void
  onStep?: (step: PlanStep) => void
}

export class Orchestrator {
  private history: Array<{ role: 'user' | 'model'; parts: any[] }> = []
  private interrupted = false

  public interrupt() {
    this.interrupted = true
    aiOrchestrator.interrupt()
  }

  public reset(userId?: string) {
    this.history = []
    this.interrupted = false
    aiOrchestrator.reset(userId)
  }

  public async ask(
    userPrompt: string,
    handlers: AskHandlers,
    context: ToolContext = {},
  ): Promise<{ text: string; costUsd: number; error?: boolean; modelUsed?: string; providerUsed?: string }> {
    this.interrupted = false
    const onText = handlers.onText || (() => {})
    const onTool = handlers.onTool || (() => {})

    // 1. Check if user is asking to "Continue" a paused mission/task
    if (/^(continue|resume|proceed|carry on)/i.test(userPrompt.trim())) {
      const activeMission = db.getActiveMission(context.userId || 'default')
      if (activeMission && activeMission.progress < 100) {
        onText(`Resuming active mission: ${activeMission.title}, sir.`)
      }
    }

    // 2. Planning evaluation
    let activePlan: Plan | null = null
    if (planner.needsPlan(userPrompt)) {
      activePlan = planner.createPlan(userPrompt)
      handlers.onPlan?.(activePlan)
      context.sendUi?.({ type: 'plan_created', plan: activePlan })
    }

    // 3. Delegate to central AIOrchestrator with full multi-provider routing & failover
    return aiOrchestrator.ask(
      userPrompt,
      {
        onText,
        onTool,
        onPlan: handlers.onPlan,
        onStep: handlers.onStep,
      },
      context,
    )
  }
}

export const orchestrator = new Orchestrator()
