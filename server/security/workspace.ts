import { resolve, relative, isAbsolute, normalize } from 'node:path'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'

export interface ApprovedWorkspace {
  id: string
  name: string
  path: string
  permissions: {
    read: boolean
    write: boolean
    terminal: boolean
  }
  approvedAt: number
}

const SENSITIVE_PATTERNS = [
  /^\.env(\..+)?$/i,
  /\.(pem|key|pkcs12|pfx|p12|kdbx)$/i,
  /^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /^(credentials|service-account|client-secret)\.json$/i,
  /^\.npmrc$/i,
  /^\.netrc$/i,
]

const SECRET_CONTENT_PATTERNS = [
  /(?:api[_-]?key|secret|token|password|auth|bearer)\s*[:=]\s*['"]?([a-zA-Z0-9_\-.]{16,})['"]?/gi,
  /\b(sk-[a-zA-Z0-9]{20,})\b/g,
  /\b(ghp_[a-zA-Z0-9]{36})\b/g,
  /\b(AIza[0-9A-Za-z-_]{35})\b/g,
]

export class WorkspaceManager {
  private workspaces: Map<string, ApprovedWorkspace> = new Map()
  private activeWorkspaceId: string = 'default'
  private storageFile: string

  constructor() {
    this.storageFile = resolve(process.cwd(), 'data', 'workspaces.json')
    this.initDefaultWorkspace()
    this.loadWorkspaces()
  }

  private initDefaultWorkspace() {
    const cwd = resolve(process.cwd())
    const defaultWs: ApprovedWorkspace = {
      id: 'default',
      name: 'Gacks AI (Current Workspace)',
      path: cwd,
      permissions: {
        read: true,
        write: true,
        terminal: true,
      },
      approvedAt: Date.now(),
    }
    this.workspaces.set(defaultWs.id, defaultWs)
  }

  private async loadWorkspaces() {
    try {
      if (existsSync(this.storageFile)) {
        const raw = await readFile(this.storageFile, 'utf-8')
        const data = JSON.parse(raw)
        if (Array.isArray(data)) {
          for (const ws of data) {
            if (ws.id && ws.path && existsSync(ws.path)) {
              this.workspaces.set(ws.id, {
                ...ws,
                path: resolve(ws.path),
              })
            }
          }
        }
      }
    } catch {}
  }

  public async saveWorkspaces() {
    try {
      const dir = resolve(process.cwd(), 'data')
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true })
      }
      await writeFile(
        this.storageFile,
        JSON.stringify(Array.from(this.workspaces.values()), null, 2),
        'utf-8',
      )
    } catch {}
  }

  public getWorkspaces(): ApprovedWorkspace[] {
    return Array.from(this.workspaces.values())
  }

  public getActiveWorkspace(): ApprovedWorkspace {
    return this.workspaces.get(this.activeWorkspaceId) || Array.from(this.workspaces.values())[0]
  }

  public setActiveWorkspace(id: string): boolean {
    if (this.workspaces.has(id)) {
      this.activeWorkspaceId = id
      return true
    }
    return false
  }

  public async addWorkspace(
    folderPath: string,
    name?: string,
    permissions = { read: true, write: true, terminal: true },
  ): Promise<ApprovedWorkspace> {
    const resolved = resolve(folderPath)
    if (!existsSync(resolved)) {
      throw new Error(`Directory does not exist: ${folderPath}`)
    }

    // Check if already registered
    for (const ws of this.workspaces.values()) {
      if (ws.path.toLowerCase() === resolved.toLowerCase()) {
        ws.permissions = { ...ws.permissions, ...permissions }
        if (name) ws.name = name
        await this.saveWorkspaces()
        return ws
      }
    }

    const id = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const defaultName = name || resolved.split(/[\\/]/).filter(Boolean).pop() || 'Workspace'

    const workspace: ApprovedWorkspace = {
      id,
      name: defaultName,
      path: resolved,
      permissions,
      approvedAt: Date.now(),
    }

    this.workspaces.set(id, workspace)
    this.activeWorkspaceId = id
    await this.saveWorkspaces()
    return workspace
  }

  public async revokeWorkspace(id: string): Promise<boolean> {
    if (id === 'default') {
      // Don't delete default, but can disable write/terminal if needed
      const ws = this.workspaces.get('default')
      if (ws) {
        ws.permissions = { read: true, write: false, terminal: false }
        await this.saveWorkspaces()
        return true
      }
      return false
    }

    const deleted = this.workspaces.delete(id)
    if (deleted) {
      if (this.activeWorkspaceId === id) {
        this.activeWorkspaceId = 'default'
      }
      await this.saveWorkspaces()
    }
    return deleted
  }

  /**
   * Validate that a target path resolves strictly inside an approved workspace.
   */
  public validatePath(
    targetPath: string,
    requiredPermission: 'read' | 'write' | 'terminal' = 'read',
  ): {
    valid: boolean
    resolvedPath?: string
    workspace?: ApprovedWorkspace
    error?: string
  } {
    if (!targetPath || typeof targetPath !== 'string') {
      return { valid: false, error: 'Path must be a non-empty string.' }
    }

    const active = this.getActiveWorkspace()
    let candidatePath = targetPath

    if (!isAbsolute(candidatePath)) {
      candidatePath = resolve(active.path, candidatePath)
    } else {
      candidatePath = resolve(candidatePath)
    }

    candidatePath = normalize(candidatePath)

    // Check against all approved workspaces
    for (const ws of this.workspaces.values()) {
      const wsPath = normalize(ws.path)
      const rel = relative(wsPath, candidatePath)

      // Must be inside or equal to workspace
      const isInside = rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))

      if (isInside) {
        if (!ws.permissions[requiredPermission]) {
          return {
            valid: false,
            error: `Permission denied: ${requiredPermission} access is not granted for workspace '${ws.name}'.`,
          }
        }
        return {
          valid: true,
          resolvedPath: candidatePath,
          workspace: ws,
        }
      }
    }

    return {
      valid: false,
      error: `Access denied: Path '${targetPath}' is outside approved local workspaces. Please grant folder access first.`,
    }
  }

  /**
   * Check if a file is sensitive (e.g. .env, private keys)
   */
  public isSensitiveFile(filePath: string): boolean {
    const filename = filePath.split(/[\\/]/).pop() || ''
    return SENSITIVE_PATTERNS.some((pattern) => pattern.test(filename))
  }

  /**
   * Redact sensitive credentials from text output to prevent secret leakage.
   */
  public redactSecrets(content: string): string {
    if (!content || typeof content !== 'string') return ''
    let sanitized = content
    for (const pattern of SECRET_CONTENT_PATTERNS) {
      sanitized = sanitized.replace(pattern, (match) => {
        if (match.length <= 8) return '[REDACTED]'
        return match.slice(0, 4) + '...' + '[REDACTED]'
      })
    }
    return sanitized
  }
}

export const workspaceManager = new WorkspaceManager()
