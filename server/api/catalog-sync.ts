import { resolve } from 'node:path'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { sandbox } from '../security/sandbox.js'
import type { ApiCatalogEntry, ApiAuthType, ApiAdapterStatus } from './types.js'

/**
 * Built-in Curated Snapshot of Public APIs (from public-apis catalog)
 * Ensures GACKS operates reliably out of the box with zero external dependencies.
 */
const INITIAL_CURATED_CATALOG: ApiCatalogEntry[] = [
  // --- Weather & Environment ---
  {
    id: 'open-meteo-weather',
    name: 'Open-Meteo Weather',
    description: 'Free open-source weather forecast API with hourly temperature, wind, and atmospheric conditions.',
    category: 'Weather',
    authType: 'none',
    https: true,
    cors: 'yes',
    documentationUrl: 'https://open-meteo.com/en/docs',
    baseUrl: 'https://api.open-meteo.com/v1',
    adapterStatus: 'installed',
    priority: 1,
    capabilities: ['weather', 'forecast', 'temperature', 'climate', 'atmospheric'],
    provider: 'Open-Meteo',
  },
  {
    id: 'open-meteo-geocoding',
    name: 'Open-Meteo Geocoding',
    description: 'Fast global geocoding API to convert city names and regions into latitude, longitude, and timezone.',
    category: 'Geocoding',
    authType: 'none',
    https: true,
    cors: 'yes',
    documentationUrl: 'https://open-meteo.com/en/docs/geocoding-api',
    baseUrl: 'https://geocoding-api.open-meteo.com/v1',
    adapterStatus: 'installed',
    priority: 1,
    capabilities: ['geocoding', 'coordinates', 'location', 'city_lookup', 'timezone'],
    provider: 'Open-Meteo',
  },
  {
    id: 'national-weather-service',
    name: 'National Weather Service',
    description: 'Official US National Weather Service forecasts, active weather warnings, and radar alerts.',
    category: 'Weather',
    authType: 'User-Agent',
    https: true,
    cors: 'yes',
    documentationUrl: 'https://www.weather.gov/documentation/services-web-api',
    baseUrl: 'https://api.weather.gov',
    adapterStatus: 'catalog_only',
    priority: 1,
    capabilities: ['weather', 'us_forecast', 'severe_weather', 'alerts'],
    provider: 'NOAA',
  },

  // --- Finance & Currency ---
  {
    id: 'frankfurter-currency',
    name: 'Frankfurter Exchange Rates',
    description: 'European Central Bank reference foreign exchange rates and instant multi-currency conversion.',
    category: 'Currency Exchange',
    authType: 'none',
    https: true,
    cors: 'yes',
    documentationUrl: 'https://www.frankfurter.app/docs/',
    baseUrl: 'https://api.frankfurter.app',
    adapterStatus: 'installed',
    priority: 1,
    capabilities: ['currency', 'exchange_rates', 'forex', 'conversion', 'ecb'],
    provider: 'Frankfurter',
  },
  {
    id: 'coingecko',
    name: 'CoinGecko API',
    description: 'Comprehensive cryptocurrency market data, coin prices, volumes, and market capitalization.',
    category: 'Cryptocurrency',
    authType: 'none',
    https: true,
    cors: 'yes',
    documentationUrl: 'https://www.coingecko.com/en/api/documentation',
    baseUrl: 'https://api.coingecko.com/api/v3',
    adapterStatus: 'catalog_only',
    priority: 1,
    capabilities: ['crypto', 'bitcoin', 'ethereum', 'token_prices', 'market_cap'],
    provider: 'CoinGecko',
  },

  // --- Development, Code & Security ---
  {
    id: 'osv-vulnerabilities',
    name: 'OSV Open Source Vulnerabilities',
    description: 'Distributed open-source vulnerability database API by Google covering npm, PyPI, Go, and Maven.',
    category: 'Development',
    authType: 'none',
    https: true,
    cors: 'yes',
    documentationUrl: 'https://osv.dev/docs/',
    baseUrl: 'https://api.osv.dev/v1',
    adapterStatus: 'installed',
    priority: 1,
    capabilities: ['security', 'vulnerabilities', 'cve', 'dependencies', 'audit', 'npm', 'packages'],
    provider: 'Google Open Source Security',
  },
  {
    id: 'github-api',
    name: 'GitHub Public API',
    description: 'Inspect repositories, commits, releases, issues, and metadata on GitHub.',
    category: 'Development',
    authType: 'apiKey',
    https: true,
    cors: 'yes',
    documentationUrl: 'https://docs.github.com/en/rest',
    baseUrl: 'https://api.github.com',
    adapterStatus: 'installed',
    priority: 2,
    capabilities: ['github', 'git', 'repositories', 'code', 'pull_requests', 'releases'],
    provider: 'GitHub Inc',
  },
  {
    id: 'npm-registry',
    name: 'npm Registry API',
    description: 'Query metadata, version history, and dependencies for packages published to npm.',
    category: 'Development',
    authType: 'none',
    https: true,
    cors: 'yes',
    documentationUrl: 'https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md',
    baseUrl: 'https://registry.npmjs.org',
    adapterStatus: 'catalog_only',
    priority: 1,
    capabilities: ['npm', 'packages', 'javascript', 'dependencies'],
    provider: 'npm / GitHub',
  },

  // --- Dictionaries & Language ---
  {
    id: 'free-dictionary',
    name: 'Free Dictionary API',
    description: 'Comprehensive English definitions, phonetics, parts of speech, synonyms, and etymology.',
    category: 'Dictionaries',
    authType: 'none',
    https: true,
    cors: 'yes',
    documentationUrl: 'https://dictionaryapi.dev/',
    baseUrl: 'https://api.dictionaryapi.dev/api/v2/entries/en',
    adapterStatus: 'installed',
    priority: 1,
    capabilities: ['dictionary', 'definitions', 'etymology', 'phonetics', 'thesaurus', 'synonyms'],
    provider: 'Free Dictionary API',
  },
  {
    id: 'libre-translate',
    name: 'LibreTranslate',
    description: 'Free and open-source machine translation engine supporting major languages.',
    category: 'Translation',
    authType: 'apiKey',
    https: true,
    cors: 'yes',
    documentationUrl: 'https://libretranslate.com/docs/',
    baseUrl: 'https://libretranslate.com',
    adapterStatus: 'catalog_only',
    priority: 2,
    capabilities: ['translation', 'language', 'multilingual'],
    provider: 'LibreTranslate',
  },

  // --- Time & Calendar ---
  {
    id: 'world-time-api',
    name: 'World Time API',
    description: 'Accurate timezone lookup, UTC offsets, daylight saving status, and current astronomical timestamps.',
    category: 'Calendar',
    authType: 'none',
    https: true,
    cors: 'yes',
    documentationUrl: 'http://worldtimeapi.org/',
    baseUrl: 'https://worldtimeapi.org/api',
    adapterStatus: 'installed',
    priority: 1,
    capabilities: ['time', 'timezone', 'clock', 'date', 'utc_offset', 'dst'],
    provider: 'WorldTimeAPI',
  },
  {
    id: 'nager-date-holidays',
    name: 'Nager.Date Public Holidays',
    description: 'Worldwide public holiday schedules and statutory days off for over 100 countries.',
    category: 'Calendar',
    authType: 'none',
    https: true,
    cors: 'yes',
    documentationUrl: 'https://date.nager.at/Api',
    baseUrl: 'https://date.nager.at/api/v3',
    adapterStatus: 'catalog_only',
    priority: 1,
    capabilities: ['holidays', 'calendar', 'statutory_days', 'events'],
    provider: 'Nager.Date',
  },

  // --- Science & Space ---
  {
    id: 'nasa-open-apis',
    name: 'NASA Open APIs',
    description: 'Imagery and data from NASA missions including Astronomy Picture of the Day (APOD) and Mars Rovers.',
    category: 'Science',
    authType: 'apiKey',
    https: true,
    cors: 'yes',
    documentationUrl: 'https://api.nasa.gov/',
    baseUrl: 'https://api.nasa.gov',
    adapterStatus: 'catalog_only',
    priority: 2,
    capabilities: ['space', 'astronomy', 'mars', 'nasa', 'astronomy_picture'],
    provider: 'NASA',
  },

  // --- News & Information ---
  {
    id: 'news-api',
    name: 'NewsAPI',
    description: 'Search global breaking news articles and headlines from 80,000+ publishers.',
    category: 'News',
    authType: 'apiKey',
    https: true,
    cors: 'yes',
    documentationUrl: 'https://newsapi.org/docs',
    baseUrl: 'https://newsapi.org/v2',
    adapterStatus: 'catalog_only',
    priority: 2,
    capabilities: ['news', 'headlines', 'journalism', 'breaking_news', 'press'],
    provider: 'NewsAPI.org',
  },

  // --- Open Data & Demographics ---
  {
    id: 'rest-countries',
    name: 'REST Countries',
    description: 'Detailed information about world nations including capitals, currencies, languages, flags, and populations.',
    category: 'Open Data',
    authType: 'none',
    https: true,
    cors: 'yes',
    documentationUrl: 'https://restcountries.com/',
    baseUrl: 'https://restcountries.com/v3.1',
    adapterStatus: 'catalog_only',
    priority: 1,
    capabilities: ['countries', 'geography', 'demographics', 'flags', 'capitals'],
    provider: 'REST Countries',
  },
  {
    id: 'ipapi-network',
    name: 'ipapi IP Geolocation',
    description: 'IP address geolocation, ASN, ISP identification, and location metadata.',
    category: 'Open Data',
    authType: 'none',
    https: true,
    cors: 'yes',
    documentationUrl: 'https://ipapi.co/api/',
    baseUrl: 'https://ipapi.co',
    adapterStatus: 'catalog_only',
    priority: 1,
    capabilities: ['ip_lookup', 'geolocation', 'asn', 'network'],
    provider: 'ipapi.co',
  },
]

export class CatalogSyncService {
  private catalogFile: string
  private entries: Map<string, ApiCatalogEntry> = new Map()
  private lastSyncedAt = 0

  constructor() {
    this.catalogFile = resolve(process.cwd(), 'data', 'api-catalog.json')
    this.loadCatalog()
  }

  private async loadCatalog() {
    // 1. Preload curated entries
    for (const entry of INITIAL_CURATED_CATALOG) {
      this.entries.set(entry.id, entry)
    }

    // 2. Load cached local entries if existing
    try {
      if (existsSync(this.catalogFile)) {
        const raw = await readFile(this.catalogFile, 'utf-8')
        const data = JSON.parse(raw)
        if (Array.isArray(data.entries)) {
          for (const item of data.entries) {
            const validated = this.validateAndNormalizeEntry(item)
            if (validated) {
              // Preserve installed adapter status if exists locally
              const existing = this.entries.get(validated.id)
              if (existing?.adapterStatus === 'installed') {
                validated.adapterStatus = 'installed'
              }
              this.entries.set(validated.id, validated)
            }
          }
          this.lastSyncedAt = Number(data.lastSyncedAt) || Date.now()
        }
      }
    } catch {}
  }

  /**
   * Strictly validate and normalize a candidate API entry.
   * Discards malformed or unsafe items.
   */
  public validateAndNormalizeEntry(raw: any): ApiCatalogEntry | null {
    if (!raw || typeof raw !== 'object') return null
    const name = String(raw.name || raw.API || '').trim()
    const description = String(raw.description || raw.Description || '').trim()
    const category = String(raw.category || raw.Category || '').trim()
    if (!name || !description || !category) return null

    const id = (raw.id && typeof raw.id === 'string' ? raw.id : name.toLowerCase().replace(/[^a-z0-9]+/g, '-')).replace(/^-|-$/g, '')
    if (!id) return null

    // Validate documentation URL
    const docUrl = String(raw.documentationUrl || raw.Link || raw.url || '').trim()
    const urlValidation = sandbox.validateSafeUrl(docUrl)
    if (!urlValidation.valid) {
      // Must have a parseable http/https URL
      return null
    }

    // Auth normalization
    let authType: ApiAuthType = 'none'
    const rawAuth = String(raw.authType || raw.Auth || '').trim().toLowerCase()
    if (rawAuth.includes('oauth')) authType = 'OAuth'
    else if (rawAuth.includes('key') || rawAuth.includes('token') || rawAuth.includes('apikey')) authType = 'apiKey'
    else if (rawAuth.includes('user-agent')) authType = 'User-Agent'
    else if (rawAuth && rawAuth !== 'no' && rawAuth !== 'none') authType = 'custom'

    const https = raw.https === true || String(raw.HTTPS || '').toLowerCase() === 'yes' || docUrl.startsWith('https://')
    const cors = (String(raw.cors || raw.Cors || '').toLowerCase() === 'yes' ? 'yes' : 'no') as 'yes' | 'no'

    // Priority computation
    let priority: 1 | 2 | 3 | 4 = 1
    if (authType === 'apiKey') priority = 2
    else if (authType === 'OAuth') priority = 3
    else if (authType === 'custom') priority = 4

    const capabilities = Array.isArray(raw.capabilities)
      ? raw.capabilities.map((c: any) => String(c).toLowerCase().trim()).filter(Boolean)
      : [category.toLowerCase().trim(), ...name.toLowerCase().split(/\s+/)]

    const adapterStatus: ApiAdapterStatus = raw.adapterStatus === 'installed' ? 'installed' : 'catalog_only'

    return {
      id,
      name,
      description,
      category,
      authType,
      https,
      cors,
      documentationUrl: docUrl,
      baseUrl: raw.baseUrl && typeof raw.baseUrl === 'string' ? raw.baseUrl.trim() : undefined,
      adapterStatus,
      priority,
      capabilities,
      provider: raw.provider ? String(raw.provider).trim() : undefined,
    }
  }

  public async saveCatalog() {
    try {
      const dir = resolve(process.cwd(), 'data')
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true })
      }
      const data = {
        lastSyncedAt: Date.now(),
        count: this.entries.size,
        entries: Array.from(this.entries.values()),
      }
      await writeFile(this.catalogFile, JSON.stringify(data, null, 2), 'utf-8')
      this.lastSyncedAt = data.lastSyncedAt
    } catch {}
  }

  /**
   * Synchronize catalog from remote public-apis source with validation.
   */
  public async syncFromRemote(): Promise<{ added: number; total: number; lastSyncedAt: number }> {
    let added = 0
    try {
      // Primary raw source: public-apis JSON mirror
      const response = await fetch('https://api.publicapis.org/entries', {
        headers: { 'User-Agent': 'GACKS-AI-Operator/2.0' },
        signal: AbortSignal.timeout(8000),
      })

      if (response.ok) {
        const payload = await response.json()
        if (Array.isArray(payload.entries)) {
          for (const item of payload.entries) {
            const entry = this.validateAndNormalizeEntry({
              name: item.API,
              description: item.Description,
              category: item.Category,
              Auth: item.Auth,
              HTTPS: item.HTTPS,
              Cors: item.Cors,
              Link: item.Link,
            })
            if (entry && !this.entries.has(entry.id)) {
              this.entries.set(entry.id, entry)
              added++
            }
          }
        }
      }
    } catch {
      // Network unreachable or mirror unavailable: curated catalog remains preserved
    }

    await this.saveCatalog()
    return {
      added,
      total: this.entries.size,
      lastSyncedAt: this.lastSyncedAt,
    }
  }

  public getEntries(): ApiCatalogEntry[] {
    return Array.from(this.entries.values())
  }

  public getEntry(id: string): ApiCatalogEntry | undefined {
    return this.entries.get(id.toLowerCase().trim())
  }

  public getCategories(): Array<{ name: string; count: number }> {
    const counts = new Map<string, number>()
    for (const entry of this.entries.values()) {
      const cat = entry.category
      counts.set(cat, (counts.get(cat) || 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }

  public setInstalledAdapter(id: string, adapterStatus: ApiAdapterStatus) {
    const entry = this.entries.get(id)
    if (entry) {
      entry.adapterStatus = adapterStatus
    }
  }
}

export const catalogSync = new CatalogSyncService()
