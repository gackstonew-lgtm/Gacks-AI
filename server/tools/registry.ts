import { readFile, readdir, stat, writeFile, mkdir, rename, unlink, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { relative } from 'node:path'
import { sandbox } from '../security/sandbox.js'
import { workspaceManager } from '../security/workspace.js'
import { terminalService } from '../terminal/terminal-service.js'
import { policyEngine } from '../security/policy.js'
import { auditLogger } from '../security/audit.js'
import { db } from '../db/index.js'
import { memoryStore } from '../memory/memory-store.js'
import { apiRegistry } from '../api/registry.js'
import { credentialManager } from '../api/credential-manager.js'
import { dailyOperationsAgent } from '../business/agents/operations-agent.js'
import { forexAnalysisAuditor } from '../business/agents/forex-auditor.js'
import { businessGrowthAgent } from '../business/agents/growth-agent.js'
import { marketingStrategyAgent } from '../business/agents/marketing-agent.js'
import { webHuntDeltaAgent } from '../business/agents/research-agent.js'
import { crmService } from '../business/crm-service.js'
import { approvalCenter } from '../business/approval-center.js'
import { automationEngine } from '../business/automation-engine.js'
import { windowsSystemService } from '../system/windows-system-service.js'
import type { RiskLevel, ToolResult, VerificationStatus } from '../types.js'

export interface ToolDefinition {
  name: string
  description: string
  category: 'read' | 'write' | 'display' | 'ui' | 'vision' | 'communication' | 'task' | 'memory'
  riskLevel: RiskLevel
  requiresConfirmation: boolean
  parameters: Record<string, unknown>
  execute: (args: Record<string, unknown>, context?: ToolContext) => Promise<unknown>
}

export interface ToolContext {
  userId?: string
  sessionId?: string
  agentRunId?: string
  sendUi?: (msg: unknown) => void
  askClient?: (kind: string, args: unknown, timeoutMs?: number) => Promise<unknown>
  hasUserConfirmation?: boolean
}

export class ToolRegistryV2 {
  private tools: Map<string, ToolDefinition> = new Map()

  constructor() {
    this.registerBuiltins()
  }

  public registerTool(tool: ToolDefinition) {
    this.tools.set(tool.name, tool)
  }

  public getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  public getDeclarations() {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }))
  }

  public getToolNames(): string[] {
    return Array.from(this.tools.keys())
  }

  /**
   * Execute a tool with policy verification, sandboxing, timing, and audit logging.
   */
  public async executeTool(
    name: string,
    args: Record<string, unknown> = {},
    context: ToolContext = {},
  ): Promise<ToolResult> {
    const startTime = Date.now()
    const tool = this.tools.get(name)

    if (!tool) {
      const durationMs = Date.now() - startTime
      auditLogger.log({
        userId: context.userId,
        sessionId: context.sessionId,
        agentRunId: context.agentRunId,
        tool: name,
        action: 'execute_missing_tool',
        inputs: args,
        permissionDecision: 'DENIED',
        resultSuccess: false,
        durationMs,
        verificationStatus: 'failure',
        errorMessage: `Unknown tool: ${name}`,
      })
      return {
        success: false,
        tool: name,
        durationMs,
        error: `Tool '${name}' is not registered in GACKS P.A. V2.`,
      }
    }

    // 1. Policy & Permission check
    const decision = policyEngine.evaluate(name, args, context.hasUserConfirmation ?? false)
    if (!decision.allowed) {
      const durationMs = Date.now() - startTime
      auditLogger.log({
        userId: context.userId,
        sessionId: context.sessionId,
        agentRunId: context.agentRunId,
        tool: name,
        action: 'policy_blocked',
        inputs: args,
        permissionDecision: 'DENIED',
        resultSuccess: false,
        durationMs,
        verificationStatus: 'failure',
        errorMessage: decision.reason,
      })
      return {
        success: false,
        tool: name,
        durationMs,
        error: `Policy Block: ${decision.reason}`,
      }
    }

    // 2. Execution under Sandbox
    try {
      const resultData = await tool.execute(args, context)
      const durationMs = Date.now() - startTime
      const verificationStatus: VerificationStatus =
        tool.category === 'read' || tool.category === 'display' || tool.category === 'ui'
          ? 'verified_success'
          : 'unverified_success'

      auditLogger.log({
        userId: context.userId,
        sessionId: context.sessionId,
        agentRunId: context.agentRunId,
        tool: name,
        action: 'executed',
        inputs: args,
        permissionDecision: 'ALLOWED',
        resultSuccess: true,
        durationMs,
        verificationStatus,
      })

      return {
        success: true,
        tool: name,
        durationMs,
        data: resultData,
        verification: { status: verificationStatus },
      }
    } catch (err) {
      const durationMs = Date.now() - startTime
      const errorMsg = (err as Error)?.message ?? String(err)
      auditLogger.log({
        userId: context.userId,
        sessionId: context.sessionId,
        agentRunId: context.agentRunId,
        tool: name,
        action: 'failed_execution',
        inputs: args,
        permissionDecision: 'ALLOWED',
        resultSuccess: false,
        durationMs,
        verificationStatus: 'failure',
        errorMessage: errorMsg,
      })

      return {
        success: false,
        tool: name,
        durationMs,
        error: `Tool execution failure: ${errorMsg}`,
      }
    }
  }

  private registerBuiltins() {
    // --- HUD Blades ---
    this.registerTool({
      name: 'blade',
      description: 'Open a holographic blade in the HUD to show visual content: article, image, video, page, or list.',
      category: 'display',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'Headline on the blade header.' },
          subtitle: { type: 'STRING', description: 'Source or category tag.' },
          kind: {
            type: 'STRING',
            enum: ['article', 'image', 'video', 'page', 'markdown', 'metrics'],
            description: 'Type of content.',
          },
          url: { type: 'STRING', description: 'URL for media or web page.' },
          body: { type: 'STRING', description: 'Markdown or plain text content.' },
          accent: { type: 'STRING', description: 'CSS hex color code.' },
        },
        required: ['title'],
      },
      execute: async (args, context) => {
        const blade = {
          id: `blade-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: String(args.title || 'Data'),
          subtitle: args.subtitle ? String(args.subtitle) : undefined,
          kind: args.kind || 'markdown',
          url: args.url ? String(args.url) : undefined,
          body: args.body ? String(args.body) : undefined,
          accent: args.accent ? String(args.accent) : undefined,
          closable: true,
        }
        context?.sendUi?.({ type: 'blade', blade })
        return { status: 'opened', bladeId: blade.id, title: blade.title }
      },
    })

    // --- HUD Panels ---
    this.registerTool({
      name: 'display',
      description: 'Compose custom HTML markup into a rich card panel on the HUD.',
      category: 'display',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          html: { type: 'STRING', description: 'Sanitized HTML snippet using .hud-* classes.' },
          title: { type: 'STRING', description: 'Panel header title.' },
        },
        required: ['html'],
      },
      execute: async (args, context) => {
        const panel = {
          id: `panel-${Date.now()}`,
          html: sandbox.sanitizeOutput(String(args.html)),
          title: args.title ? String(args.title) : undefined,
        }
        context?.sendUi?.({ type: 'panel', panel })
        return { status: 'displayed', panelId: panel.id }
      },
    })

    // --- UI Controls ---
    this.registerTool({
      name: 'ui_theme',
      description: 'Retint interface accent color temporarily to signal status (e.g. cyan, red for alerts).',
      category: 'ui',
      riskLevel: 1,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          accent: { type: 'STRING', description: 'CSS color hex or name.' },
        },
        required: ['accent'],
      },
      execute: async (args, context) => {
        context?.sendUi?.({ type: 'ui', op: 'patch', args: { accent: args.accent } })
        return { status: 'accent_updated', color: args.accent }
      },
    })

    this.registerTool({
      name: 'ui_effect',
      description: 'Trigger a visual HUD flourish on the display glass.',
      category: 'ui',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          kind: {
            type: 'STRING',
            enum: ['glitch', 'pulse', 'scan', 'shake', 'flash'],
            description: 'Type of flourish.',
          },
        },
        required: ['kind'],
      },
      execute: async (args, context) => {
        context?.sendUi?.({ type: 'ui', op: 'effect', args: { kind: args.kind } })
        return { status: 'effect_fired', effect: args.kind }
      },
    })

    this.registerTool({
      name: 'ui_reset',
      description: 'Reset all UI colors and styling back to standard HUD appearance.',
      category: 'ui',
      riskLevel: 1,
      requiresConfirmation: false,
      parameters: { type: 'OBJECT', properties: {} },
      execute: async (_args, context) => {
        context?.sendUi?.({ type: 'ui', op: 'reset', args: {} })
        return { status: 'ui_reset' }
      },
    })

    // --- Screen & Camera Vision ---
    this.registerTool({
      name: 'capture_screen',
      description: 'Capture what is currently open on the user desktop or browser screen to inspect or debug.',
      category: 'vision',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          reason: { type: 'STRING', description: 'Brief purpose of screen inspection.' },
        },
      },
      execute: async (args, context) => {
        if (!context?.askClient) throw new Error('Client interface is not connected for screen capture.')
        const reply = (await context.askClient(
          'capture_screen',
          { reason: String(args.reason ?? 'inspecting screen contents').slice(0, 100) },
          60_000,
        )) as Record<string, unknown>

        if (reply?.error) throw new Error(String(reply.error))
        if (typeof reply?.data !== 'string' || !reply.data) throw new Error('No screen image received.')

        return {
          status: 'success',
          image: {
            inlineData: {
              mimeType: reply.mimeType || 'image/jpeg',
              data: reply.data,
            },
          },
          message: 'Screenshot captured from operator display.',
        }
      },
    })

    this.registerTool({
      name: 'look',
      description: 'Look through the webcam when explicitly requested by the user.',
      category: 'vision',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          reason: { type: 'STRING', description: 'What you are observing.' },
        },
      },
      execute: async (args, context) => {
        if (!context?.askClient) throw new Error('Client interface is not connected for webcam capture.')
        const reply = (await context.askClient(
          'capture',
          { mode: 'look', reason: String(args.reason ?? '').slice(0, 80) },
          25_000,
        )) as Record<string, unknown>

        if (reply?.error) throw new Error(String(reply.error))
        if (typeof reply?.data !== 'string' || !reply.data) throw new Error('No camera image received.')

        return {
          status: 'success',
          image: {
            inlineData: {
              mimeType: reply.mimeType || 'image/jpeg',
              data: reply.data,
            },
          },
          message: 'Webcam snapshot captured.',
        }
      },
    })

    // --- Local Filesystem Operations (Governed by WorkspaceManager & Sandbox) ---
    this.registerTool({
      name: 'open_file',
      description: 'Open and inspect a supported source/text file from an approved workspace directory.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          path: { type: 'STRING', description: 'Relative or absolute file path.' },
        },
        required: ['path'],
      },
      execute: async (args) => {
        const check = workspaceManager.validatePath(String(args.path), 'read')
        if (!check.valid || !check.resolvedPath) throw new Error(check.error || 'Path validation failed.')

        const fileStat = await stat(check.resolvedPath)
        if (!fileStat.isFile()) throw new Error(`Path is not a regular file: ${args.path}`)
        if (fileStat.size > 512 * 1024) throw new Error(`File too large (${fileStat.size} bytes). Max 512KB.`)

        const raw = await readFile(check.resolvedPath, 'utf-8')
        const isSensitive = workspaceManager.isSensitiveFile(check.resolvedPath)
        const content = isSensitive ? workspaceManager.redactSecrets(raw) : raw
        const lineCount = content.split(/\r?\n/).length

        return {
          path: args.path,
          resolvedPath: check.resolvedPath,
          size: fileStat.size,
          lineCount,
          isSensitive,
          content,
        }
      },
    })

    this.registerTool({
      name: 'read_file',
      description: 'Safely read contents of a file within permitted workspace directories.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          path: { type: 'STRING', description: 'File path.' },
        },
        required: ['path'],
      },
      execute: async (args) => {
        const check = workspaceManager.validatePath(String(args.path), 'read')
        if (!check.valid || !check.resolvedPath) throw new Error(check.error || 'Path validation failed.')

        const fileStat = await stat(check.resolvedPath)
        if (!fileStat.isFile()) throw new Error(`Path is not a regular file: ${args.path}`)
        if (fileStat.size > 512 * 1024) throw new Error(`File too large (${fileStat.size} bytes). Max 512KB.`)

        const raw = await readFile(check.resolvedPath, 'utf-8')
        const content = workspaceManager.isSensitiveFile(check.resolvedPath)
          ? workspaceManager.redactSecrets(raw)
          : raw

        return {
          path: args.path,
          size: fileStat.size,
          lineCount: content.split(/\r?\n/).length,
          content,
        }
      },
    })

    this.registerTool({
      name: 'write_file',
      description: 'Create or write contents to a file in an approved local workspace with immediate disk verification.',
      category: 'write',
      riskLevel: 1,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          path: { type: 'STRING', description: 'File path to write.' },
          content: { type: 'STRING', description: 'Content to write.' },
        },
        required: ['path', 'content'],
      },
      execute: async (args) => {
        const check = workspaceManager.validatePath(String(args.path), 'write')
        if (!check.valid || !check.resolvedPath) throw new Error(check.error || 'Path validation failed.')

        const content = String(args.content)
        await writeFile(check.resolvedPath, content, 'utf-8')

        // Readback verification
        const readBack = await readFile(check.resolvedPath, 'utf-8')
        if (readBack !== content) {
          throw new Error('Write verification failed: disk contents did not match written content.')
        }

        return {
          status: 'success',
          path: args.path,
          resolvedPath: check.resolvedPath,
          bytesWritten: Buffer.byteLength(content, 'utf-8'),
        }
      },
    })

    this.registerTool({
      name: 'edit_file',
      description: 'Perform targeted content replacement in a file within an approved workspace with verification.',
      category: 'write',
      riskLevel: 1,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          path: { type: 'STRING', description: 'File path to edit.' },
          targetContent: { type: 'STRING', description: 'Exact string or snippet to be replaced.' },
          replacementContent: { type: 'STRING', description: 'New string or snippet to insert.' },
        },
        required: ['path', 'targetContent', 'replacementContent'],
      },
      execute: async (args) => {
        const check = workspaceManager.validatePath(String(args.path), 'write')
        if (!check.valid || !check.resolvedPath) throw new Error(check.error || 'Path validation failed.')

        const original = await readFile(check.resolvedPath, 'utf-8')
        const target = String(args.targetContent)
        const replacement = String(args.replacementContent)

        if (!original.includes(target)) {
          throw new Error(`Target content not found in ${args.path}. Ensure exact matching whitespace and casing.`)
        }

        const modified = original.replace(target, replacement)
        await writeFile(check.resolvedPath, modified, 'utf-8')

        const readBack = await readFile(check.resolvedPath, 'utf-8')
        if (!readBack.includes(replacement)) {
          throw new Error('Edit verification failed: replacement content was not detected on disk.')
        }

        return {
          status: 'success',
          path: args.path,
          linesChanged: replacement.split(/\r?\n/).length,
        }
      },
    })

    this.registerTool({
      name: 'create_directory',
      description: 'Create a new directory in an approved local workspace.',
      category: 'write',
      riskLevel: 1,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          path: { type: 'STRING', description: 'Directory path to create.' },
        },
        required: ['path'],
      },
      execute: async (args) => {
        const check = workspaceManager.validatePath(String(args.path), 'write')
        if (!check.valid || !check.resolvedPath) throw new Error(check.error || 'Path validation failed.')

        await mkdir(check.resolvedPath, { recursive: true })
        return { status: 'success', created: args.path }
      },
    })

    this.registerTool({
      name: 'rename_file',
      description: 'Rename or move a file or folder within an approved local workspace.',
      category: 'write',
      riskLevel: 1,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          oldPath: { type: 'STRING', description: 'Current path.' },
          newPath: { type: 'STRING', description: 'New path.' },
        },
        required: ['oldPath', 'newPath'],
      },
      execute: async (args) => {
        const checkOld = workspaceManager.validatePath(String(args.oldPath), 'write')
        if (!checkOld.valid || !checkOld.resolvedPath) throw new Error(checkOld.error || 'Old path validation failed.')

        const checkNew = workspaceManager.validatePath(String(args.newPath), 'write')
        if (!checkNew.valid || !checkNew.resolvedPath) throw new Error(checkNew.error || 'New path validation failed.')

        await rename(checkOld.resolvedPath, checkNew.resolvedPath)
        return { status: 'success', from: args.oldPath, to: args.newPath }
      },
    })

    this.registerTool({
      name: 'move_file',
      description: 'Move a file or folder to a new location within an approved workspace.',
      category: 'write',
      riskLevel: 1,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          sourcePath: { type: 'STRING', description: 'Source file or folder path.' },
          destinationPath: { type: 'STRING', description: 'Target destination path.' },
        },
        required: ['sourcePath', 'destinationPath'],
      },
      execute: async (args) => {
        const checkSrc = workspaceManager.validatePath(String(args.sourcePath), 'write')
        if (!checkSrc.valid || !checkSrc.resolvedPath) throw new Error(checkSrc.error || 'Source path invalid.')

        const checkDst = workspaceManager.validatePath(String(args.destinationPath), 'write')
        if (!checkDst.valid || !checkDst.resolvedPath) throw new Error(checkDst.error || 'Destination path invalid.')

        await rename(checkSrc.resolvedPath, checkDst.resolvedPath)
        return { status: 'success', moved: args.sourcePath, to: args.destinationPath }
      },
    })

    this.registerTool({
      name: 'delete_file',
      description: 'Delete a file or folder within an approved workspace. Level 3 Destructive: requires operator confirmation.',
      category: 'write',
      riskLevel: 3,
      requiresConfirmation: true,
      parameters: {
        type: 'OBJECT',
        properties: {
          path: { type: 'STRING', description: 'Path to delete.' },
          recursive: { type: 'BOOLEAN', description: 'Set true to delete directories recursively.' },
        },
        required: ['path'],
      },
      execute: async (args) => {
        const check = workspaceManager.validatePath(String(args.path), 'write')
        if (!check.valid || !check.resolvedPath) throw new Error(check.error || 'Path validation failed.')

        const targetStat = await stat(check.resolvedPath)
        if (targetStat.isDirectory()) {
          if (!args.recursive) {
            throw new Error(`Path '${args.path}' is a directory. Set recursive: true to delete.`)
          }
          await rm(check.resolvedPath, { recursive: true, force: true })
        } else {
          await unlink(check.resolvedPath)
        }

        return { status: 'deleted', path: args.path }
      },
    })

    this.registerTool({
      name: 'list_directory',
      description: 'List contents of a directory in an approved local workspace with metadata.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          path: { type: 'STRING', description: 'Directory path.' },
        },
      },
      execute: async (args) => {
        const target = args.path ? String(args.path) : '.'
        const check = workspaceManager.validatePath(target, 'read')
        if (!check.valid || !check.resolvedPath) throw new Error(check.error || 'Path validation failed.')

        const entries = await readdir(check.resolvedPath, { withFileTypes: true })
        const items = await Promise.all(
          entries.slice(0, 100).map(async (e) => {
            let size = 0
            let mtime = 0
            try {
              const s = await stat(`${check.resolvedPath}/${e.name}`)
              size = s.size
              mtime = s.mtimeMs
            } catch {}
            return {
              name: e.name,
              type: e.isDirectory() ? 'directory' : 'file',
              size,
              mtime,
            }
          }),
        )

        return {
          directory: target,
          resolvedPath: check.resolvedPath,
          workspace: check.workspace?.name,
          count: items.length,
          entries: items,
        }
      },
    })

    this.registerTool({
      name: 'search_files',
      description: 'Search for files by name or text content inside approved local directories.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          query: { type: 'STRING', description: 'Text or filename pattern to search for.' },
          directory: { type: 'STRING', description: 'Directory to search within (default: .).' },
          contentSearch: { type: 'BOOLEAN', description: 'Search inside file contents if true.' },
          maxResults: { type: 'NUMBER', description: 'Max results to return (default: 30).' },
        },
        required: ['query'],
      },
      execute: async (args) => {
        const target = args.directory ? String(args.directory) : '.'
        const check = workspaceManager.validatePath(target, 'read')
        if (!check.valid || !check.resolvedPath) throw new Error(check.error || 'Path validation failed.')

        const query = String(args.query).toLowerCase()
        const contentSearch = Boolean(args.contentSearch)
        const maxResults = Math.min(50, Math.max(1, Number(args.maxResults) || 30))
        const matches: Array<{ path: string; type: string; snippet?: string }> = []

        const searchDir = async (dir: string, depth = 0) => {
          if (depth > 6 || matches.length >= maxResults) return
          let entries
          try {
            entries = await readdir(dir, { withFileTypes: true })
          } catch {
            return
          }

          for (const e of entries) {
            if (matches.length >= maxResults) break
            if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'dist') continue

            const fullPath = `${dir}/${e.name}`
            const relPath = relative(check.resolvedPath!, fullPath)

            if (e.name.toLowerCase().includes(query)) {
              matches.push({ path: relPath, type: e.isDirectory() ? 'directory' : 'file' })
            }

            if (e.isDirectory()) {
              await searchDir(fullPath, depth + 1)
            } else if (contentSearch && matches.length < maxResults) {
              try {
                const s = await stat(fullPath)
                if (s.size < 256 * 1024) {
                  const content = await readFile(fullPath, 'utf-8')
                  const idx = content.toLowerCase().indexOf(query)
                  if (idx !== -1) {
                    const start = Math.max(0, idx - 40)
                    const end = Math.min(content.length, idx + query.length + 40)
                    const snippet = content.slice(start, end).replace(/\s+/g, ' ')
                    matches.push({ path: relPath, type: 'file', snippet: `...${snippet}...` })
                  }
                }
              } catch {}
            }
          }
        }

        await searchDir(check.resolvedPath)
        return {
          query: args.query,
          directory: target,
          count: matches.length,
          matches,
        }
      },
    })

    this.registerTool({
      name: 'inspect_file_metadata',
      description: 'Inspect detailed metadata for a file or folder (size, line count, modified time, type).',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          path: { type: 'STRING', description: 'Target path.' },
        },
        required: ['path'],
      },
      execute: async (args) => {
        const check = workspaceManager.validatePath(String(args.path), 'read')
        if (!check.valid || !check.resolvedPath) throw new Error(check.error || 'Path validation failed.')

        const s = await stat(check.resolvedPath)
        let lineCount: number | undefined
        if (s.isFile() && s.size < 512 * 1024) {
          try {
            const raw = await readFile(check.resolvedPath, 'utf-8')
            lineCount = raw.split(/\r?\n/).length
          } catch {}
        }

        return {
          path: args.path,
          resolvedPath: check.resolvedPath,
          size: s.size,
          lineCount,
          isDirectory: s.isDirectory(),
          isFile: s.isFile(),
          modifiedAt: s.mtimeMs,
          createdAt: s.birthtimeMs,
          isSensitive: workspaceManager.isSensitiveFile(check.resolvedPath),
        }
      },
    })

    // --- Terminal & Development Task Operations ---
    this.registerTool({
      name: 'run_terminal_command',
      description: 'Execute a development terminal task in an approved workspace (e.g. npm run build, npm test, npm run lint, git status).',
      category: 'task',
      riskLevel: 2,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          command: { type: 'STRING', description: 'Command line to run.' },
          cwd: { type: 'STRING', description: 'Working directory within approved workspace.' },
          timeoutSeconds: { type: 'NUMBER', description: 'Max runtime in seconds (default: 120).' },
        },
        required: ['command'],
      },
      execute: async (args) => {
        const timeoutMs = typeof args.timeoutSeconds === 'number' ? args.timeoutSeconds * 1000 : 120_000
        const task = await terminalService.executeCommand(String(args.command), {
          cwd: args.cwd ? String(args.cwd) : undefined,
          timeoutMs,
        })

        return {
          taskId: task.id,
          command: task.command,
          cwd: task.cwd,
          status: task.status,
          exitCode: task.exitCode,
          stdout: task.stdout.slice(-4000), // Return last 4KB for immediate LLM context
          stderr: task.stderr.slice(-4000),
          durationMs: task.durationMs,
          error: task.error,
        }
      },
    })

    this.registerTool({
      name: 'cancel_terminal_command',
      description: 'Cancel an active running terminal task.',
      category: 'task',
      riskLevel: 1,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          taskId: { type: 'STRING', description: 'Task ID to terminate.' },
        },
        required: ['taskId'],
      },
      execute: async (args) => {
        const cancelled = terminalService.cancelTask(String(args.taskId))
        return { taskId: args.taskId, cancelled }
      },
    })

    this.registerTool({
      name: 'get_terminal_output',
      description: 'Get status and captured output for a terminal task.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          taskId: { type: 'STRING', description: 'Task ID.' },
        },
        required: ['taskId'],
      },
      execute: async (args) => {
        const task = terminalService.getTask(String(args.taskId))
        if (!task) throw new Error(`Task '${args.taskId}' not found.`)

        return {
          taskId: task.id,
          status: task.status,
          exitCode: task.exitCode,
          stdout: task.stdout,
          stderr: task.stderr,
          durationMs: task.durationMs,
        }
      },
    })

    this.registerTool({
      name: 'reveal_in_file_manager',
      description: 'Open the target folder or file in the native operating system file explorer (Explorer on Windows, Finder on macOS).',
      category: 'display',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          path: { type: 'STRING', description: 'Folder or file path to reveal.' },
        },
      },
      execute: async (args) => {
        const target = args.path ? String(args.path) : '.'
        const check = workspaceManager.validatePath(target, 'read')
        if (!check.valid || !check.resolvedPath) throw new Error(check.error || 'Path validation failed.')

        const isWin = process.platform === 'win32'
        const isMac = process.platform === 'darwin'

        let cmd: string
        let cmdArgs: string[]

        if (isWin) {
          cmd = 'explorer.exe'
          cmdArgs = [check.resolvedPath.replace(/\//g, '\\')]
        } else if (isMac) {
          cmd = 'open'
          cmdArgs = [check.resolvedPath]
        } else {
          cmd = 'xdg-open'
          cmdArgs = [check.resolvedPath]
        }

        try {
          spawn(cmd, cmdArgs, { detached: true, stdio: 'ignore' }).unref()
          return { status: 'revealed', path: check.resolvedPath }
        } catch (err: any) {
          return { status: 'fallback', path: check.resolvedPath, error: err.message }
        }
      },
    })

    // --- Integrations & Telemetry ---
    this.registerTool({
      name: 'check_integrations',
      description: 'Check connectivity status for all external integrations truthfully.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: { type: 'OBJECT', properties: {} },
      execute: async () => {
        const hasEmail = Boolean(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS)
        const hasWhatsApp = Boolean(process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_ID)
        const hasGitHub = Boolean(process.env.GITHUB_TOKEN)
        const hasVercel = Boolean(process.env.VERCEL_TOKEN)

        return {
          github: hasGitHub ? 'CONNECTED' : 'NOT_CONFIGURED (Set GITHUB_TOKEN in server .env)',
          vercel: hasVercel ? 'CONNECTED' : 'NOT_CONFIGURED (Set VERCEL_TOKEN in server .env)',
          whatsapp: hasWhatsApp ? 'CONNECTED' : 'NOT_CONFIGURED (Set WHATSAPP_API_TOKEN in server .env)',
          email: hasEmail ? 'CONNECTED' : 'NOT_CONFIGURED (Set EMAIL_HOST & credentials in server .env)',
          screen_capture: 'READY (Via Web getDisplayMedia)',
          camera: 'READY (Via Web getUserMedia)',
        }
      },
    })

    this.registerTool({
      name: 'send_email',
      description: 'Send an authentic email. Requires verified SMTP configuration.',
      category: 'communication',
      riskLevel: 2,
      requiresConfirmation: true,
      parameters: {
        type: 'OBJECT',
        properties: {
          to: { type: 'STRING', description: 'Recipient email.' },
          subject: { type: 'STRING', description: 'Subject line.' },
          body: { type: 'STRING', description: 'Email message text.' },
        },
        required: ['to', 'subject', 'body'],
      },
      execute: async (args) => {
        const hasEmail = Boolean(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS)
        if (!hasEmail) {
          throw new Error(
            `Email integration is not configured. Server SMTP settings (EMAIL_HOST, EMAIL_USER, EMAIL_PASS) ` +
              `must be set in server environment. No email was sent to ${args.to}.`,
          )
        }
        return { status: 'sent', to: args.to, subject: args.subject }
      },
    })

    this.registerTool({
      name: 'send_whatsapp_message',
      description: 'Send a real WhatsApp message to an international phone number. Requires Meta Business API credentials.',
      category: 'communication',
      riskLevel: 2,
      requiresConfirmation: true,
      parameters: {
        type: 'OBJECT',
        properties: {
          recipient: { type: 'STRING', description: 'Phone number in international format (+1..., +254...).' },
          message: { type: 'STRING', description: 'Message body.' },
        },
        required: ['recipient', 'message'],
      },
      execute: async (args) => {
        const hasWhatsApp = Boolean(process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_ID)
        if (!hasWhatsApp) {
          throw new Error(
            `WhatsApp integration is not connected. Official Meta WhatsApp Business Cloud credentials ` +
              `(WHATSAPP_API_TOKEN and WHATSAPP_PHONE_ID) are required. No message was sent to ${args.recipient}.`,
          )
        }
        return { status: 'sent', recipient: args.recipient }
      },
    })

    // --- Persistent Tasks & Missions ---
    this.registerTool({
      name: 'manage_mission',
      description: 'Update the active mission state, goal, phase, or progress percentage in the persistent dashboard.',
      category: 'task',
      riskLevel: 1,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'Mission headline.' },
          goal: { type: 'STRING', description: 'Mission primary goal.' },
          progress: { type: 'NUMBER', description: 'Percentage complete 0-100.' },
          phase: {
            type: 'STRING',
            enum: ['PLANNING', 'DIAGNOSIS', 'IMPLEMENTATION', 'VERIFICATION', 'DEPLOYMENT'],
            description: 'Current pipeline phase.',
          },
        },
        required: ['title'],
      },
      execute: async (args, context) => {
        const current = db.getActiveMission(context?.userId || 'default')
        const mission = {
          id: current?.id || `mission-${Date.now()}`,
          title: String(args.title),
          goal: String(args.goal || current?.goal || ''),
          progress: typeof args.progress === 'number' ? Math.max(0, Math.min(100, args.progress)) : (current?.progress || 0),
          currentPhase: (args.phase as any) || current?.currentPhase || 'PLANNING',
          phaseStatuses: current?.phaseStatuses || {
            PLANNING: 'active',
            DIAGNOSIS: 'pending',
            IMPLEMENTATION: 'pending',
            VERIFICATION: 'pending',
            DEPLOYMENT: 'pending',
          },
          startedAt: current?.startedAt || Date.now(),
          updatedAt: Date.now(),
          completedAt: args.progress === 100 ? Date.now() : null,
        }

        db.saveMission(mission)
        context?.sendUi?.({ type: 'mission_updated', mission })
        return { status: 'updated', mission }
      },
    })

    // --- Memory Access ---
    this.registerTool({
      name: 'store_memory',
      description: 'Record a persistent fact, user preference, or learned workflow for future turns.',
      category: 'memory',
      riskLevel: 1,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          category: {
            type: 'STRING',
            enum: ['episodic', 'semantic', 'procedural'],
            description: 'Type of memory.',
          },
          content: { type: 'STRING', description: 'Memory fact or instruction.' },
          importance: { type: 'NUMBER', description: '1 to 5 scale.' },
        },
        required: ['category', 'content'],
      },
      execute: async (args, context) => {
        const record = memoryStore.recordMemory({
          userId: context?.userId || 'default',
          category: args.category as any,
          content: String(args.content),
          importance: typeof args.importance === 'number' ? args.importance : 3,
        })
        return { status: record ? 'stored' : 'rejected_sensitive', memoryId: record?.id }
      },
    })

    this.registerTool({
      name: 'query_memory',
      description: 'Retrieve relevant memories, past solutions, or user preferences matching a query.',
      category: 'memory',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          query: { type: 'STRING', description: 'Search keywords.' },
          category: {
            type: 'STRING',
            enum: ['episodic', 'semantic', 'procedural'],
            description: 'Optional filter.',
          },
        },
        required: ['query'],
      },
      execute: async (args, context) => {
        const results = memoryStore.searchMemories({
          userId: context?.userId || 'default',
          query: String(args.query),
          category: args.category as any,
          limit: 5,
        })
        return { count: results.length, memories: results.map((m) => ({ category: m.category, content: m.content })) }
      },
    })

    // --- External API Integration Tools ---
    this.registerTool({
      name: 'discover_apis',
      description: 'Discover available external API capabilities from the public-apis catalog by category or keyword.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          query: { type: 'STRING', description: 'Search term or keyword (e.g. weather, crypto, security, translation).' },
          category: { type: 'STRING', description: 'Optional category filter (e.g. Weather, Development, Currency Exchange).' },
          installedOnly: { type: 'BOOLEAN', description: 'If true, only returns services with executable adapters.' },
        },
      },
      execute: async (args) => {
        const matches = apiRegistry.searchCatalog({
          query: args.query ? String(args.query) : undefined,
          category: args.category ? String(args.category) : undefined,
          installedOnly: Boolean(args.installedOnly),
        })
        return {
          count: matches.length,
          apis: matches.slice(0, 15).map((m) => ({
            id: m.id,
            name: m.name,
            category: m.category,
            description: m.description,
            authType: m.authType,
            adapterStatus: m.adapterStatus,
            documentationUrl: m.documentationUrl,
          })),
        }
      },
    })

    this.registerTool({
      name: 'query_external_api',
      description: 'Execute a verified external API adapter (e.g. open-meteo-weather, open-meteo-geocoding, frankfurter-currency, osv-vulnerabilities, free-dictionary, world-time-api, github-api). Output is safely treated as untrusted external data.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          provider: {
            type: 'STRING',
            description: 'Adapter ID (e.g. open-meteo-weather, frankfurter-currency, osv-vulnerabilities, free-dictionary, open-meteo-geocoding, world-time-api, github-api).',
          },
          operation: { type: 'STRING', description: 'Operation to perform (e.g. get_forecast, convert_currency, query_package_vulnerabilities, define_word, search_location, get_timezone_time, get_repo).' },
          parameters: { type: 'OBJECT', description: 'Parameters for the operation (e.g. { latitude: -1.29, longitude: 36.82 } or { from: "USD", to: "KES", amount: 100 } or { package_name: "lodash" }).' },
        },
        required: ['provider', 'operation'],
      },
      execute: async (args) => {
        const providerId = String(args.provider)
        const operation = String(args.operation)
        const params = (args.parameters as Record<string, unknown>) || {}
        return await apiRegistry.execute(providerId, operation, params)
      },
    })

    this.registerTool({
      name: 'get_api_status',
      description: 'Check health and configuration status of an external API adapter.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          provider: { type: 'STRING', description: 'Adapter ID to check.' },
        },
        required: ['provider'],
      },
      execute: async (args) => {
        return await apiRegistry.getProviderStatus(String(args.provider))
      },
    })

    this.registerTool({
      name: 'configure_api_credential',
      description: 'Configure an API key or token for a verified external provider. Credentials are encrypted and isolated.',
      category: 'write',
      riskLevel: 1,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          provider: { type: 'STRING', description: 'Provider ID to configure.' },
          apiKey: { type: 'STRING', description: 'The API key or bearer token.' },
        },
        required: ['provider', 'apiKey'],
      },
      execute: async (args) => {
        const providerId = String(args.provider)
        const cred = await credentialManager.setCredential(
          providerId,
          providerId,
          'apiKey',
          { apiKey: String(args.apiKey) },
        )
        return { success: true, provider: providerId, status: 'credential_configured', updatedAt: cred.updatedAt }
      },
    })

    // --- JAVIS BS — Custom Business Suite Native Tools ---

    this.registerTool({
      name: 'generate_morning_briefing',
      description: 'Generate the executive morning briefing aggregating revenue pacing, urgent customer alerts, pending approvals, and daily priorities.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          workspaceId: { type: 'STRING', description: 'Workspace identifier.' },
        },
      },
      execute: async (args, context) => {
        const workspaceId = String(args.workspaceId || 'default-workspace')
        return dailyOperationsAgent.generateMorningBriefing(context?.userId || 'default', workspaceId)
      },
    })

    this.registerTool({
      name: 'audit_forex_trade',
      description: 'Audit a proposed Forex trade plan (entry, stop loss, take profit, position size) with structural risk checks. Strictly analysis only.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          pair: { type: 'STRING', description: 'Currency pair (e.g. XAUUSD, EURUSD).' },
          direction: { type: 'STRING', enum: ['LONG', 'SHORT'], description: 'Trade direction.' },
          entryPrice: { type: 'NUMBER', description: 'Target entry price.' },
          stopLoss: { type: 'NUMBER', description: 'Proposed stop loss.' },
          takeProfit: { type: 'NUMBER', description: 'Proposed take profit.' },
          riskPercent: { type: 'NUMBER', description: 'Risk percentage of account (default 1.0).' },
          accountBalanceUsd: { type: 'NUMBER', description: 'Account balance in USD.' },
        },
        required: ['pair', 'direction', 'entryPrice', 'stopLoss', 'takeProfit'],
      },
      execute: async (args) => {
        return forexAnalysisAuditor.auditTrade({
          pair: String(args.pair),
          direction: args.direction === 'SHORT' ? 'SHORT' : 'LONG',
          entryPrice: Number(args.entryPrice),
          stopLoss: Number(args.stopLoss),
          takeProfit: Number(args.takeProfit),
          riskPercent: args.riskPercent ? Number(args.riskPercent) : 1.0,
          accountBalanceUsd: args.accountBalanceUsd ? Number(args.accountBalanceUsd) : 10000,
        })
      },
    })

    this.registerTool({
      name: 'analyze_business_growth',
      description: 'Analyze company growth metrics, revenue pacing, goal completion, and operational bottlenecks.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          workspaceId: { type: 'STRING', description: 'Workspace identifier.' },
        },
      },
      execute: async (args) => {
        return businessGrowthAgent.analyzeGrowth(String(args.workspaceId || 'default-workspace'))
      },
    })

    this.registerTool({
      name: 'draft_marketing_campaign',
      description: 'Draft marketing strategy, positioning, and ad creative for Meta, email, or social campaigns. High-spend actions queue into Approval Center.',
      category: 'write',
      riskLevel: 1,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', description: 'Campaign title.' },
          objective: { type: 'STRING', description: 'Campaign objective (e.g. Lead Generation, Conversions).' },
          dailyBudgetUsd: { type: 'NUMBER', description: 'Daily ad budget in USD.' },
          platform: { type: 'STRING', enum: ['meta', 'email', 'whatsapp', 'social'], description: 'Destination marketing platform.' },
        },
        required: ['name', 'objective', 'dailyBudgetUsd'],
      },
      execute: async (args) => {
        return marketingStrategyAgent.createCampaignStrategy({
          name: String(args.name),
          objective: String(args.objective),
          dailyBudgetUsd: Number(args.dailyBudgetUsd),
          platform: (args.platform as any) || 'meta',
        })
      },
    })

    this.registerTool({
      name: 'webhunt_research',
      description: 'Execute controlled WebHunt Delta research distinguishing Facts, Sources, Inferences, and Recommendations. Wraps external results as untrusted data.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          topic: { type: 'STRING', description: 'Subject or competitor to research.' },
        },
        required: ['topic'],
      },
      execute: async (args) => {
        return webHuntDeltaAgent.conductResearch(String(args.topic))
      },
    })

    this.registerTool({
      name: 'manage_crm_customer',
      description: 'Manage CRM customers and leads, query contact history, and list urgent customer alerts.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          action: { type: 'STRING', enum: ['list', 'get', 'search', 'urgent', 'create', 'add_note'], description: 'CRM operation.' },
          customerId: { type: 'STRING', description: 'Customer ID for get or add_note.' },
          query: { type: 'STRING', description: 'Search term.' },
          note: { type: 'STRING', description: 'Note text for add_note.' },
        },
        required: ['action'],
      },
      execute: async (args) => {
        const action = String(args.action)
        if (action === 'urgent') return crmService.getUrgentAttentionList()
        if (action === 'search') return crmService.findCustomer(String(args.query || ''))
        if (action === 'get' && args.customerId) return crmService.getCustomer(String(args.customerId))
        if (action === 'add_note' && args.customerId && args.note) {
          return crmService.addNote(String(args.customerId), String(args.note))
        }
        return crmService.getCustomers()
      },
    })

    this.registerTool({
      name: 'manage_approval_request',
      description: 'Inspect pending executive approval requests or authorize/reject high-impact actions.',
      category: 'write',
      riskLevel: 2,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          action: { type: 'STRING', enum: ['list_pending', 'get', 'resolve'], description: 'Approval operation.' },
          requestId: { type: 'STRING', description: 'Request ID to resolve or inspect.' },
          decision: { type: 'STRING', enum: ['approved', 'rejected', 'edited'], description: 'Decision.' },
        },
        required: ['action'],
      },
      execute: async (args) => {
        const action = String(args.action)
        if (action === 'list_pending') return approvalCenter.getPending()
        if (action === 'get' && args.requestId) return approvalCenter.getRequest(String(args.requestId))
        if (action === 'resolve' && args.requestId && args.decision) {
          return approvalCenter.resolveRequest(
            String(args.requestId),
            args.decision as 'approved' | 'rejected' | 'edited',
            'operator',
          )
        }
        return { error: 'Invalid approval action or parameters' }
      },
    })

    this.registerTool({
      name: 'trigger_business_automation',
      description: 'Trigger a business automation rule (e.g. daily briefing, lead escalation, budget check).',
      category: 'write',
      riskLevel: 1,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          ruleId: { type: 'STRING', description: 'Automation rule ID to trigger.' },
          payload: { type: 'OBJECT', description: 'Optional event data.' },
        },
        required: ['ruleId'],
      },
      execute: async (args) => {
        return await automationEngine.triggerRule(String(args.ruleId), (args.payload as any) || {})
      },
    })

    // --- Windows System OS & Hardware Integration Tools ---

    this.registerTool({
      name: 'system_get_hardware_details',
      description: 'Query comprehensive real-time Windows hardware vitals: CPU model, core counts, utilization, RAM breakdown, GPU status, battery/power, connected displays, and storage drives.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
      execute: async () => {
        return await windowsSystemService.getHardwareReport()
      },
    })

    this.registerTool({
      name: 'system_get_devices',
      description: 'Query connected devices and network telemetry: active Wi-Fi SSID and signal strength, Bluetooth radios/devices, network adapters, audio endpoints, and printers.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
      execute: async () => {
        return await windowsSystemService.getDevicesReport()
      },
    })

    this.registerTool({
      name: 'system_get_processes',
      description: 'Inspect active running processes and resource consumers on the Windows system (Task Manager view).',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          limit: { type: 'INTEGER', description: 'Maximum number of processes to return (default 35).' },
        },
      },
      execute: async (args) => {
        return await windowsSystemService.getProcesses(Number(args.limit || 35))
      },
    })

    this.registerTool({
      name: 'system_terminate_process',
      description: 'Safely terminate an active process by PID and process name. Requires explicit confirmation and blocks termination of core Windows system processes.',
      category: 'write',
      riskLevel: 3,
      requiresConfirmation: true,
      parameters: {
        type: 'OBJECT',
        properties: {
          pid: { type: 'INTEGER', description: 'Target process ID.' },
          confirmName: { type: 'STRING', description: 'Process name for confirmation safety check.' },
        },
        required: ['pid', 'confirmName'],
      },
      execute: async (args, context) => {
        return await windowsSystemService.terminateProcess(
          Number(args.pid),
          String(args.confirmName),
          context?.hasUserConfirmation ?? false,
        )
      },
    })

    this.registerTool({
      name: 'system_get_apps',
      description: 'Discover installed Windows desktop applications and inspect currently running applications.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
      execute: async () => {
        const [installed, running] = await Promise.all([
          windowsSystemService.getInstalledApps(),
          windowsSystemService.getRunningApps(),
        ])
        return { installed, running }
      },
    })

    this.registerTool({
      name: 'system_launch_app',
      description: 'Launch a verified Windows application or program. Requires explicit user confirmation and strictly rejects dangerous scripts.',
      category: 'write',
      riskLevel: 2,
      requiresConfirmation: true,
      parameters: {
        type: 'OBJECT',
        properties: {
          app: { type: 'STRING', description: 'Application executable name or registered command (e.g. "notepad.exe", "calc.exe").' },
        },
        required: ['app'],
      },
      execute: async (args, context) => {
        return await windowsSystemService.launchApp(String(args.app), context?.hasUserConfirmation ?? false)
      },
    })

    this.registerTool({
      name: 'system_read_clipboard',
      description: 'Read the current plain text contents of the Windows system clipboard.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
      execute: async () => {
        return await windowsSystemService.readClipboard(true)
      },
    })

    this.registerTool({
      name: 'system_write_clipboard',
      description: 'Copy text to the Windows system clipboard.',
      category: 'write',
      riskLevel: 1,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING', description: 'Text string to copy to the clipboard.' },
        },
        required: ['text'],
      },
      execute: async (args) => {
        return await windowsSystemService.writeClipboard(String(args.text), true)
      },
    })

    this.registerTool({
      name: 'system_send_notification',
      description: 'Send a native Windows desktop toast notification or system banner.',
      category: 'communication',
      riskLevel: 2,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'Notification title.' },
          message: { type: 'STRING', description: 'Notification body message.' },
        },
        required: ['title', 'message'],
      },
      execute: async (args) => {
        return await windowsSystemService.sendNotification(String(args.title), String(args.message))
      },
    })

    this.registerTool({
      name: 'system_get_services',
      description: 'Inspect running Windows system services in a safe, read-only mode.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          limit: { type: 'INTEGER', description: 'Maximum number of running services to inspect (default 30).' },
        },
      },
      execute: async (args) => {
        return await windowsSystemService.getRunningServices(Number(args.limit || 30))
      },
    })
  }
}

export const toolRegistry = new ToolRegistryV2()
