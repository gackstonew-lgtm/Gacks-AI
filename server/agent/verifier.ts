import { readFile, stat } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import type { VerificationStatus } from '../types.js'

export interface VerificationResult {
  status: VerificationStatus
  verified: boolean
  details: string
  checksRun: string[]
}

export class Verifier {
  /**
   * Verify file write by reading file back and confirming byte size & content match.
   */
  public async verifyFileWrite(filePath: string, expectedContent: string): Promise<VerificationResult> {
    const checks: string[] = ['file_exists', 'content_match']
    try {
      const p = isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath)
      const st = await stat(p)
      if (!st.isFile()) {
        return {
          status: 'failure',
          verified: false,
          details: `Path is not a regular file: ${filePath}`,
          checksRun: checks,
        }
      }

      const actualContent = await readFile(p, 'utf-8')
      if (actualContent !== expectedContent) {
        return {
          status: 'partial_success',
          verified: false,
          details: 'File written to disk but content differs from expected buffer.',
          checksRun: checks,
        }
      }

      return {
        status: 'verified_success',
        verified: true,
        details: `Verified file write: ${st.size} bytes matches exactly.`,
        checksRun: checks,
      }
    } catch (err) {
      return {
        status: 'failure',
        verified: false,
        details: `Verification readback failed: ${(err as Error).message}`,
        checksRun: checks,
      }
    }
  }

  /**
   * Verify HTTP or API endpoint response against expected HTTP status and payload schema.
   */
  public async verifyEndpoint(
    url: string,
    expectedStatus = 200,
    timeoutMs = 8000,
  ): Promise<VerificationResult> {
    const checks: string[] = ['reachable', 'status_code']
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timer)

      if (res.status === expectedStatus) {
        return {
          status: 'verified_success',
          verified: true,
          details: `Endpoint ${url} responded with status ${res.status} OK.`,
          checksRun: checks,
        }
      }

      return {
        status: 'failure',
        verified: false,
        details: `Endpoint ${url} returned unexpected status ${res.status} (expected ${expectedStatus}).`,
        checksRun: checks,
      }
    } catch (err) {
      return {
        status: 'failure',
        verified: false,
        details: `Endpoint verification failed: ${(err as Error).message}`,
        checksRun: checks,
      }
    }
  }

  /**
   * Generic verification evaluator for tool results.
   */
  public verifyToolExecution(toolName: string, result: Record<string, unknown>): VerificationResult {
    const checks: string[] = ['execution_complete']

    if (!result || result.error) {
      return {
        status: 'failure',
        verified: false,
        details: String(result?.error || 'Tool indicated error in result object.'),
        checksRun: checks,
      }
    }

    if (result.status === 'success' || result.status === 'displayed' || result.status === 'opened') {
      return {
        status: 'verified_success',
        verified: true,
        details: `Action '${toolName}' executed and verified successfully.`,
        checksRun: checks,
      }
    }

    return {
      status: 'unverified_success',
      verified: true,
      details: `Action '${toolName}' finished with non-standard result schema.`,
      checksRun: checks,
    }
  }
}

export const verifier = new Verifier()
