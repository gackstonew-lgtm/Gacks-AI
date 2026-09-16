import { describe, it } from 'node:test'
import assert from 'node:assert'
import { apiRegistry } from '../server/api/registry.js'
import { catalogSync } from '../server/api/catalog-sync.js'
import { credentialManager } from '../server/api/credential-manager.js'
import { weatherAdapter } from '../server/api/adapters/weather-adapter.js'
import { geocodingAdapter } from '../server/api/adapters/geocoding-adapter.js'
import { currencyAdapter } from '../server/api/adapters/currency-adapter.js'
import { vulnerabilityAdapter } from '../server/api/adapters/vulnerability-adapter.js'
import { dictionaryAdapter } from '../server/api/adapters/dictionary-adapter.js'
import { worldTimeAdapter } from '../server/api/adapters/time-adapter.js'
import { BaseApiAdapter } from '../server/api/adapters/base-adapter.js'
import { planner } from '../server/agent/planner.js'
import { toolRegistry } from '../server/tools/registry.js'
import { workspaceManager } from '../server/security/workspace.js'

describe('GACKS External API Integration Architecture Tests', () => {
  // 1. Catalog Synchronization & Validation
  describe('Catalog Synchronization & Validation', () => {
    it('should pre-load curated public API catalog entries', () => {
      const entries = catalogSync.getEntries()
      assert.ok(entries.length >= 10, 'Catalog should contain curated entries')
      const weather = entries.find((e) => e.id === 'open-meteo-weather')
      assert.ok(weather)
      assert.strictEqual(weather.authType, 'none')
      assert.strictEqual(weather.https, true)
    })

    it('should reject invalid or malformed catalog entries', () => {
      // Missing name
      assert.strictEqual(catalogSync.validateAndNormalizeEntry({ description: 'No name', category: 'Weather' }), null)
      // Missing category
      assert.strictEqual(catalogSync.validateAndNormalizeEntry({ name: 'Test', description: 'No cat' }), null)
      // Invalid URL
      assert.strictEqual(catalogSync.validateAndNormalizeEntry({ name: 'Test', description: 'desc', category: 'Cat', Link: 'not-a-url' }), null)
      // Blocked localhost URL
      assert.strictEqual(catalogSync.validateAndNormalizeEntry({ name: 'Bad', description: 'desc', category: 'Cat', Link: 'http://localhost:8080' }), null)
    })

    it('should validate and normalize valid catalog entries', () => {
      const valid = catalogSync.validateAndNormalizeEntry({
        API: 'Cat Facts',
        Description: 'Daily cat facts',
        Category: 'Animals',
        Auth: 'No',
        HTTPS: 'yes',
        Cors: 'yes',
        Link: 'https://catfact.ninja',
      })
      assert.ok(valid)
      assert.strictEqual(valid.id, 'cat-facts')
      assert.strictEqual(valid.authType, 'none')
      assert.strictEqual(valid.https, true)
      assert.strictEqual(valid.adapterStatus, 'catalog_only')
    })
  })

  // 2. Discovery & Capability Matching
  describe('Discovery & Capability Resolution', () => {
    it('should search catalog by keyword and category', () => {
      const weatherApis = apiRegistry.searchCatalog({ category: 'Weather' })
      assert.ok(weatherApis.length >= 1)
      assert.ok(weatherApis.some((a) => a.id === 'open-meteo-weather'))

      const devApis = apiRegistry.searchCatalog({ query: 'vulnerabilities' })
      assert.ok(devApis.length >= 1)
      assert.ok(devApis.some((a) => a.id === 'osv-vulnerabilities'))
    })

    it('should resolve capabilities to verified installed adapters', () => {
      const weatherRes = apiRegistry.resolveCapability('weather forecast')
      assert.strictEqual(weatherRes.status, 'available')
      assert.strictEqual(weatherRes.adapter?.id, 'open-meteo-weather')

      const currencyRes = apiRegistry.resolveCapability('convert currency exchange rate')
      assert.strictEqual(currencyRes.status, 'available')
      assert.strictEqual(currencyRes.adapter?.id, 'frankfurter-currency')

      const vulnRes = apiRegistry.resolveCapability('check dependencies security vulnerabilities')
      assert.strictEqual(vulnRes.status, 'available')
      assert.strictEqual(vulnRes.adapter?.id, 'osv-vulnerabilities')
    })

    it('should distinguish installed adapters from catalog-only entries', () => {
      const nasaRes = apiRegistry.resolveCapability('nasa space astronomy')
      assert.strictEqual(nasaRes.status, 'catalog_only')
      assert.ok(nasaRes.entry)
      assert.strictEqual(nasaRes.entry.id, 'nasa-open-apis')
    })
  })

  // 3. Credential Manager & Isolation
  describe('Credential Manager & Provider Isolation', () => {
    it('should store and isolate credentials per provider', async () => {
      await credentialManager.setCredential('provider-a', 'Provider Alpha', 'apiKey', {
        apiKey: 'alpha-secret-key-1234567890',
      })
      await credentialManager.setCredential('provider-b', 'Provider Beta', 'apiKey', {
        apiKey: 'beta-secret-key-0987654321',
      })

      const credA = credentialManager.getCredential('provider-a')
      const credB = credentialManager.getCredential('provider-b')

      assert.strictEqual(credA?.apiKey, 'alpha-secret-key-1234567890')
      assert.strictEqual(credB?.apiKey, 'beta-secret-key-0987654321')
      assert.notStrictEqual(credA?.apiKey, credB?.apiKey)
    })

    it('should return masked credentials without leaking secrets', () => {
      const maskedList = credentialManager.getMaskedCredentials()
      const itemA = maskedList.find((c) => c.providerId === 'provider-a')
      assert.ok(itemA)
      assert.ok(itemA.maskedKey?.includes('••••'))
      assert.ok(!itemA.maskedKey?.includes('alpha-secret-key-1234567890'))
    })

    it('should reject empty API keys for apiKey auth type', async () => {
      await assert.rejects(
        async () => {
          await credentialManager.setCredential('provider-c', 'Provider C', 'apiKey', { apiKey: '   ' })
        },
        /API key cannot be empty/i,
      )
    })
  })

  // 4. Executable No-Auth Adapters Execution
  describe('Verified No-Auth API Execution', () => {
    it('should execute Open-Meteo Weather forecast', async () => {
      const result = await weatherAdapter.execute('get_forecast', { latitude: -1.2921, longitude: 36.8219 })
      assert.strictEqual(result.success, true)
      assert.strictEqual(result.isUntrustedData, true)
      assert.ok((result.data as any).current?.temperature)
    })

    it('should execute Open-Meteo Geocoding location search', async () => {
      const result = await geocodingAdapter.execute('search_location', { name: 'Nairobi' })
      assert.strictEqual(result.success, true)
      assert.strictEqual(result.isUntrustedData, true)
      const data = result.data as any
      assert.ok(data.matches.length > 0)
      assert.strictEqual(data.matches[0].name, 'Nairobi')
    })

    it('should execute Frankfurter Currency conversion', async () => {
      const result = await currencyAdapter.execute('convert_currency', { from: 'USD', to: 'EUR', amount: 100 })
      assert.strictEqual(result.success, true)
      assert.strictEqual(result.isUntrustedData, true)
      const data = result.data as any
      assert.strictEqual(data.base, 'USD')
      assert.ok(data.rates.EUR > 0)
    })

    it('should query OSV Vulnerabilities database for open source package', async () => {
      const result = await vulnerabilityAdapter.execute('query_package_vulnerabilities', {
        package_name: 'lodash',
        version: '4.17.15',
        ecosystem: 'npm',
      })
      assert.strictEqual(result.success, true)
      assert.strictEqual(result.isUntrustedData, true)
      const data = result.data as any
      assert.strictEqual(data.package, 'lodash')
      assert.ok(data.hasVulnerabilities === true)
      assert.ok(data.vulnerabilities.length > 0)
    })

    it('should query Free Dictionary API for word definitions', async () => {
      const result = await dictionaryAdapter.execute('define_word', { word: 'algorithm' })
      assert.strictEqual(result.isUntrustedData, true)
      if (result.success) {
        const data = result.data as any
        assert.strictEqual(data.found, true)
        assert.ok(data.meanings?.length > 0)
      } else {
        // Graceful handling of upstream network or rate limiting
        assert.ok(result.error)
      }
    })

    it('should query WorldTime API for timezone details', async () => {
      const result = await worldTimeAdapter.execute('get_timezone_time', { timezone: 'Africa/Nairobi' })
      assert.strictEqual(result.isUntrustedData, true)
      if (result.success) {
        const data = result.data as any
        assert.strictEqual(data.timezone, 'Africa/Nairobi')
        assert.strictEqual(data.utc_offset, '+03:00')
      } else {
        // Graceful handling of upstream network or rate limiting
        assert.ok(result.error)
      }
    })
  })

  // 5. SSRF & Network Security Defense
  describe('SSRF & Network Security Defense', () => {
    class MockAdapter extends BaseApiAdapter {
      id = 'mock-adapter'
      name = 'Mock'
      category = 'Test'
      description = 'Test'
      authType = 'none' as const
      baseUrl = 'http://localhost:8080'
      capabilities = ['test']
      priority = 1 as const
      async execute() {
        return this.wrapUntrustedResult('test', {}, 0)
      }
      async testFetch(url: string) {
        return await this.safeFetch(url)
      }
    }

    const mock = new MockAdapter()

    it('should block SSRF to localhost', async () => {
      await assert.rejects(
        async () => {
          await mock.testFetch('http://localhost:8787/health')
        },
        /SSRF Block/i,
      )
    })

    it('should block SSRF to 127.0.0.1 loopback', async () => {
      await assert.rejects(
        async () => {
          await mock.testFetch('http://127.0.0.1:8787')
        },
        /SSRF Block/i,
      )
    })

    it('should block SSRF to 169.254.169.254 cloud metadata', async () => {
      await assert.rejects(
        async () => {
          await mock.testFetch('http://169.254.169.254/latest/meta-data')
        },
        /SSRF Block/i,
      )
    })

    it('should block SSRF to private IP ranges (10.0.0.1, 192.168.1.1)', async () => {
      await assert.rejects(
        async () => {
          await mock.testFetch('http://192.168.1.1/admin')
        },
        /SSRF Block/i,
      )
      await assert.rejects(
        async () => {
          await mock.testFetch('http://10.0.0.1')
        },
        /SSRF Block/i,
      )
    })
  })

  // 6. Untrusted Data Wrapper & Secret Redaction
  describe('Untrusted Data Wrapper & Secret Protection', () => {
    it('should wrap external results with isUntrustedData flag', async () => {
      const res = await apiRegistry.execute('frankfurter-currency', 'convert_currency', { from: 'USD', to: 'EUR' })
      assert.strictEqual(res.isUntrustedData, true)
    })

    it('should redact sensitive tokens if returned in external responses', () => {
      const sample = 'API response contains api_key="sk-1234567890abcdef1234567890"'
      const sanitized = workspaceManager.redactSecrets(sample)
      assert.ok(!sanitized.includes('sk-1234567890abcdef1234567890'))
      assert.ok(sanitized.includes('[REDACTED]'))
    })
  })

  // 7. Planner Integration
  describe('Planner Integration for External APIs', () => {
    it('should create plan for vulnerability security audit', () => {
      const plan = planner.createPlan('Check whether dependencies in my project have known vulnerabilities')
      assert.ok(plan.steps.length >= 4)
      const tools = plan.steps.map((s) => s.tool)
      assert.ok(tools.includes('read_file'))
      assert.ok(tools.includes('query_external_api'))
      assert.ok(tools.includes('blade'))
    })

    it('should create plan for weather forecast', () => {
      const plan = planner.createPlan('What is the weather forecast for Nairobi today?')
      assert.ok(plan.steps.length >= 3)
      const tools = plan.steps.map((s) => s.tool)
      assert.ok(tools.includes('query_external_api'))
    })
  })

  // 8. Tool Registry External Tools
  describe('Tool Registry Tool Declarations', () => {
    it('should have all 4 external API tools registered', () => {
      const toolNames = toolRegistry.getToolNames()
      assert.ok(toolNames.includes('discover_apis'))
      assert.ok(toolNames.includes('query_external_api'))
      assert.ok(toolNames.includes('get_api_status'))
      assert.ok(toolNames.includes('configure_api_credential'))
    })

    it('should execute discover_apis tool', async () => {
      const res = await toolRegistry.executeTool('discover_apis', { query: 'weather' })
      assert.strictEqual(res.success, true)
      const data = res.data as any
      assert.ok(data.count > 0)
      assert.ok(data.apis.some((a: any) => a.id === 'open-meteo-weather'))
    })

    it('should execute query_external_api tool safely', async () => {
      const res = await toolRegistry.executeTool('query_external_api', {
        provider: 'frankfurter-currency',
        operation: 'convert_currency',
        parameters: { from: 'EUR', to: 'USD', amount: 50 },
      })
      assert.strictEqual(res.success, true)
      const data = res.data as any
      assert.strictEqual(data.success, true)
      assert.strictEqual(data.isUntrustedData, true)
    })
  })
})
