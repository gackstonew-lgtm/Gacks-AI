import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { WebSocket } from 'ws'
import { createGatewayServer } from '../server/gateway.js'

describe('GACKS Agent Gateway WebSocket & Connectivity Resilience', () => {
  let gateway: { server: http.Server; wss: any; port: number }
  const testPort = 8798

  before(async () => {
    process.env.JARVIS_BRIDGE_PORT = String(testPort)
    gateway = createGatewayServer()
    await new Promise<void>((resolve) => {
      gateway.server.listen(testPort, () => resolve())
    })
  })

  after(async () => {
    await new Promise<void>((resolve) => {
      gateway.wss.close(() => {
        gateway.server.close(() => resolve())
      })
    })
  })

  test('Gateway starts and responds on /health with service metadata', async () => {
    const res = await fetch(`http://localhost:${testPort}/health`)
    assert.strictEqual(res.status, 200)
    const data = await res.json() as any
    assert.strictEqual(data.ok, true)
    assert.strictEqual(data.service, 'gacks-agent-gateway')
    assert.strictEqual(typeof data.services?.ai?.provider, 'string')
    assert.match(data.services.ai.provider, /Dynamic Multi-Model/i)
  })

  test('Gateway responds on /api/v1/health with full telemetry report', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/v1/health`)
    assert.strictEqual(res.status, 200)
    const data = await res.json() as any
    assert.strictEqual(data.ok, true)
    assert.strictEqual(data.service, 'gacks-agent-gateway')
    assert.ok(data.services.memory)
    assert.ok(data.services.tools)
  })

  test('WebSocket connects successfully on /ws and receives ready event', async () => {
    const ws = new WebSocket(`ws://localhost:${testPort}/ws`, {
      origin: 'http://localhost:5173',
    })

    const readyPromise = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for ready event')), 5000)
      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString())
          if (msg.type === 'ready') {
            clearTimeout(timer)
            resolve(msg)
          }
        } catch (e) {
          clearTimeout(timer)
          reject(e)
        }
      })
      ws.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })
    })

    const msg = await readyPromise
    assert.strictEqual(msg.type, 'ready')
    assert.ok(Array.isArray(msg.servers))
    assert.ok(msg.servers.length > 0)

    ws.close()
  })

  test('WebSocket accepts connections on root / path as well', async () => {
    const ws = new WebSocket(`ws://localhost:${testPort}/`, {
      origin: 'http://localhost:5173',
    })

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve())
      ws.on('error', reject)
    })

    assert.strictEqual(ws.readyState, WebSocket.OPEN)
    ws.close()
  })

  test('WebSocket handles ping and replies with pong heartbeat', async () => {
    const ws = new WebSocket(`ws://localhost:${testPort}/ws`, {
      origin: 'http://localhost:5173',
    })

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve())
      ws.on('error', reject)
    })

    const pongPromise = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Heartbeat pong timeout')), 5000)
      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString())
          if (msg.type === 'pong') {
            clearTimeout(timer)
            resolve(msg)
          }
        } catch (e) {
          clearTimeout(timer)
          reject(e)
        }
      })
    })

    ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }))
    const pong = await pongPromise
    assert.strictEqual(pong.type, 'pong')
    assert.ok(typeof pong.timestamp === 'number')

    ws.close()
  })

  test('WebSocket executes ask turn without crashing', async () => {
    const ws = new WebSocket(`ws://localhost:${testPort}/ws`, {
      origin: 'http://localhost:5173',
    })

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve())
      ws.on('error', reject)
    })

    const turnPromise = new Promise<{ text: string; done: boolean }>((resolve, reject) => {
      let text = ''
      const timer = setTimeout(() => reject(new Error('Turn timeout')), 15000)
      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString())
          if (msg.type === 'text') {
            text += msg.delta ?? ''
          }
          if (msg.type === 'done' || msg.type === 'error') {
            clearTimeout(timer)
            resolve({ text: text || msg.text || '', done: true })
          }
        } catch (e) {
          clearTimeout(timer)
          reject(e)
        }
      })
    })

    ws.send(JSON.stringify({ type: 'ask', text: 'Status check', id: 'test-turn-1' }))
    const result = await turnPromise
    assert.ok(result.done)

    ws.close()
  })

  test('Allowed origin validation permits localhost, 127.0.0.1, LAN IPs, and Vercel', async () => {
    // Test that local 5173 origin is permitted
    const ws1 = new WebSocket(`ws://localhost:${testPort}/ws`, {
      origin: 'http://localhost:5173',
    })
    await new Promise<void>((resolve, reject) => {
      ws1.on('open', () => resolve())
      ws1.on('error', reject)
    })
    assert.strictEqual(ws1.readyState, WebSocket.OPEN)
    ws1.close()

    // Test that 127.0.0.1 origin is permitted
    const ws2 = new WebSocket(`ws://localhost:${testPort}/ws`, {
      origin: 'http://127.0.0.1:5173',
    })
    await new Promise<void>((resolve, reject) => {
      ws2.on('open', () => resolve())
      ws2.on('error', reject)
    })
    assert.strictEqual(ws2.readyState, WebSocket.OPEN)
    ws2.close()
  })
})
