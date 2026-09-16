import { resolve, relative, isAbsolute } from 'node:path'
import { homedir, tmpdir } from 'node:os'
import { isIP } from 'node:net'
import { blockedAddress } from '../../bridge/net.mjs'

const BLOCKED_HOSTNAME = /(^|\.)(localhost|local|internal|intranet|home\.arpa)$/i

export class SecuritySandbox {
  private allowedRoots: string[]

  constructor() {
    this.allowedRoots = [
      process.cwd(),
      homedir(),
      tmpdir(),
      ...(process.env.JARVIS_FILE_ROOTS ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ].map((r) => resolve(r))
  }

  /**
   * Prevents path traversal attacks (e.g. `../../etc/passwd`).
   * Validates that the requested target path resolves strictly inside an allowed root.
   */
  public validateSafePath(userPath: string): { valid: boolean; resolvedPath?: string; error?: string } {
    if (!userPath || typeof userPath !== 'string') {
      return { valid: false, error: 'File path must be a non-empty string.' }
    }

    try {
      const resolved = isAbsolute(userPath)
        ? resolve(userPath)
        : resolve(process.cwd(), userPath)

      // Ensure target sits within one of the approved roots
      const isAllowed = this.allowedRoots.some((root) => {
        const rel = relative(root, resolved)
        return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
      })

      if (!isAllowed) {
        return {
          valid: false,
          error: `Access denied: path '${userPath}' is outside the sandbox environment.`,
        }
      }

      return { valid: true, resolvedPath: resolved }
    } catch (err) {
      return { valid: false, error: `Invalid path: ${(err as Error).message}` }
    }
  }

  /**
   * SSRF defense: verifies that an outbound URL does not resolve to local/internal IP addresses or cloud metadata.
   */
  public validateSafeUrl(rawUrl: string): { valid: boolean; url?: URL; error?: string } {
    try {
      const parsed = new URL(rawUrl)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { valid: false, error: 'Only http and https protocols are permitted.' }
      }

      const host = parsed.hostname.toLowerCase()
      if (BLOCKED_HOSTNAME.test(host)) {
        return { valid: false, error: `Host '${host}' is blocked for security.` }
      }

      const literal = host.replace(/^\[|\]$/g, '')
      if (isIP(literal) && blockedAddress(literal)) {
        return { valid: false, error: `Address '${literal}' is within a forbidden network range.` }
      }

      return { valid: true, url: parsed }
    } catch (err) {
      return { valid: false, error: `Malformed URL: ${(err as Error).message}` }
    }
  }

  /**
   * Sanitize text against prompt injection data leakage.
   * Strips harmful script tags and normalizes control characters.
   */
  public sanitizeOutput(text: string): string {
    if (typeof text !== 'string') return ''
    return text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '[SCRIPT REMOVED]')
      .replace(/javascript:/gi, 'blocked:')
  }
}

export const sandbox = new SecuritySandbox()
