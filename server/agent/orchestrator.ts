import { contextEngine } from './context-engine.js'
import { planner } from './planner.js'
import { executor } from './executor.js'
import { modelRouter } from './model-router.js'
import { toolRegistry, type ToolContext } from '../tools/registry.js'
import { memoryStore } from '../memory/memory-store.js'
import { db } from '../db/index.js'
import { RecoveryManager, recoveryManager } from './recovery.js'
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
  }

  public reset() {
    this.history = []
    this.interrupted = false
  }

  public async ask(
    userPrompt: string,
    handlers: AskHandlers,
    context: ToolContext = {},
  ): Promise<{ text: string; costUsd: number; error?: boolean }> {
    this.interrupted = false
    const onText = handlers.onText || (() => {})
    const onTool = handlers.onTool || (() => {})
    const startTime = Date.now()

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

    // 3. Compose Context & System Prompt
    const systemInstruction = contextEngine.composeSystemInstruction({
      userId: context.userId,
      prompt: userPrompt,
    })

    // 4. Model Selection
    const { modelName } = modelRouter.selectModel('GENERAL')
    const geminiClient = modelRouter.getGeminiClient()

    if (!geminiClient) {
      const errMsg = 'No AI reasoning provider configured. Please set GEMINI_API_KEY in server environment.'
      onText(errMsg)
      return { text: errMsg, costUsd: 0, error: true }
    }

    // 5. Append user prompt to conversation history
    this.history.push({
      role: 'user',
      parts: [{ text: userPrompt }],
    })
    if (this.history.length > 24) {
      this.history = this.history.slice(-16)
    }

    const declarations = toolRegistry.getDeclarations()
    const toolsConfig = declarations.length > 0 ? [{ functionDeclarations: declarations }] : undefined

    let fullAnswer = ''
    let iterations = 0

    try {
      while (iterations++ < RecoveryManager.MAX_AGENT_STEPS) {
        if (this.interrupted) break

        const chat = geminiClient.chats.create({
          model: modelName,
          config: {
            systemInstruction,
            tools: toolsConfig,
          },
          history: this.history.slice(0, -1),
        })

        const currentInput = this.history[this.history.length - 1].parts
        let responseStream: any
        let attempt = 0

        while (attempt < 2) {
          try {
            responseStream = await chat.sendMessageStream({ message: currentInput })
            break
          } catch (callErr) {
            attempt++
            const errClass = recoveryManager.classifyError(callErr)
            if (attempt >= 2 || !recoveryManager.shouldRetry(errClass, attempt)) {
              throw callErr
            }
            await recoveryManager.waitBackoff(attempt)
          }
        }

        let currentTurnText = ''
        const functionCalls: any[] = []

        for await (const chunk of responseStream) {
          if (this.interrupted) break

          if (chunk.text) {
            currentTurnText += chunk.text
            fullAnswer += chunk.text
            onText(chunk.text)
          }

          if (Array.isArray(chunk.functionCalls) && chunk.functionCalls.length > 0) {
            for (const fc of chunk.functionCalls) {
              functionCalls.push(fc)
            }
          }
        }

        // If no tool calls were requested, turn has concluded
        if (functionCalls.length === 0) {
          if (currentTurnText) {
            this.history[this.history.length - 1] = {
              role: 'user',
              parts: [{ text: userPrompt }],
            }
            this.history.push({
              role: 'model',
              parts: [{ text: currentTurnText }],
            })
          }
          break
        }

        // Execute function calls through Executor
        const responseParts: any[] = []
        for (const call of functionCalls) {
          if (this.interrupted) break
          const toolName = call.name
          const args = call.args || {}

          onTool(toolName)

          // Step tracking if a plan was active
          let currentStep: PlanStep | undefined
          if (activePlan) {
            currentStep = activePlan.steps.find((s) => s.status === 'pending')
            if (currentStep) {
              currentStep.tool = toolName
              currentStep.args = args
              handlers.onStep?.(currentStep)
            }
          }

          const execResult = await executor.executeStep(
            currentStep || {
              id: `step-${Date.now()}`,
              description: `Execute ${toolName}`,
              status: 'running',
              tool: toolName,
              args,
              dependencies: [],
            },
            context,
          )

          if (!execResult.success) {
            responseParts.push({
              functionResponse: {
                name: toolName,
                response: { error: execResult.error },
              },
            })
          } else {
            const data = (execResult.data as Record<string, any>) || { status: 'success' }
            if (data.image && data.image.inlineData) {
              responseParts.push({
                functionResponse: {
                  name: toolName,
                  response: {
                    status: 'success',
                    message: data.message || 'Image retrieved.',
                  },
                },
              })
              responseParts.push(data.image)
            } else {
              responseParts.push({
                functionResponse: {
                  name: toolName,
                  response: data,
                },
              })
            }
          }
        }

        this.history.push({
          role: 'model',
          parts: functionCalls.map((fc) => ({ functionCall: fc })),
        })
        this.history.push({
          role: 'user',
          parts: responseParts,
        })
      }

      // Record useful knowledge to episodic memory if meaningful
      if (fullAnswer.length > 20 && !fullAnswer.includes('error')) {
        memoryStore.recordMemory({
          userId: context.userId || 'default',
          category: 'episodic',
          content: `Q: ${userPrompt.slice(0, 100)} | A: ${fullAnswer.slice(0, 200)}`,
          importance: 2,
        })
      }

      modelRouter.recordSuccess('gemini', Date.now() - startTime)
      return { text: fullAnswer.trim(), costUsd: 0 }
    } catch (err) {
      modelRouter.recordFailure('gemini')
      const msg = this.formatError(err)
      onText(msg)
      return { text: msg, costUsd: 0, error: true }
    }
  }

  private formatError(err: unknown): string {
    const raw = String((err as Error)?.message ?? err)
    console.error('[GACKS Orchestrator] Turn Error:', raw)

    if (/resource_exhausted|429|quota/i.test(raw)) {
      return 'Reasoning quota reached. Waiting a moment before answering, sir.'
    }
    if (/unauthorized|401|api_key/i.test(raw)) {
      return 'AI Provider API key is invalid or missing in the server environment.'
    }
    if (/network|fetch failed|econnrefused/i.test(raw)) {
      return 'Network connection to the AI reasoning provider timed out.'
    }
    return `An issue occurred during reasoning: ${raw.slice(0, 120)}`
  }
}

export const orchestrator = new Orchestrator()
