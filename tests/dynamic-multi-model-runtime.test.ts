import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import { aiOrchestrator } from '../server/agent/ai-orchestrator.js'
import { modelRegistry } from '../server/agent/model-registry.js'
import { modelRouter } from '../server/agent/model-router.js'

describe('Dynamic Multi-Model AI Provider, Agent & Runtime Switching Tests', () => {
  const testUserId = 'test-user-runtime-switching'

  beforeEach(() => {
    aiOrchestrator.reset(testUserId)
    aiOrchestrator.setPreferences(testUserId, {
      routingMode: 'AUTO',
      preferredModelId: undefined,
      privacyPolicy: 'CLOUD_ALLOWED',
      allowCloudFallback: true,
      preferLocalWhenAvailable: false,
    })
  })

  // 1. Provider Detection & Model Catalog
  describe('Provider Detection & Registry', () => {
    it('should detect configured cloud and local providers', () => {
      const health = modelRouter.getHealthReport()
      assert.ok(Array.isArray(health))
      const providers = health.map((h) => h.name)
      assert.ok(providers.includes('anthropic'))
      assert.ok(providers.includes('openai'))
      assert.ok(providers.includes('gemini'))
      assert.ok(providers.includes('openrouter'))
    })

    it('should have a diverse catalog of models registered across multiple providers', () => {
      const models = modelRegistry.getAll()
      const anthropicModels = models.filter((m) => m.provider === 'anthropic')
      const openAiModels = models.filter((m) => m.provider === 'openai')
      const geminiModels = models.filter((m) => m.provider === 'gemini')
      const openRouterModels = models.filter((m) => m.provider === 'openrouter')

      assert.ok(anthropicModels.length > 0, 'Must have Anthropic models')
      assert.ok(openAiModels.length > 0, 'Must have OpenAI models')
      assert.ok(geminiModels.length > 0, 'Must have Gemini models')
      assert.ok(openRouterModels.length > 0, 'Must have OpenRouter models')
    })
  })

  // 2. Neutral Dynamic Routing & No Hardcoded Gemini Default
  describe('Neutral Routing & Dynamic Selection', () => {
    it('should route task to optimal model based on profile rather than hardcoded Gemini', async () => {
      // Coding task should route to Claude, GPT-4o, or high-tier coding engine
      const codingRoute = await aiOrchestrator.route({ profile: 'CODING' }, testUserId)
      assert.ok(
        ['anthropic', 'openai', 'openrouter', 'litellm'].includes(codingRoute.selectedModel.provider),
        `Expected Anthropic, OpenAI, OpenRouter, or LiteLLM for CODING, got: ${codingRoute.selectedModel.provider}`,
      )

      // Reasoning task should route to high reasoning model
      const reasoningRoute = await aiOrchestrator.route({ profile: 'REASONING' }, testUserId)
      assert.ok(
        ['anthropic', 'openai', 'openrouter', 'gemini', 'litellm'].includes(reasoningRoute.selectedModel.provider),
      )
    })

    it('should strictly honor user-pinned model selection across all tasks', async () => {
      // Pin to Anthropic Claude
      aiOrchestrator.setPreferences(testUserId, { preferredModelId: 'claude-3-5-sonnet' })
      const route1 = await aiOrchestrator.route({ profile: 'GENERAL' }, testUserId)
      assert.strictEqual(route1.selectedModel.id, 'claude-3-5-sonnet')
      assert.strictEqual(route1.selectedModel.provider, 'anthropic')

      // Switch pin to OpenAI GPT-4o
      aiOrchestrator.setPreferences(testUserId, { preferredModelId: 'gpt-4o' })
      const route2 = await aiOrchestrator.route({ profile: 'GENERAL' }, testUserId)
      assert.strictEqual(route2.selectedModel.id, 'gpt-4o')
      assert.strictEqual(route2.selectedModel.provider, 'openai')

      // Switch pin to Gemini
      aiOrchestrator.setPreferences(testUserId, { preferredModelId: 'gemini-2.5-flash' })
      const route3 = await aiOrchestrator.route({ profile: 'GENERAL' }, testUserId)
      assert.strictEqual(route3.selectedModel.id, 'gemini-2.5-flash')
      assert.strictEqual(route3.selectedModel.provider, 'gemini')
    })
  })

  // 3. Natural Language Model Switching Commands
  describe('Natural Language Model Switching', () => {
    it('should switch to Claude via natural language command', async () => {
      let textOut = ''
      const result = await aiOrchestrator.ask(
        'Switch to Claude',
        {
          onText: (t) => {
            textOut += t
          },
          onTool: () => {},
        },
        { userId: testUserId },
      )

      assert.ok(textOut.includes('Anthropic Claude') || textOut.includes('Claude'))
      const prefs = aiOrchestrator.getPreferences(testUserId)
      assert.ok(prefs.preferredModelId?.includes('claude'))
    })

    it('should switch to OpenAI via natural language command', async () => {
      let textOut = ''
      const result = await aiOrchestrator.ask(
        'Use OpenAI',
        {
          onText: (t) => {
            textOut += t
          },
          onTool: () => {},
        },
        { userId: testUserId },
      )

      assert.ok(textOut.includes('OpenAI') || textOut.includes('GPT-4o'))
      const prefs = aiOrchestrator.getPreferences(testUserId)
      assert.ok(prefs.preferredModelId?.includes('gpt'))
    })

    it('should report active model status truthfully via "What model are you using?"', async () => {
      aiOrchestrator.setPreferences(testUserId, { preferredModelId: 'gpt-4o' })
      let textOut = ''
      const result = await aiOrchestrator.ask(
        'What model are you using?',
        {
          onText: (t) => {
            textOut += t
          },
          onTool: () => {},
        },
        { userId: testUserId },
      )

      assert.ok(textOut.includes('GPT-4o') || textOut.includes('OPENAI'))
      assert.ok(textOut.includes('Routing Mode'))
      assert.ok(textOut.includes('Context Window'))
    })

    it('should list configured models via "Show available models"', async () => {
      let textOut = ''
      const result = await aiOrchestrator.ask(
        'Show available models',
        {
          onText: (t) => {
            textOut += t
          },
          onTool: () => {},
        },
        { userId: testUserId },
      )

      assert.ok(textOut.includes('Configured AI Reasoning Engines'))
      assert.ok(textOut.includes('ANTHROPIC') || textOut.includes('OPENAI') || textOut.includes('GEMINI'))
    })
  })

  // 4. Session & Routing Persistence
  describe('User Preference Isolation', () => {
    it('should maintain user-specific preferences isolated from other users', () => {
      const userA = 'user-alpha'
      const userB = 'user-beta'

      aiOrchestrator.setPreferences(userA, { preferredModelId: 'claude-3-5-sonnet-20241022' })
      aiOrchestrator.setPreferences(userB, { preferredModelId: 'gpt-4o' })

      const prefsA = aiOrchestrator.getPreferences(userA)
      const prefsB = aiOrchestrator.getPreferences(userB)

      assert.strictEqual(prefsA.preferredModelId, 'claude-3-5-sonnet-20241022')
      assert.strictEqual(prefsB.preferredModelId, 'gpt-4o')
    })
  })
})
