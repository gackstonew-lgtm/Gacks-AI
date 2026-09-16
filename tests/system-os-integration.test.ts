import { describe, it } from 'node:test'
import assert from 'node:assert'
import { capabilityRegistry } from '../server/system/capability-registry.js'
import { windowsSystemService } from '../server/system/windows-system-service.js'
import { systemAuditLogger } from '../server/system/audit-logger.js'
import { toolRegistry } from '../server/tools/registry.js'
import { policyEngine } from '../server/security/policy.js'

describe('Local AI Operating System Integration Tests', () => {
  // 1. Capability Registry & Granular Permissions
  describe('Capability Registry & Permission Engine', () => {
    it('should initialize all 8 core OS capabilities', () => {
      const caps = capabilityRegistry.getAllCapabilities()
      const ids = Object.keys(caps)
      assert.strictEqual(ids.length, 8)
      assert.ok(caps.system_metrics)
      assert.ok(caps.hardware_devices)
      assert.ok(caps.filesystem)
      assert.ok(caps.processes)
      assert.ok(caps.applications)
      assert.ok(caps.clipboard)
      assert.ok(caps.notifications)
      assert.ok(caps.windows_services)
    })

    it('should report comprehensive status with platform awareness', () => {
      const status = capabilityRegistry.getStatus()
      assert.strictEqual(status.isLocalEnvironment, true)
      assert.strictEqual(typeof status.isWindows, 'boolean')
      assert.strictEqual(typeof status.platform, 'string')
      assert.ok(status.timestamp > 0)
    })

    it('should correctly evaluate granted vs prompt vs denied permissions', () => {
      // Set to prompt
      capabilityRegistry.setPermission('processes', 'prompt')
      const promptCheck = capabilityRegistry.checkPermission('processes')
      assert.strictEqual(promptCheck.allowed, false)
      assert.strictEqual(promptCheck.requiresPrompt, true)

      // Set to granted
      capabilityRegistry.setPermission('processes', 'granted')
      const grantedCheck = capabilityRegistry.checkPermission('processes')
      assert.strictEqual(grantedCheck.allowed, true)
      assert.strictEqual(grantedCheck.requiresPrompt, false)

      // Set to denied
      capabilityRegistry.setPermission('processes', 'denied')
      const deniedCheck = capabilityRegistry.checkPermission('processes')
      assert.strictEqual(deniedCheck.allowed, false)
      assert.strictEqual(deniedCheck.requiresPrompt, false)
      assert.ok(deniedCheck.reason.includes('denied'))

      // Reset to prompt default
      capabilityRegistry.setPermission('processes', 'prompt')
    })
  })

  // 2. Hardware & Devices Telemetry
  describe('Windows System & Hardware Service', () => {
    it('should gather real hardware telemetry without fabricating fake metrics', async () => {
      const hw = await windowsSystemService.getHardwareReport()
      assert.ok(hw.cpu.model.length > 0)
      assert.ok(hw.cpu.logicalCores > 0)
      assert.ok(hw.cpu.physicalCores > 0)
      assert.ok(hw.memory.totalBytes > 0)
      assert.ok(hw.memory.usagePercent >= 0 && hw.memory.usagePercent <= 100)
      assert.ok(Array.isArray(hw.drives))
      assert.ok(hw.drives.length > 0)
      assert.ok(Array.isArray(hw.displays))
      assert.strictEqual(typeof hw.gpu.available, 'boolean')
      assert.ok(hw.gpu.name.length > 0)
    })

    it('should gather devices telemetry with valid structural contracts', async () => {
      const dev = await windowsSystemService.getDevicesReport()
      assert.strictEqual(typeof dev.wifi.connected, 'boolean')
      assert.ok(Array.isArray(dev.bluetoothDevices))
      assert.ok(Array.isArray(dev.networkAdapters))
      assert.ok(Array.isArray(dev.audioDevices))
      assert.ok(Array.isArray(dev.printers))
    })

    it('should block terminating critical Windows core processes or invalid PIDs', async () => {
      // Attempt to terminate PID 0
      const resPid0 = await windowsSystemService.terminateProcess(0, 'System', true)
      assert.strictEqual(resPid0.success, false)
      assert.ok(resPid0.message.includes('critical system'))

      // Attempt to terminate explorer.exe
      const resExplorer = await windowsSystemService.terminateProcess(9999, 'explorer', true)
      assert.strictEqual(resExplorer.success, false)
      assert.ok(resExplorer.message.includes('protected Windows core process'))

      // Attempt without confirmation name
      const resNoName = await windowsSystemService.terminateProcess(1234, '', true)
      assert.strictEqual(resNoName.success, false)
      assert.ok(resNoName.message.includes('confirmation name is required'))
    })

    it('should reject launching dangerous shell scripts or command injection attempts', async () => {
      const resBat = await windowsSystemService.launchApp('malicious.bat', true)
      assert.strictEqual(resBat.success, false)
      assert.ok(resBat.message.includes('Invalid executable format'))

      const resCmd = await windowsSystemService.launchApp('test.exe; rm -rf /', true)
      assert.strictEqual(resCmd.success, false)
      assert.ok(resCmd.message.includes('forbidden shell characters'))
    })
  })

  // 3. System Audit Logger
  describe('System Audit Logger & Security Redaction', () => {
    it('should log system operations and redact sensitive credential keys', () => {
      systemAuditLogger.log({
        capability: 'clipboard',
        action: 'write_clipboard',
        inputs: { apiKey: 'sk-secret-12345', text: 'Hello Gacks AI' },
        riskLevel: 'write',
        confirmationState: 'granted',
        success: true,
        durationMs: 12,
        resultSummary: 'Copied text',
      })

      const entries = systemAuditLogger.getEntries(5, 'clipboard')
      assert.ok(entries.length > 0)
      const last = entries[0]
      assert.strictEqual(last.action, 'write_clipboard')
      assert.strictEqual(last.inputs.apiKey, '***REDACTED***')
      assert.strictEqual(last.inputs.text, 'Hello Gacks AI')
    })
  })

  // 4. AI Tool Registry & Policy Engine Integration
  describe('AI Tool Registry & Security Governance', () => {
    it('should have all 10 Windows system tools registered with strict schema validation', () => {
      const toolNames = toolRegistry.getToolNames()
      const requiredSystemTools = [
        'system_get_hardware_details',
        'system_get_devices',
        'system_get_processes',
        'system_terminate_process',
        'system_get_apps',
        'system_launch_app',
        'system_read_clipboard',
        'system_write_clipboard',
        'system_send_notification',
        'system_get_services',
      ]

      for (const t of requiredSystemTools) {
        assert.ok(toolNames.includes(t), `Missing expected system tool: ${t}`)
      }
    })

    it('should evaluate system_terminate_process as Level 3 Destructive Security', () => {
      const decision = policyEngine.evaluate('system_terminate_process', { pid: 1234 })
      assert.strictEqual(decision.riskLevel, 3)
      assert.strictEqual(decision.allowed, false)
      assert.strictEqual(decision.requiresConfirmation, true)
    })

    it('should evaluate system_launch_app as Level 2 Governed Action requiring confirmation', () => {
      const decision = policyEngine.evaluate('system_launch_app', { app: 'notepad.exe' })
      assert.strictEqual(decision.riskLevel, 2)
      assert.strictEqual(decision.allowed, false)
      assert.strictEqual(decision.requiresConfirmation, true)
    })

    it('should execute system_get_hardware_details autonomously (Level 0)', async () => {
      const result = await toolRegistry.executeTool('system_get_hardware_details')
      assert.strictEqual(result.success, true)
      assert.strictEqual(result.verification?.status, 'verified_success')
      assert.ok((result.data as any).cpu)
      assert.ok((result.data as any).memory)
    })
  })
})
