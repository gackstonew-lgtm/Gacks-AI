import { BaseApiAdapter } from './base-adapter.js'
import type { ApiAuthType, ApiAdapterContext, ApiExecutionResult } from '../types.js'

export class WeatherAdapter extends BaseApiAdapter {
  id = 'open-meteo-weather'
  name = 'Open-Meteo Weather'
  category = 'Weather'
  description = 'Global high-resolution weather forecast and current atmospheric conditions.'
  authType: ApiAuthType = 'none'
  baseUrl = 'https://api.open-meteo.com/v1/forecast'
  capabilities = ['weather', 'forecast', 'temperature', 'climate', 'atmospheric', 'rain', 'wind']
  priority = 1 as const

  async execute(
    operation: string,
    params: Record<string, unknown>,
    context?: ApiAdapterContext,
  ): Promise<ApiExecutionResult> {
    const start = Date.now()
    const lat = Number(params.latitude ?? params.lat ?? -1.2921) // Default: Nairobi
    const lon = Number(params.longitude ?? params.lon ?? 36.8219)
    const timezone = String(params.timezone || 'auto')

    const queryUrl = new URL(this.baseUrl)
    queryUrl.searchParams.set('latitude', String(lat))
    queryUrl.searchParams.set('longitude', String(lon))
    queryUrl.searchParams.set('current', 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m')
    queryUrl.searchParams.set('hourly', 'temperature_2m,precipitation_probability')
    queryUrl.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset')
    queryUrl.searchParams.set('timezone', timezone)

    const res = await this.safeFetch(queryUrl.toString(), {}, context)
    if (!res.ok) {
      return {
        success: false,
        provider: this.name,
        operation: operation || 'get_forecast',
        durationMs: Date.now() - start,
        statusCode: res.status,
        error: `Weather provider error (HTTP ${res.status}): ${res.rawText.slice(0, 150)}`,
        isUntrustedData: true,
      }
    }

    const current = res.data?.current || {}
    const daily = res.data?.daily || {}

    const summarized = {
      location: { latitude: lat, longitude: lon, timezone: res.data?.timezone },
      current: {
        temperature: `${current.temperature_2m} °C`,
        feelsLike: `${current.apparent_temperature} °C`,
        humidity: `${current.relative_humidity_2m} %`,
        precipitation: `${current.precipitation} mm`,
        windSpeed: `${current.wind_speed_10m} km/h`,
      },
      forecast: {
        maxTemp: daily.temperature_2m_max?.[0] ? `${daily.temperature_2m_max[0]} °C` : undefined,
        minTemp: daily.temperature_2m_min?.[0] ? `${daily.temperature_2m_min[0]} °C` : undefined,
      },
      elevation: res.data?.elevation,
    }

    return this.wrapUntrustedResult(operation || 'get_forecast', summarized, Date.now() - start, res.status)
  }
}

export const weatherAdapter = new WeatherAdapter()
