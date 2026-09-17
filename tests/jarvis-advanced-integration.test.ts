import { describe, it } from 'node:test'
import assert from 'node:assert'
import { toolRegistry } from '../server/tools/registry.js'
import { policyEngine } from '../server/security/policy.js'
import { androidAdapter } from '../server/system/android-adapter.js'
import { imageGenerator } from '../server/agent/image-generator.js'
import { createGatewayServer } from '../server/gateway.js'
import { RiskLevels } from '../server/types.js'

describe('J.A.R.V.I.S Advanced Capabilities Integration Tests', () => {
  // 1. Tool Registry & Policy Verification
  describe('Tool Registry Advanced Additions', () => {
    it('should have all newly registered J.A.R.V.I.S tools present in registry', () => {
      const toolNames = toolRegistry.getToolNames()
      assert.ok(toolNames.includes('image_generation'), 'Missing image_generation tool')
      assert.ok(toolNames.includes('android_status'), 'Missing android_status tool')
      assert.ok(toolNames.includes('android_screenshot'), 'Missing android_screenshot tool')
      assert.ok(toolNames.includes('android_launch_app'), 'Missing android_launch_app tool')
      assert.ok(toolNames.includes('mcp_list_servers'), 'Missing mcp_list_servers tool')
    })

    it('should classify android_status and android_screenshot as Level 0 Read-Only', () => {
      assert.strictEqual(policyEngine.evaluateRisk('android_status'), RiskLevels.READ_ONLY)
      assert.strictEqual(policyEngine.evaluateRisk('android_screenshot'), RiskLevels.READ_ONLY)
      assert.strictEqual(policyEngine.evaluateRisk('mcp_list_servers'), RiskLevels.READ_ONLY)
    })

    it('should classify android_launch_app as Level 2 Governed Action requiring confirmation', () => {
      assert.strictEqual(policyEngine.evaluateRisk('android_launch_app'), RiskLevels.EXTERNAL_SIDE_EFFECT)
      const decision = policyEngine.evaluate('android_launch_app', { packageName: 'com.android.chrome' }, false)
      assert.strictEqual(decision.allowed, false)
      assert.strictEqual(decision.requiresConfirmation, true)
    })

    it('should permit android_launch_app when user confirmation is provided', () => {
      const decision = policyEngine.evaluate('android_launch_app', { packageName: 'com.android.chrome' }, true)
      assert.strictEqual(decision.allowed, true)
      assert.strictEqual(decision.requiresConfirmation, false)
    })
  })

  // 2. Android Device Adapter Tests
  describe('Android Device Adapter & Security', () => {
    it('should return a structured status report gracefully even if ADB is not connected', async () => {
      const report = await androidAdapter.getStatusReport()
      assert.ok(typeof report.available === 'boolean')
      assert.ok(typeof report.devicesCount === 'number')
      assert.ok(Array.isArray(report.devices))
    })

    it('should reject invalid package names preventing shell command injection', async () => {
      const result = await androidAdapter.launchApp('com.app; rm -rf /')
      assert.strictEqual(result.success, false)
      assert.ok(result.message.includes('Invalid Android package name'))
    })

    it('should reject invalid device IDs in screenshot capture', async () => {
      const result = await androidAdapter.captureScreenshot('device_id; echo hacked')
      assert.strictEqual(result.success, false)
      assert.ok(result.error?.includes('Invalid device ID format'))
    })
  })

  // 3. Image Generation Engine Tests
  describe('Image Generation Multi-Provider Engine', () => {
    it('should reject empty image generation prompts', async () => {
      const result = await imageGenerator.generateImage({ prompt: '' })
      assert.strictEqual(result.success, false)
      assert.ok(result.error?.includes('cannot be empty'))
    })

    it('should generate an image via provider fallback chain', async () => {
      const result = await imageGenerator.generateImage({
        prompt: 'Futuristic holographic arc reactor interface on dark glass',
        size: '1024x1024',
      })
      assert.strictEqual(result.success, true)
      assert.ok(result.url)
      assert.ok(result.provider)
      assert.strictEqual(result.mimeType, 'image/jpeg')
    })
  })

  // 4. Gateway Health & Telemetry API Tests
  describe('Gateway Health & Capability API', () => {
    it('should respond to /health and /api/v1/health with comprehensive capability flags', async () => {
      const { server, port } = createGatewayServer()
      await new Promise<void>((resolve) => server.listen(0, resolve))
      const actualPort = (server.address() as any).port

      try {
        const res = await fetch(`http://127.0.0.1:${actualPort}/api/v1/health`)
        assert.strictEqual(res.status, 200)
        const data = (await res.json()) as any

        assert.strictEqual(data.ok, true)
        assert.strictEqual(data.version, '2.0.0')
        assert.ok(typeof data.ai === 'boolean')
        assert.ok(typeof data.stt === 'boolean')
        assert.ok(typeof data.tts === 'boolean')
        assert.ok(typeof data.browser === 'boolean')
        assert.ok(typeof data.filesystem === 'boolean')
        assert.ok(typeof data.android === 'boolean')
        assert.ok(typeof data.imageGeneration === 'boolean')
        assert.ok(typeof data.mcp === 'boolean')
        assert.ok(typeof data.osAutomation === 'boolean')
        assert.ok(data.services)
        assert.ok(data.services.voice)
        assert.ok(data.services.tools)
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()))
      }
    })
  })

  // 5. Tool Registry Execution of MCP & Image Generation
  describe('Tool Registry Execution', () => {
    it('should execute mcp_list_servers tool through ToolRegistry and return server list', async () => {
      const result = await toolRegistry.executeTool('mcp_list_servers', {})
      assert.strictEqual(result.success, true)
      const data = result.data as any
      assert.ok(typeof data.count === 'number')
      assert.ok(Array.isArray(data.servers))
    })

    it('should execute image_generation tool through ToolRegistry with UI blade emission', async () => {
      let uiMsg: any = null
      const result = await toolRegistry.executeTool(
        'image_generation',
        { prompt: 'Iron Man holographic tactical map HUD' },
        {
          sendUi: (msg) => {
            uiMsg = msg
          },
        },
      )
      assert.strictEqual(result.success, true)
      assert.ok(uiMsg)
      assert.strictEqual(uiMsg.type, 'blade')
      assert.strictEqual(uiMsg.blade.kind, 'image')
    })
  })
})
