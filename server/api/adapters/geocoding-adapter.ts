import { BaseApiAdapter } from './base-adapter.js'
import type { ApiAuthType, ApiAdapterContext, ApiExecutionResult } from '../types.js'

export class GeocodingAdapter extends BaseApiAdapter {
  id = 'open-meteo-geocoding'
  name = 'Open-Meteo Geocoding'
  category = 'Geocoding'
  description = 'Resolves city and place names into latitude, longitude, country, and timezone.'
  authType: ApiAuthType = 'none'
  baseUrl = 'https://geocoding-api.open-meteo.com/v1/search'
  capabilities = ['geocoding', 'coordinates', 'location', 'city_lookup', 'places', 'timezone']
  priority = 1 as const

  async execute(
    operation: string,
    params: Record<string, unknown>,
    context?: ApiAdapterContext,
  ): Promise<ApiExecutionResult> {
    const start = Date.now()
    const query = String(params.name || params.query || params.city || '').trim()

    if (!query) {
      return {
        success: false,
        provider: this.name,
        operation: operation || 'search_location',
        durationMs: 0,
        error: 'Parameter "name" or "city" is required for geocoding lookup.',
        isUntrustedData: true,
      }
    }

    const count = Math.min(Number(params.count || 5), 10)
    const queryUrl = new URL(this.baseUrl)
    queryUrl.searchParams.set('name', query)
    queryUrl.searchParams.set('count', String(count))
    queryUrl.searchParams.set('language', 'en')
    queryUrl.searchParams.set('format', 'json')

    const res = await this.safeFetch(queryUrl.toString(), {}, context)
    if (!res.ok) {
      return {
        success: false,
        provider: this.name,
        operation: operation || 'search_location',
        durationMs: Date.now() - start,
        statusCode: res.status,
        error: `Geocoding provider error (HTTP ${res.status}): ${res.rawText.slice(0, 150)}`,
        isUntrustedData: true,
      }
    }

    const results = (res.data?.results || []).map((item: any) => ({
      name: item.name,
      latitude: item.latitude,
      longitude: item.longitude,
      country: item.country,
      admin1: item.admin1, // State / Region
      timezone: item.timezone,
      population: item.population,
    }))

    return this.wrapUntrustedResult(
      operation || 'search_location',
      { query, count: results.length, matches: results },
      Date.now() - start,
      res.status,
    )
  }
}

export const geocodingAdapter = new GeocodingAdapter()
