import { BaseApiAdapter } from './base-adapter.js'
import type { ApiAuthType, ApiAdapterContext, ApiExecutionResult } from '../types.js'

export class WorldTimeAdapter extends BaseApiAdapter {
  id = 'world-time-api'
  name = 'World Time API'
  category = 'Calendar'
  description = 'Precise timezone lookup, UTC offsets, daylight saving time, and atomic timestamps.'
  authType: ApiAuthType = 'none'
  baseUrl = 'https://worldtimeapi.org/api/timezone'
  capabilities = ['time', 'timezone', 'clock', 'date', 'utc_offset', 'dst', 'astronomical_time']
  priority = 1 as const

  async execute(
    operation: string,
    params: Record<string, unknown>,
    context?: ApiAdapterContext,
  ): Promise<ApiExecutionResult> {
    const start = Date.now()
    const tz = String(params.timezone || params.zone || 'Africa/Nairobi').trim()
    const url = `${this.baseUrl}/${tz}`

    try {
      const res = await this.safeFetch(url, { timeoutMs: 5000 }, context)
      if (!res.ok) {
        return {
          success: false,
          provider: this.name,
          operation: operation || 'get_timezone_time',
          durationMs: Date.now() - start,
          statusCode: res.status,
          error: `World Time API error (HTTP ${res.status}): ${res.rawText.slice(0, 150)}`,
          isUntrustedData: true,
        }
      }

      const data = res.data || {}
      const summarized = {
        timezone: data.timezone || tz,
        datetime: data.datetime,
        utc_offset: data.utc_offset,
        day_of_week: data.day_of_week,
        day_of_year: data.day_of_year,
        dst: Boolean(data.dst),
        week_number: data.week_number,
      }

      return this.wrapUntrustedResult(operation || 'get_timezone_time', summarized, Date.now() - start, res.status)
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        operation: operation || 'get_timezone_time',
        durationMs: Date.now() - start,
        error: `World Time network error: ${err.message}`,
        isUntrustedData: true,
      }
    }
  }
}

export const worldTimeAdapter = new WorldTimeAdapter()
