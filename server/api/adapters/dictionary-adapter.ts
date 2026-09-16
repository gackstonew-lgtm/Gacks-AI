import { BaseApiAdapter } from './base-adapter.js'
import type { ApiAuthType, ApiAdapterContext, ApiExecutionResult } from '../types.js'

export class DictionaryAdapter extends BaseApiAdapter {
  id = 'free-dictionary'
  name = 'Free Dictionary API'
  category = 'Dictionaries'
  description = 'English word definitions, phonetics, origins, parts of speech, and synonyms.'
  authType: ApiAuthType = 'none'
  baseUrl = 'https://api.dictionaryapi.dev/api/v2/entries/en'
  capabilities = ['dictionary', 'definitions', 'etymology', 'phonetics', 'thesaurus', 'synonyms', 'word_lookup']
  priority = 1 as const

  async execute(
    operation: string,
    params: Record<string, unknown>,
    context?: ApiAdapterContext,
  ): Promise<ApiExecutionResult> {
    const start = Date.now()
    const word = String(params.word || params.term || '').toLowerCase().trim()

    if (!word) {
      return {
        success: false,
        provider: this.name,
        operation: operation || 'define_word',
        durationMs: 0,
        error: 'Parameter "word" is required for dictionary lookup.',
        isUntrustedData: true,
      }
    }

    try {
      const url = `${this.baseUrl}/${encodeURIComponent(word)}`
      const res = await this.safeFetch(url, { timeoutMs: 4000 }, context)

      if (!res.ok) {
        if (res.status === 404) {
          return this.wrapUntrustedResult(
            operation || 'define_word',
            { word, found: false, message: `No definitions found for '${word}'.` },
            Date.now() - start,
            404,
          )
        }
        return {
          success: false,
          provider: this.name,
          operation: operation || 'define_word',
          durationMs: Date.now() - start,
          statusCode: res.status,
          error: `Dictionary query failed (HTTP ${res.status}): ${res.rawText.slice(0, 150)}`,
          isUntrustedData: true,
        }
      }

      const entries = Array.isArray(res.data) ? res.data : [res.data]
      const primary = entries[0] || {}

      const meanings = (primary.meanings || []).map((m: any) => ({
        partOfSpeech: m.partOfSpeech,
        definitions: (m.definitions || []).slice(0, 3).map((d: any) => ({
          definition: d.definition,
          example: d.example,
        })),
        synonyms: (m.synonyms || []).slice(0, 5),
      }))

      return this.wrapUntrustedResult(
        operation || 'define_word',
        {
          word: primary.word || word,
          phonetic: primary.phonetic,
          meanings,
          found: true,
        },
        Date.now() - start,
        res.status,
      )
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        operation: operation || 'define_word',
        durationMs: Date.now() - start,
        error: `Dictionary service network error: ${err.message}`,
        isUntrustedData: true,
      }
    }
  }
}

export const dictionaryAdapter = new DictionaryAdapter()
