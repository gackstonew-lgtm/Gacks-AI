import { GoogleGenAI } from '@google/genai'

/**
 * Base AI Provider abstraction.
 * Enables GACKS P.A to swap or add reasoning backends (Gemini, Ollama, Groq)
 * without touching UI or voice layers.
 */
export class AIProvider {
  constructor(name) {
    this.name = name
  }

  async ask(prompt, handlers) {
    throw new Error('ask() not implemented')
  }

  interrupt() {}

  close() {}
}

/**
 * Google Gemini Provider for GACKS P.A.
 * Uses official @google/genai SDK with streaming, multi-turn context,
 * tool calling, vision analysis, and free-tier quota management.
 */
export class GeminiProvider extends AIProvider {
  constructor({
    apiKey,
    model = 'gemini-3.6-flash',
    systemInstruction,
    toolRegistry,
    decideTool,
  }) {
    super('gemini')
    this.apiKey = apiKey
    this.model = model || 'gemini-3.6-flash'
    this.systemInstruction = systemInstruction
    this.toolRegistry = toolRegistry
    this.decideTool = decideTool || (() => true)

    if (!this.apiKey) {
      this.client = null
    } else {
      this.client = new GoogleGenAI({ apiKey: this.apiKey })
    }

    // Keep session history bounded to last 16 turns
    this.history = []
    this.interrupted = false
  }

  isConfigured() {
    return Boolean(this.apiKey && this.client)
  }

  interrupt() {
    this.interrupted = true
  }

  close() {
    this.history = []
  }

  /**
   * Run one conversational turn with streaming and tool execution loop.
   */
  async ask(userPrompt, handlers = {}) {
    this.interrupted = false
    const onText = handlers.onText || (() => {})
    const onTool = handlers.onTool || (() => {})

    if (!this.isConfigured()) {
      const err =
        'Google Gemini API key is not configured. Please set GEMINI_API_KEY in your GACKS P.A .env file.'
      onText(err)
      return { text: err, costUsd: 0 }
    }

    // Add user message to local history
    this.history.push({
      role: 'user',
      parts: [{ text: userPrompt }],
    })
    if (this.history.length > 20) {
      this.history = this.history.slice(-16)
    }

    const declarations = this.toolRegistry ? this.toolRegistry.getDeclarations() : []
    const toolsConfig = declarations.length > 0 ? [{ functionDeclarations: declarations }] : undefined

    let fullAnswer = ''
    let iterations = 0
    const MAX_TOOL_ITERATIONS = 6

    try {
      // Tool loop: continues as long as Gemini emits function calls
      while (iterations++ < MAX_TOOL_ITERATIONS) {
        if (this.interrupted) break

        const chat = this.client.chats.create({
          model: this.model,
          config: {
            systemInstruction: this.systemInstruction,
            tools: toolsConfig,
          },
          history: this.history.slice(0, -1), // prior turns
        })

        // Send current user prompt (or latest tool response)
        const currentInput = this.history[this.history.length - 1].parts
        let responseStream
        try {
          responseStream = await chat.sendMessageStream({ message: currentInput })
        } catch (callErr) {
          const errMsg = String(callErr?.message ?? callErr)
          if (/503|high demand|overloaded|unavailable/i.test(errMsg)) {
            await new Promise((r) => setTimeout(r, 1200))
            responseStream = await chat.sendMessageStream({ message: currentInput })
          } else {
            throw callErr
          }
        }

        let currentTurnText = ''
        const functionCalls = []

        for await (const chunk of responseStream) {
          if (this.interrupted) break

          // Stream text delta to frontend
          if (chunk.text) {
            currentTurnText += chunk.text
            fullAnswer += chunk.text
            onText(chunk.text)
          }

          // Check for function calls
          if (Array.isArray(chunk.functionCalls) && chunk.functionCalls.length > 0) {
            for (const fc of chunk.functionCalls) {
              functionCalls.push(fc)
            }
          }
        }

        // If no tool was requested, we are done
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

        // Gemini requested one or more tool calls
        const responseParts = []
        for (const call of functionCalls) {
          if (this.interrupted) break
          const toolName = call.name
          const args = call.args || {}

          onTool(toolName)

          // Security & permission check
          const allowed = this.decideTool(toolName)
          if (!allowed) {
            responseParts.push({
              functionResponse: {
                name: toolName,
                response: {
                  error:
                    'Blocked: GACKS P.A is in read-only mode. Inform the user this action requires write permission.',
                },
              },
            })
            continue
          }

          try {
            const toolResult = await this.toolRegistry.executeTool(toolName, args)

            // If the tool produced an image (e.g. screen capture or camera), attach inlineData
            if (toolResult && toolResult.image && toolResult.image.inlineData) {
              responseParts.push({
                functionResponse: {
                  name: toolName,
                  response: {
                    status: 'success',
                    message: toolResult.message || 'Image captured successfully.',
                  },
                },
              })
              responseParts.push(toolResult.image)
            } else {
              responseParts.push({
                functionResponse: {
                  name: toolName,
                  response: toolResult || { status: 'success' },
                },
              })
            }
          } catch (err) {
            responseParts.push({
              functionResponse: {
                name: toolName,
                response: { error: `Tool execution error: ${err.message}` },
              },
            })
          }
        }

        // Update history with model's tool calls and our function responses
        this.history.push({
          role: 'model',
          parts: functionCalls.map((fc) => ({ functionCall: fc })),
        })
        this.history.push({
          role: 'user',
          parts: responseParts,
        })
      }

      return { text: fullAnswer.trim(), costUsd: 0 }
    } catch (err) {
      const msg = this.translateError(err)
      onText(msg)
      return { text: msg, costUsd: 0, error: true }
    }
  }

  translateError(err) {
    const raw = String(err?.message ?? err)
    console.error('[GACKS P.A] Gemini turn error:', raw)

    if (/resource_exhausted|429|quota/i.test(raw)) {
      return 'Gemini free-tier quota has been reached. Please wait a moment before asking again, sir.'
    }
    if (/api_key_invalid|invalid_api_key|unauthorized|401/i.test(raw)) {
      return 'Google Gemini API key is missing or invalid. Please check GEMINI_API_KEY in your .env file.'
    }
    if (/not_found|model.*not.*found/i.test(raw)) {
      return `The configured Gemini model (${this.model}) is unavailable. Please check GEMINI_MODEL in .env.`
    }
    if (/503|high demand|overloaded|unavailable/i.test(raw)) {
      return 'The Gemini service is temporarily experiencing high demand. Please try again in a moment, sir.'
    }
    if (/network|fetch failed|econnrefused/i.test(raw)) {
      return 'Could not reach the Google Gemini API. Please check your internet connection.'
    }
    return `Gemini encountered an issue: ${raw.slice(0, 120)}`
  }
}
