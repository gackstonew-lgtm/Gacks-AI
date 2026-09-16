import { describe, it } from 'node:test'
import assert from 'node:assert'
import { planner } from '../server/agent/planner.js'
import { policyEngine } from '../server/security/policy.js'
import { verifier } from '../server/agent/verifier.js'
import { memoryStore } from '../server/memory/memory-store.js'
import { sandbox } from '../server/security/sandbox.js'
import { RiskLevels } from '../server/types.js'

describe('GACKS P.A. V2 Architecture Tests', () => {
  // 1. Planner Tests
  describe('Planner', () => {
    it('should detect complex tasks that require planning', () => {
      assert.strictEqual(planner.needsPlan('Please fix my Vercel deployment error'), true)
      assert.strictEqual(planner.needsPlan('Refactor database queries and audit'), true)
      assert.strictEqual(planner.needsPlan('What is the weather today?'), false)
    })

    it('should create structured plans with discrete steps and dependency graph', () => {
      const plan = planner.createPlan('Fix Vercel deployment configuration')
      assert.ok(plan.id.startsWith('plan-'))
      assert.strictEqual(plan.status, 'pending')
      assert.ok(plan.steps.length >= 3)
      assert.strictEqual(plan.steps[0].status, 'pending')
      assert.strictEqual(plan.steps[1].dependencies.length, 1)
    })
  })

  // 2. Policy Engine Tests
  describe('Policy Engine', () => {
    it('should correctly evaluate risk levels 0 to 4', () => {
      assert.strictEqual(policyEngine.evaluateRisk('read_file'), RiskLevels.READ_ONLY)
      assert.strictEqual(policyEngine.evaluateRisk('write_file'), RiskLevels.LOW_RISK_WRITE)
      assert.strictEqual(policyEngine.evaluateRisk('send_email'), RiskLevels.EXTERNAL_SIDE_EFFECT)
      assert.strictEqual(policyEngine.evaluateRisk('delete_file'), RiskLevels.DESTRUCTIVE_SECURITY)
      assert.strictEqual(policyEngine.evaluateRisk('purchase_order'), RiskLevels.FINANCIAL_HIGH_CONSEQUENCE)
    })

    it('should permit read-only actions by default without confirmation', () => {
      const decision = policyEngine.evaluate('read_file', { path: 'test.txt' })
      assert.strictEqual(decision.allowed, true)
      assert.strictEqual(decision.requiresConfirmation, false)
    })

    it('should block external side effects without operator confirmation', () => {
      const decision = policyEngine.evaluate('send_email', { to: 'test@example.com' })
      assert.strictEqual(decision.allowed, false)
      assert.strictEqual(decision.requiresConfirmation, true)
    })
  })

  // 3. Verifier Tests
  describe('Verifier', () => {
    it('should verify successful tool execution schemas', () => {
      const v = verifier.verifyToolExecution('blade', { status: 'opened', bladeId: 'b1' })
      assert.strictEqual(v.status, 'verified_success')
      assert.strictEqual(v.verified, true)
    })

    it('should flag execution errors as verification failures', () => {
      const v = verifier.verifyToolExecution('read_file', { error: 'File not found' })
      assert.strictEqual(v.status, 'failure')
      assert.strictEqual(v.verified, false)
    })
  })

  // 4. Memory Store Tests
  describe('Memory Store & Hybrid Ranking', () => {
    it('should store and retrieve semantic memories matching keywords', () => {
      const mem = memoryStore.recordMemory({
        category: 'semantic',
        content: 'Operator prefers Gold XAUUSD technical analysis during London session.',
        importance: 5,
        tags: ['trading', 'xauusd', 'london'],
      })
      assert.ok(mem)
      assert.ok(mem.id.startsWith('mem-'))

      const results = memoryStore.searchMemories({
        query: 'XAUUSD trading analysis',
        category: 'semantic',
        limit: 3,
      })
      assert.ok(results.length > 0)
      assert.ok(results[0].content.includes('XAUUSD'))
    })

    it('should reject storing sensitive credentials like private keys or API tokens', () => {
      const rejected = memoryStore.recordMemory({
        category: 'semantic',
        content: 'My secret token is ghp_1234567890abcdef1234567890abcdef123456',
      })
      assert.strictEqual(rejected, null)
    })
  })

  // 5. Security Sandbox Tests
  describe('Security Sandbox', () => {
    it('should block path traversal attempts outside allowed workspace roots', () => {
      const check = sandbox.validateSafePath('../../etc/passwd')
      assert.strictEqual(check.valid, false)
      assert.ok(check.error?.includes('Access denied'))
    })

    it('should allow valid workspace paths', () => {
      const check = sandbox.validateSafePath('package.json')
      assert.strictEqual(check.valid, true)
    })

    it('should block SSRF requests to localhost and private addresses', () => {
      const checkLocal = sandbox.validateSafeUrl('http://localhost:8080/admin')
      assert.strictEqual(checkLocal.valid, false)

      const checkMetadata = sandbox.validateSafeUrl('http://169.254.169.254/latest/meta-data')
      assert.strictEqual(checkMetadata.valid, false)

      const checkValid = sandbox.validateSafeUrl('https://api.github.com/repos')
      assert.strictEqual(checkValid.valid, true)
    })
  })

  // 6. Workspace Manager & Isolation Tests
  describe('Workspace Security & Isolation', () => {
    it('should validate paths inside approved workspace', async () => {
      const { workspaceManager } = await import('../server/security/workspace.js')
      const valid = workspaceManager.validatePath('package.json', 'read')
      assert.strictEqual(valid.valid, true)
      assert.ok(valid.resolvedPath?.endsWith('package.json'))
    })

    it('should prevent path traversal outside workspace', async () => {
      const { workspaceManager } = await import('../server/security/workspace.js')
      const traversal = workspaceManager.validatePath('../../Windows/System32/cmd.exe', 'read')
      assert.strictEqual(traversal.valid, false)
      assert.ok(traversal.error?.includes('Access denied') || traversal.error?.includes('outside approved'))
    })

    it('should identify sensitive files like .env and private keys', async () => {
      const { workspaceManager } = await import('../server/security/workspace.js')
      assert.strictEqual(workspaceManager.isSensitiveFile('.env'), true)
      assert.strictEqual(workspaceManager.isSensitiveFile('.env.local'), true)
      assert.strictEqual(workspaceManager.isSensitiveFile('id_rsa'), true)
      assert.strictEqual(workspaceManager.isSensitiveFile('credentials.json'), true)
      assert.strictEqual(workspaceManager.isSensitiveFile('package.json'), false)
    })

    it('should redact secrets and API tokens from command/file outputs', async () => {
      const { workspaceManager } = await import('../server/security/workspace.js')
      const raw = 'Config: api_key="sk-1234567890abcdef1234567890" and token: ghp_1234567890abcdef1234567890abcdef123456'
      const redacted = workspaceManager.redactSecrets(raw)
      assert.ok(!redacted.includes('sk-1234567890abcdef1234567890'))
      assert.ok(!redacted.includes('ghp_1234567890abcdef1234567890abcdef123456'))
      assert.ok(redacted.includes('[REDACTED]'))
    })
  })

  // 7. Terminal Service & Command Safety Tests
  describe('Controlled Terminal Execution Service', () => {
    it('should reject dangerous commands', async () => {
      const { terminalService } = await import('../server/terminal/terminal-service.js')
      assert.strictEqual(terminalService.validateCommand('rm -rf /').valid, false)
      assert.strictEqual(terminalService.validateCommand('format C:').valid, false)
      assert.strictEqual(terminalService.validateCommand(':(){ :|:& };:').valid, false)
    })

    it('should accept valid development commands', async () => {
      const { terminalService } = await import('../server/terminal/terminal-service.js')
      assert.strictEqual(terminalService.validateCommand('npm run build').valid, true)
      assert.strictEqual(terminalService.validateCommand('npm test').valid, true)
      assert.strictEqual(terminalService.validateCommand('node -v').valid, true)
    })

    it('should execute a safe command and capture output within approved workspace', async () => {
      const { terminalService } = await import('../server/terminal/terminal-service.js')
      const task = await terminalService.executeCommand('node -v')
      assert.ok(task.id.startsWith('term-'))
      assert.strictEqual(task.status, 'completed')
      assert.strictEqual(task.exitCode, 0)
      assert.ok(task.stdout.trim().startsWith('v'))
    })

    it('should enforce working directory within approved workspace', async () => {
      const { terminalService } = await import('../server/terminal/terminal-service.js')
      await assert.rejects(
        async () => {
          await terminalService.executeCommand('node -v', { cwd: 'C:/Windows/System32' })
        },
        /outside approved local workspaces|not in an approved workspace/i,
      )
    })
  })

  // 8. Local Operator Tools Registration & Permissions Tests
  describe('Local Operator Tools', () => {
    it('should have all 15 local tools registered', async () => {
      const { toolRegistry } = await import('../server/tools/registry.js')
      const requiredTools = [
        'open_file',
        'read_file',
        'write_file',
        'edit_file',
        'create_directory',
        'rename_file',
        'move_file',
        'delete_file',
        'list_directory',
        'search_files',
        'inspect_file_metadata',
        'run_terminal_command',
        'cancel_terminal_command',
        'get_terminal_output',
        'reveal_in_file_manager',
      ]
      const registered = toolRegistry.getToolNames()
      for (const toolName of requiredTools) {
        assert.ok(registered.includes(toolName), `Tool ${toolName} should be registered`)
      }
    })

    it('should enforce destructive security policy on delete_file', () => {
      assert.strictEqual(policyEngine.evaluateRisk('delete_file'), RiskLevels.DESTRUCTIVE_SECURITY)
      const decision = policyEngine.evaluate('delete_file', { path: 'critical.ts' })
      assert.strictEqual(decision.allowed, false)
      assert.strictEqual(decision.requiresConfirmation, true)
    })

    it('should generate multi-step engineering plan for code debugging & testing', () => {
      const plan = planner.createPlan('Fix bug in authentication and verify with test suite')
      assert.ok(plan.steps.length >= 4)
      const toolNames = plan.steps.map((s) => s.tool)
      assert.ok(toolNames.includes('list_directory'))
      assert.ok(toolNames.includes('read_file'))
      assert.ok(toolNames.includes('run_terminal_command'))
    })
  })
})
