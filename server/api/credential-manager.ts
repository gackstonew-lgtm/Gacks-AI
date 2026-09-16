import { resolve } from 'node:path'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { ApiCredential, ApiAuthType } from './types.js'

export class CredentialManager {
  private credentials: Map<string, ApiCredential> = new Map()
  private storageFile: string

  constructor() {
    this.storageFile = resolve(process.cwd(), 'data', 'credentials.json')
    this.loadCredentials()
  }

  private async loadCredentials() {
    try {
      if (existsSync(this.storageFile)) {
        const raw = await readFile(this.storageFile, 'utf-8')
        const data = JSON.parse(raw)
        if (Array.isArray(data)) {
          for (const cred of data) {
            if (cred.providerId) {
              this.credentials.set(cred.providerId, cred)
            }
          }
        }
      }
    } catch {}
  }

  public async saveCredentials() {
    try {
      const dir = resolve(process.cwd(), 'data')
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true })
      }
      await writeFile(
        this.storageFile,
        JSON.stringify(Array.from(this.credentials.values()), null, 2),
        'utf-8',
      )
    } catch {}
  }

  /**
   * Set or update credential for a specific provider.
   * Isolated per providerId.
   */
  public async setCredential(
    providerId: string,
    providerName: string,
    authType: ApiAuthType,
    params: {
      apiKey?: string
      oauthToken?: string
      refreshToken?: string
      expiresAt?: number
      customHeaders?: Record<string, string>
    },
  ): Promise<ApiCredential> {
    if (!providerId || typeof providerId !== 'string') {
      throw new Error('Valid providerId is required.')
    }

    const cleanKey = params.apiKey ? params.apiKey.trim() : undefined
    const cleanToken = params.oauthToken ? params.oauthToken.trim() : undefined

    if (authType === 'apiKey' && !cleanKey) {
      throw new Error('API key cannot be empty.')
    }

    const credential: ApiCredential = {
      providerId: providerId.toLowerCase().trim(),
      providerName: providerName.trim() || providerId,
      authType,
      apiKey: cleanKey,
      oauthToken: cleanToken,
      refreshToken: params.refreshToken?.trim(),
      expiresAt: params.expiresAt,
      customHeaders: params.customHeaders,
      updatedAt: Date.now(),
    }

    this.credentials.set(credential.providerId, credential)
    await this.saveCredentials()
    return credential
  }

  /**
   * Retrieve isolated credential for an authorized provider adapter only.
   */
  public getCredential(providerId: string): ApiCredential | undefined {
    if (!providerId) return undefined
    return this.credentials.get(providerId.toLowerCase().trim())
  }

  public hasCredential(providerId: string): boolean {
    const cred = this.getCredential(providerId)
    if (!cred) return false
    if (cred.authType === 'apiKey') return Boolean(cred.apiKey)
    if (cred.authType === 'OAuth') return Boolean(cred.oauthToken)
    return true
  }

  public async deleteCredential(providerId: string): Promise<boolean> {
    const deleted = this.credentials.delete(providerId.toLowerCase().trim())
    if (deleted) {
      await this.saveCredentials()
    }
    return deleted
  }

  /**
   * Return safe, masked credential representations for UI display.
   * Never exposes full secrets.
   */
  public getMaskedCredentials(): Array<{
    providerId: string
    providerName: string
    authType: ApiAuthType
    configured: boolean
    maskedKey?: string
    updatedAt: number
  }> {
    return Array.from(this.credentials.values()).map((c) => {
      let maskedKey: string | undefined
      if (c.apiKey) {
        if (c.apiKey.length <= 8) {
          maskedKey = '••••••••'
        } else {
          maskedKey = `${c.apiKey.slice(0, 4)}••••${c.apiKey.slice(-4)}`
        }
      } else if (c.oauthToken) {
        maskedKey = 'OAuth Connected (Token Active)'
      }

      return {
        providerId: c.providerId,
        providerName: c.providerName,
        authType: c.authType,
        configured: Boolean(c.apiKey || c.oauthToken),
        maskedKey,
        updatedAt: c.updatedAt,
      }
    })
  }
}

export const credentialManager = new CredentialManager()
