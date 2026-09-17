import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { serviceManager } from '../server/services/service-manager.js'
import { pythonServiceBridge } from '../server/services/python-service-bridge.js'
import { rustServiceBridge } from '../server/services/rust-service-bridge.js'
import { toolRegistry } from '../server/tools/registry.js'
import { createGatewayServer } from '../server/gateway.js'

describe('GACKS AI Assistant OS — Python & Rust Services Integration', () => {
  let gateway: { server: http.Server; wss: any; port: number }
  const testPort = 8796

  before(async () => {
    process.env.JARVIS_BRIDGE_PORT = String(testPort)
    gateway = createGatewayServer()
    await new Promise<void>((resolve) => {
      gateway.server.listen(testPort, () => resolve())
    })
    await serviceManager.initialize()
  })

  after(async () => {
    await new Promise<void>((resolve) => {
      gateway.wss.close(() => {
        gateway.server.close(() => resolve())
      })
    })
  })

  describe('Service Manager & Health Discovery', () => {
    test('should initialize and report full system status', async () => {
      const status = await serviceManager.getSystemStatus()
      assert.strictEqual(typeof status.timestamp, 'number')
      assert.ok(status.services.pythonAi)
      assert.ok(status.services.rustNative)
      assert.strictEqual(status.services.gateway.status, 'ONLINE')
      assert.ok(status.capabilities.python.length >= 5)
      assert.ok(status.capabilities.rust.length >= 6)
      assert.ok(status.capabilities.total >= 11)
    })
  })

  describe('Python AI Service Bridge & Fallback Capabilities', () => {
    test('should check health and return structured report', async () => {
      const report = await pythonServiceBridge.checkHealth()
      assert.strictEqual(report.service, 'gacks-python-ai-core')
      assert.strictEqual(typeof report.status, 'string')
    })

    test('should perform computer vision / OCR analysis', async () => {
      const result = await pythonServiceBridge.analyzeVision({
        imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        mode: 'ocr',
      })
      assert.strictEqual(result.success, true)
      assert.strictEqual(result.mode, 'ocr')
      assert.ok(result.textContent)
      assert.ok(result.confidence > 0.8)
    })

    test('should generate vector embeddings for batch texts', async () => {
      const texts = ['System architecture upgrade', 'Machine learning inference']
      const result = await pythonServiceBridge.generateEmbeddings(texts, 128)
      assert.strictEqual(result.success, true)
      assert.strictEqual(result.count, 2)
      assert.strictEqual(result.dimensions, 128)
      assert.strictEqual(result.embeddings[0].length, 128)
    })

    test('should execute semantic RAG document queries', async () => {
      const docs = [
        { id: 'doc-1', content: 'Python service handles vision and embeddings' },
        { id: 'doc-2', content: 'Rust core handles low level Windows operating system control' },
        { id: 'doc-3', content: 'TypeScript gateway acts as the central brain' },
      ]
      const result = await pythonServiceBridge.queryRag({
        query: 'Python embeddings and vision',
        documents: docs,
        topK: 2,
      })
      assert.strictEqual(result.success, true)
      assert.strictEqual(result.query, 'Python embeddings and vision')
      assert.ok(result.matches.length > 0)
      assert.strictEqual(result.matches[0].id, 'doc-1')
    })

    test('should extract structured entities and key points from documents', async () => {
      const content = 'Contact the engineering lead at lead@gacks-ai.io or visit https://gacks-ai.vercel.app for documentation. Estimated project cost is $50,000 USD.'
      const result = await pythonServiceBridge.processDocument({
        content,
        extractEntities: true,
      })
      assert.strictEqual(result.success, true)
      assert.ok(result.wordCount > 5)
      assert.ok(result.entities)
      const hasEmail = result.entities.some((e) => e.type === 'EMAIL' && e.value === 'lead@gacks-ai.io')
      assert.strictEqual(hasEmail, true)
    })

    test('should process acoustic speech streams', async () => {
      const result = await pythonServiceBridge.transcribeAudio({
        audioBase64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
        audioFormat: 'wav',
      })
      assert.strictEqual(result.success, true)
      assert.ok(result.confidence > 0.8)
      assert.ok(result.features)
    })
  })

  describe('Rust Native OS Bridge & Security Boundaries', () => {
    test('should check health and return structured report', async () => {
      const report = await rustServiceBridge.checkHealth()
      assert.strictEqual(report.service, 'gacks-rust-native-core')
      assert.strictEqual(typeof report.status, 'string')
    })

    test('should retrieve native system telemetry', async () => {
      const telemetry = await rustServiceBridge.getSystemTelemetry()
      assert.ok(telemetry.totalMemoryBytes > 0)
      assert.ok(telemetry.cpuCount > 0)
      assert.strictEqual(typeof telemetry.isWindows, 'boolean')
    })

    test('should list active processes', async () => {
      const procs = await rustServiceBridge.getProcesses(10)
      assert.ok(Array.isArray(procs))
      assert.ok(procs.length > 0)
      assert.ok(typeof procs[0].pid === 'number')
    })

    test('should enumerate desktop windows', async () => {
      const windows = await rustServiceBridge.getWindows()
      assert.ok(Array.isArray(windows))
      assert.ok(windows.length > 0)
      assert.ok(windows[0].title)
    })

    test('should block non-allowlisted commands in Rust sandbox', async () => {
      const result = await rustServiceBridge.executeSandboxedCommand('format_c_drive', ['/Q'])
      assert.strictEqual(result.success, false)
      assert.strictEqual(result.error, 'COMMAND_NOT_ALLOWLISTED')
    })

    test('should allow permitted commands with safe execution output', async () => {
      const result = await rustServiceBridge.executeSandboxedCommand('git', ['status'], true)
      assert.strictEqual(result.success, true)
      assert.strictEqual(result.exitCode, 0)
    })
  })

  describe('Tool Registry Integration', () => {
    test('should have all 11 Python and Rust specialized tools registered', () => {
      const toolNames = toolRegistry.getToolNames()
      const expected = [
        'python_vision_analyze',
        'python_document_extract',
        'python_embeddings_generate',
        'python_rag_query',
        'python_audio_intelligence',
        'rust_system_hardware',
        'rust_process_manager',
        'rust_window_manager',
        'rust_filesystem_secure',
        'rust_clipboard_sync',
        'rust_command_sandbox',
      ]
      for (const name of expected) {
        assert.ok(toolNames.includes(name), `Missing tool: ${name}`)
      }
    })

    test('should execute python_embeddings_generate through ToolRegistry', async () => {
      const res = await toolRegistry.executeTool('python_embeddings_generate', {
        texts: ['GACKS AI Operating System'],
        dimensions: 64,
      })
      assert.strictEqual(res.success, true)
      const data = res.data as any
      assert.strictEqual(data.count, 1)
      assert.strictEqual(data.dimensions, 64)
    })

    test('should execute python_document_extract through ToolRegistry', async () => {
      const res = await toolRegistry.executeTool('python_document_extract', {
        content: 'Engineering portal: https://gacks-ai.vercel.app',
      })
      assert.strictEqual(res.success, true)
      const data = res.data as any
      assert.ok(data.entities.length > 0)
    })

    test('should execute rust_system_hardware through ToolRegistry', async () => {
      const res = await toolRegistry.executeTool('rust_system_hardware', {})
      assert.strictEqual(res.success, true)
      const data = res.data as any
      assert.ok(data.totalMemoryBytes > 0)
    })
  })

  describe('Gateway HTTP REST Routes', () => {
    test('GET /api/v1/services/status returns 200 with service hierarchy', async () => {
      const res = await fetch(`http://localhost:${testPort}/api/v1/services/status`)
      assert.strictEqual(res.status, 200)
      const data = (await res.json()) as any
      assert.ok(data.services.pythonAi)
      assert.ok(data.services.rustNative)
      assert.strictEqual(data.services.gateway.status, 'ONLINE')
    })

    test('GET /api/v1/services/capabilities returns 200 with capabilities list', async () => {
      const res = await fetch(`http://localhost:${testPort}/api/v1/services/capabilities`)
      assert.strictEqual(res.status, 200)
      const data = (await res.json()) as any
      assert.ok(Array.isArray(data.python))
      assert.ok(Array.isArray(data.rust))
      assert.ok(data.total >= 11)
    })

    test('GET /api/v1/health includes pythonAi and rustNative status', async () => {
      const res = await fetch(`http://localhost:${testPort}/api/v1/health`)
      assert.strictEqual(res.status, 200)
      const data = (await res.json()) as any
      assert.ok(data.services.pythonAi)
      assert.ok(data.services.rustNative)
      assert.strictEqual(data.services.pythonAi.service, 'gacks-python-ai-core')
      assert.strictEqual(data.services.rustNative.service, 'gacks-rust-native-core')
    })
  })
})
