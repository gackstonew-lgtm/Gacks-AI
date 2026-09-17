import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { createGatewayServer } from '../server/gateway.js'

describe('Gateway Server REST & Auth Route Integration', () => {
  let gateway: { server: http.Server; wss: any; port: number }
  const testPort = 8799

  before(async () => {
    process.env.GATEWAY_PORT = String(testPort)
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

  test('POST /api/v1/webhunt/auth/login with missing body returns 400 JSON', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/v1/webhunt/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    assert.strictEqual(res.status, 400)
    const data = await res.json() as any
    assert.strictEqual(data.success, false)
    assert.match(data.error, /Email and password are required/i)
  })

  test('POST /api/v1/webhunt/auth/login with credentials reaches WebHunt auth endpoint', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/v1/webhunt/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@webhunt.io', password: 'testPassword123!' }),
    })
    // Can be 200 or 401 depending on production credentials, but MUST NOT be 404
    assert.notStrictEqual(res.status, 404, 'Endpoint must not return 404 Not Found')
    assert.ok(res.status === 200 || res.status === 401)
    const data = await res.json() as any
    assert.ok(typeof data === 'object')
  })

  test('GET /api/v1/webhunt/status returns 200 JSON with connection report', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/v1/webhunt/status`)
    assert.strictEqual(res.status, 200)
    const data = await res.json() as any
    assert.ok('connected' in data)
    assert.ok('sourceOfTruth' in data)
    assert.ok('baseUrl' in data)
  })

  test('GET /api/v1/models returns 200 JSON with model registry', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/v1/models`)
    assert.strictEqual(res.status, 200)
    const data = await res.json() as any
    assert.ok(Array.isArray(data.models))
  })

  test('POST /api/v1/webhunt/auth/logout returns 200 JSON', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/v1/webhunt/auth/logout`, {
      method: 'POST',
    })
    assert.strictEqual(res.status, 200)
    const data = await res.json() as any
    assert.strictEqual(data.success, true)
  })
})
