import { BaseApiAdapter } from './base-adapter.js'
import type { ApiAuthType, ApiAdapterContext, ApiExecutionResult } from '../types.js'

export class CurrencyAdapter extends BaseApiAdapter {
  id = 'frankfurter-currency'
  name = 'Frankfurter Exchange Rates'
  category = 'Currency Exchange'
  description = 'European Central Bank reference foreign exchange rates and currency conversion.'
  authType: ApiAuthType = 'none'
  baseUrl = 'https://api.frankfurter.app'
  capabilities = ['currency', 'exchange_rates', 'forex', 'conversion', 'usd', 'eur', 'gbp', 'kes']
  priority = 1 as const

  async execute(
    operation: string,
    params: Record<string, unknown>,
    context?: ApiAdapterContext,
  ): Promise<ApiExecutionResult> {
    const start = Date.now()
    const from = String(params.from || params.base || 'USD').toUpperCase().trim()
    const to = params.to ? String(params.to).toUpperCase().trim() : undefined
    const amount = Number(params.amount ?? 1)

    let url: string
    if (to) {
      url = `${this.baseUrl}/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&amount=${amount}`
    } else {
      url = `${this.baseUrl}/latest?from=${encodeURIComponent(from)}`
    }

    const res = await this.safeFetch(url, {}, context)
    if (!res.ok) {
      return {
        success: false,
        provider: this.name,
        operation: operation || 'convert_currency',
        durationMs: Date.now() - start,
        statusCode: res.status,
        error: `Currency exchange error (HTTP ${res.status}): ${res.rawText.slice(0, 150)}`,
        isUntrustedData: true,
      }
    }

    const payload = res.data || {}
    return this.wrapUntrustedResult(
      operation || 'convert_currency',
      {
        base: payload.base || from,
        date: payload.date,
        amount: payload.amount || amount,
        rates: payload.rates || {},
      },
      Date.now() - start,
      res.status,
    )
  }
}

export const currencyAdapter = new CurrencyAdapter()
