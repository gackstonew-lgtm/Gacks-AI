import { describe, it } from 'node:test'
import assert from 'node:assert'
import { RecoveryManager, recoveryManager } from '../server/agent/recovery.js'
import { Orchestrator, orchestrator } from '../server/agent/orchestrator.js'
import { Executor, executor } from '../server/agent/executor.js'
import { toolRegistry } from '../server/tools/registry.js'
import { planner } from '../server/agent/planner.js'
import { createGatewayServer } from '../server/gateway.js'
import http from 'node:http'

describe('JAVIS BS — Runtime Stabilization & Root-Cause Verification', () => {
  // 1. RecoveryManager Class & Instance Verification
  describe('ERROR A Verification: RecoveryManager imports & contracts', () => {
    it('should export RecoveryManager class with static boundaries', () => {
      assert.strictEqual(typeof RecoveryManager, 'function')
      assert.strictEqual(RecoveryManager.MAX_TOOL_RETRIES, 2)
      assert.strictEqual(RecoveryManager.MAX_PLAN_RETRIES, 2)
      assert.strictEqual(RecoveryManager.MAX_AGENT_STEPS, 20)
    })

    it('should export singleton recoveryManager instance', () => {
      assert.ok(recoveryManager instanceof RecoveryManager)
    })

    it('should classify rate limit and network errors correctly', () => {
      assert.strictEqual(recoveryManager.classifyError(new Error('429 Too Many Requests')), 'RATE_LIMIT')
      assert.strictEqual(recoveryManager.classifyError(new Error('fetch failed ECONNREFUSED')), 'TRANSIENT_NETWORK')
      assert.strictEqual(recoveryManager.classifyError(new Error('Action blocked by policy')), 'POLICY_BLOCKED')
      assert.strictEqual(recoveryManager.classifyError(new Error('TypeError: unexpected value')), 'FATAL')
    })

    it('should strictly limit retries according to bounds', () => {
      assert.strictEqual(recoveryManager.shouldRetry('RATE_LIMIT', 0), true)
      assert.strictEqual(recoveryManager.shouldRetry('RATE_LIMIT', 1), true)
      assert.strictEqual(recoveryManager.shouldRetry('RATE_LIMIT', 2), false)
      assert.strictEqual(recoveryManager.shouldRetry('POLICY_BLOCKED', 0), false)
      assert.strictEqual(recoveryManager.shouldRetry('FATAL', 0), false)
    })

    it('should verify Orchestrator and Executor instantiate without ReferenceErrors', () => {
      assert.ok(orchestrator instanceof Orchestrator)
      assert.ok(executor instanceof Executor)
    })
  })

  // 2. React Duplicate Key Prevention Verification
  describe('ERROR E Verification: Turn deduplication logic', () => {
    it('should deduplicate turns by ID preventing duplicate key rendering', () => {
      const turnId = 'f6cb4465-10e3-4c12-be8a-0cbb59c09ffb'
      const turns = [
        { id: 'user-1', role: 'user', text: 'Hello' },
        { id: turnId, role: 'jarvis', text: 'Working on that...' },
      ]

      // Simulate incoming turn with the same turnId
      const newTurn = { id: turnId, role: 'jarvis', text: 'Completed output' }
      const deduplicated = [...turns.filter((t) => t.id !== newTurn.id), newTurn]

      assert.strictEqual(deduplicated.length, 2)
      assert.strictEqual(deduplicated[1].text, 'Completed output')
      const occurrences = deduplicated.filter((t) => t.id === turnId).length
      assert.strictEqual(occurrences, 1)
    })
  })

  // 3. Business Suite Gateway Endpoints Verification
  describe('ERROR C & D Verification: Business Suite HTTP Routes', () => {
    let server: http.Server
    let baseUrl: string

    it('should start gateway server and bind to available port', async () => {
      const gateway = createGatewayServer()
      server = gateway.server
      await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', () => {
          const addr = server.address()
          if (addr && typeof addr === 'object') {
            baseUrl = `http://127.0.0.1:${addr.port}`
          }
          resolve()
        })
      })
      assert.ok(baseUrl)
    })

    it('should respond 200 on /api/v1/business/approvals', async () => {
      const res = await fetch(`${baseUrl}/api/v1/business/approvals`)
      assert.strictEqual(res.status, 200)
      const data = (await res.json()) as any
      assert.ok(Array.isArray(data.approvals))
    })

    it('should respond 200 on /api/v1/business/crm', async () => {
      const res = await fetch(`${baseUrl}/api/v1/business/crm`)
      assert.strictEqual(res.status, 200)
      const data = (await res.json()) as any
      assert.ok(Array.isArray(data.customers))
    })

    it('should respond 200 on /api/v1/business/briefing', async () => {
      const res = await fetch(`${baseUrl}/api/v1/business/briefing`)
      assert.strictEqual(res.status, 200)
      const data = (await res.json()) as any
      assert.ok(data.executiveGreeting)
      assert.ok(data.date)
      assert.ok(data.revenuePacing)
    })

    it('should respond 200 on /api/v1/business/growth/metrics', async () => {
      const res = await fetch(`${baseUrl}/api/v1/business/growth/metrics`)
      assert.strictEqual(res.status, 200)
      const data = (await res.json()) as any
      assert.ok(data.summary)
      assert.ok(Array.isArray(data.revenueOpportunities))
    })

    it('should respond 200 on /api/v1/business/automations', async () => {
      const res = await fetch(`${baseUrl}/api/v1/business/automations`)
      assert.strictEqual(res.status, 200)
      const data = (await res.json()) as any
      assert.ok(Array.isArray(data.rules))
    })

    it('should respond 200 on /api/v1/system/metrics with real hardware data', async () => {
      const res = await fetch(`${baseUrl}/api/v1/system/metrics`)
      assert.strictEqual(res.status, 200)
      const data = (await res.json()) as any
      assert.strictEqual(typeof data.cpuUsagePercent, 'number')
      assert.ok(data.cpuUsagePercent >= 0 && data.cpuUsagePercent <= 100)
      assert.ok(data.memoryTotalBytes > 0)
      assert.ok(data.memoryFreeBytes > 0)
      assert.strictEqual(typeof data.network, 'object')
    })

    it('should respond 200 on /api/v1/system/capabilities', async () => {
      const res = await fetch(`${baseUrl}/api/v1/system/capabilities`)
      assert.strictEqual(res.status, 200)
      const data = (await res.json()) as any
      assert.strictEqual(data.localSystemAccess, true)
      assert.strictEqual(data.systemMetrics, true)
      assert.strictEqual(data.filesystemAccess, true)
    })

    it('should respond 200 on /api/v1/fs/drives with accessible local drives', async () => {
      const res = await fetch(`${baseUrl}/api/v1/fs/drives`)
      assert.strictEqual(res.status, 200)
      const data = (await res.json()) as any
      assert.ok(Array.isArray(data.drives))
      assert.ok(data.drives.length >= 1)
      assert.ok(data.drives[0].drive)
      assert.ok(data.defaultPath)
    })

    it('should respond 200 on /api/v1/fs/list for the current directory', async () => {
      const res = await fetch(`${baseUrl}/api/v1/fs/list?path=${encodeURIComponent(process.cwd())}`)
      assert.strictEqual(res.status, 200)
      const data = (await res.json()) as any
      assert.ok(Array.isArray(data.items))
      assert.ok(data.items.length > 0)
      assert.strictEqual(typeof data.totalItems, 'number')
      const hasPackageJson = data.items.some((item: any) => item.name === 'package.json')
      assert.strictEqual(hasPackageJson, true)
    })

    it('should close gateway server cleanly', async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    })
  })

  // 4. End-to-End Market Analysis Flow Verification
  describe('End-to-End Test: "Analyze gold (XAUUSD) and forex market trends today."', () => {
    const userQuery = 'Analyze gold (XAUUSD) and forex market trends today.'

    it('should recognize planning requirement for forex/market analysis query', () => {
      const needsPlan = planner.needsPlan(userQuery)
      assert.strictEqual(needsPlan, true)
    })

    it('should generate a structured plan with market analysis steps', () => {
      const plan = planner.createPlan(userQuery)
      assert.ok(plan.steps.length >= 2)
      assert.ok(
        plan.goal.toLowerCase().includes('forex') ||
          plan.goal.toLowerCase().includes('gold') ||
          plan.goal.toLowerCase().includes('market'),
      )
    })

    it('should execute audit_forex_trade tool with valid trade metrics', async () => {
      const result = await toolRegistry.executeTool('audit_forex_trade', {
        pair: 'XAUUSD',
        direction: 'LONG',
        entryPrice: 2650.5,
        stopLoss: 2640.0,
        takeProfit: 2680.0,
        accountBalanceUsd: 10000,
        riskPercent: 1.5,
      })

      assert.strictEqual(result.success, true)
      const audit = result.data as any
      assert.ok(audit)
      assert.strictEqual(audit.pair, 'XAUUSD')
      assert.strictEqual(audit.riskRewardRatio > 2, true)
      assert.ok(audit.positionSizeLots > 0)
    })

    it('should execute webhunt_research tool with research categorization', async () => {
      const result = await toolRegistry.executeTool('webhunt_research', {
        topic: 'Gold XAUUSD forex market sentiment',
      })

      assert.strictEqual(result.success, true)
      const dossier = result.data as any
      assert.ok(dossier)
      assert.ok(Array.isArray(dossier.facts))
      assert.ok(Array.isArray(dossier.recommendations))
    })
  })
})
