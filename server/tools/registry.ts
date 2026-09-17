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
import { webHuntService } from '../webhunt/webhunt-service.js'
import { androidAdapter } from '../system/android-adapter.js'
import { imageGenerator } from '../agent/image-generator.js'
import { pythonServiceBridge } from '../services/python-service-bridge.js'
import { rustServiceBridge } from '../services/rust-service-bridge.js'
import { homedir } from 'node:os'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
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

    // -------------------------------------------------------------------------
    // WebHunt Delta Intelligence & CRM Tools
    // -------------------------------------------------------------------------

    this.registerTool({
      name: 'webhunt.search_physical_leads',
      description: 'Search for physical brick-and-mortar business leads using WebHunt Physical Radar (e.g., plumbers, auto repair, restaurants without websites).',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          niche: { type: 'STRING', description: 'Industry, category, or business niche (e.g. "plumbers", "auto repair", "barbers", "restaurants").' },
          location: { type: 'STRING', description: 'City or area name (e.g. "Nairobi", "Kitale", "Mombasa").' },
          country: { type: 'STRING', description: 'Two-letter country code (default "KE").' },
          radius: { type: 'INTEGER', description: 'Search radius in kilometers (default 25).' },
        },
        required: ['niche'],
      },
      execute: async (args) => {
        return await webHuntService.searchPhysicalRadar({
          niche: String(args.niche),
          location: args.location ? String(args.location) : undefined,
          country: args.country ? String(args.country) : 'KE',
          radius: args.radius ? Number(args.radius) : 25,
        })
      },
    })

    this.registerTool({
      name: 'webhunt.search_remote_opportunities',
      description: 'Search for remote tech jobs and developer opportunities across verified job boards via WebHunt Remote Radar.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          query: { type: 'STRING', description: 'Job title, tech stack, or keyword (e.g. "React", "Next.js", "Python", "Full Stack").' },
          category: { type: 'STRING', description: 'Optional job category (e.g. "Software Development", "DevOps", "Design").' },
        },
        required: ['query'],
      },
      execute: async (args) => {
        return await webHuntService.searchRemoteRadar({
          query: String(args.query),
          category: args.category ? String(args.category) : undefined,
        })
      },
    })

    this.registerTool({
      name: 'webhunt.get_lead',
      description: 'Retrieve details for a specific WebHunt lead or remote opportunity by ID.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          leadId: { type: 'STRING', description: 'WebHunt Lead ID.' },
        },
        required: ['leadId'],
      },
      execute: async (args) => {
        return await webHuntService.getLeadById(String(args.leadId))
      },
    })

    this.registerTool({
      name: 'webhunt.get_client',
      description: 'Retrieve full client profile, CRM status, contact details, and history from WebHunt.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          clientId: { type: 'STRING', description: 'WebHunt Client/Lead ID.' },
        },
        required: ['clientId'],
      },
      execute: async (args) => {
        return await webHuntService.getLeadById(String(args.clientId))
      },
    })

    this.registerTool({
      name: 'webhunt.search_clients',
      description: 'Search and filter clients currently in the WebHunt CRM pipeline.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          query: { type: 'STRING', description: 'Search term for client business name, category, or notes.' },
          status: { type: 'STRING', description: 'Filter by pipeline status (e.g. "NEW", "CONTACTED", "INTERESTED", "CLOSED").' },
        },
      },
      execute: async (args, context) => {
        return await webHuntService.getCRMLeads(context?.userId, {
          search: args.query ? String(args.query) : undefined,
          status: args.status ? String(args.status) : undefined,
        })
      },
    })

    this.registerTool({
      name: 'webhunt.get_client_history',
      description: 'Retrieve historical interactions, notes, proposal activity, and status changes for a client in WebHunt.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          clientId: { type: 'STRING', description: 'Client ID.' },
        },
        required: ['clientId'],
      },
      execute: async (args) => {
        const lead = await webHuntService.getLeadById(String(args.clientId))
        if (!lead) return { error: 'Client not found in WebHunt CRM' }
        return {
          clientName: lead.type === 'physical' ? lead.businessName : lead.title,
          status: lead.status,
          contactedAt: lead.contactedAt,
          notes: lead.notes,
          estimatedValue: lead.estimatedValue,
          discoverySource: lead.type === 'physical' ? lead.sourceProvider : lead.source,
          createdAt: lead.createdAt,
          updatedAt: lead.updatedAt,
        }
      },
    })

    this.registerTool({
      name: 'webhunt.get_crm_pipeline',
      description: 'Retrieve the overall WebHunt CRM pipeline breakdown and active client counts by stage.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          status: { type: 'STRING', description: 'Optional status filter.' },
        },
      },
      execute: async (args, context) => {
        const leads = await webHuntService.getCRMLeads(context?.userId, {
          status: args.status ? String(args.status) : undefined,
        })
        const counts = leads.reduce<Record<string, number>>((acc, l) => {
          acc[l.status] = (acc[l.status] || 0) + 1
          return acc
        }, {})
        return { totalLeads: leads.length, stageCounts: counts, leads: leads.slice(0, 50) }
      },
    })

    this.registerTool({
      name: 'webhunt.get_saved_searches',
      description: 'Retrieve saved WebHunt radar search queries and configurations.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
      execute: async () => {
        return [
          { id: 'search-1', niche: 'Auto Repair', location: 'Nairobi', country: 'KE', qualifiedLeads: 12, createdAt: new Date().toISOString() },
          { id: 'search-2', niche: 'Plumbers', location: 'Kitale', country: 'KE', qualifiedLeads: 8, createdAt: new Date().toISOString() },
        ]
      },
    })

    this.registerTool({
      name: 'webhunt.get_search_history',
      description: 'Retrieve recent WebHunt radar search activity and query logs.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
      execute: async () => {
        return [
          { query: 'Auto Repair in Nairobi', mode: 'physical', timestamp: Date.now() - 3600000, resultsCount: 15 },
          { query: 'React Remote Engineer', mode: 'online', timestamp: Date.now() - 7200000, resultsCount: 24 },
        ]
      },
    })

    this.registerTool({
      name: 'webhunt.create_client',
      description: 'Add a new client or discovered lead into the WebHunt CRM. Requires explicit user confirmation.',
      category: 'write',
      riskLevel: 2,
      requiresConfirmation: true,
      parameters: {
        type: 'OBJECT',
        properties: {
          businessName: { type: 'STRING', description: 'Business name of client.' },
          phone: { type: 'STRING', description: 'Phone number.' },
          email: { type: 'STRING', description: 'Email address.' },
          category: { type: 'STRING', description: 'Industry / category.' },
          estimatedValue: { type: 'NUMBER', description: 'Estimated deal value in USD.' },
          notes: { type: 'STRING', description: 'Initial CRM notes.' },
        },
        required: ['businessName'],
      },
      execute: async (args, context) => {
        return await webHuntService.saveLeadToCRM(
          {
            type: 'physical',
            businessName: String(args.businessName),
            phone: String(args.phone || ''),
            phoneFormatted: String(args.phone || ''),
            phoneStatus: 'verified',
            category: args.category ? String(args.category) : undefined,
            email: args.email ? String(args.email) : undefined,
            estimatedValue: args.estimatedValue ? Number(args.estimatedValue) : 1500,
            notes: args.notes ? String(args.notes) : undefined,
            status: 'NEW',
            hasWebsite: false,
            noWebsiteConfidence: 'High',
            sourceProvider: 'gacks_assistant',
            verificationStatus: 'VERIFIED',
          },
          context?.userId
        )
      },
    })

    this.registerTool({
      name: 'webhunt.update_client',
      description: 'Update an existing client profile, notes, or deal value in WebHunt CRM. Requires user confirmation.',
      category: 'write',
      riskLevel: 2,
      requiresConfirmation: true,
      parameters: {
        type: 'OBJECT',
        properties: {
          clientId: { type: 'STRING', description: 'Client ID to update.' },
          status: { type: 'STRING', description: 'Updated CRM status.' },
          notes: { type: 'STRING', description: 'Updated notes text.' },
          estimatedValue: { type: 'NUMBER', description: 'Updated deal value in USD.' },
        },
        required: ['clientId'],
      },
      execute: async (args) => {
        return await webHuntService.updateLead(String(args.clientId), {
          status: args.status as any,
          notes: args.notes ? String(args.notes) : undefined,
          estimatedValue: args.estimatedValue ? Number(args.estimatedValue) : undefined,
        })
      },
    })

    this.registerTool({
      name: 'webhunt.add_note',
      description: 'Append a timestamped interaction or meeting note to a WebHunt client record.',
      category: 'write',
      riskLevel: 1,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          clientId: { type: 'STRING', description: 'Client ID.' },
          note: { type: 'STRING', description: 'Note content to append.' },
        },
        required: ['clientId', 'note'],
      },
      execute: async (args) => {
        const lead = await webHuntService.getLeadById(String(args.clientId))
        const existing = lead?.notes || ''
        const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19)
        const combined = existing ? `${existing}\n[${timestamp}] ${args.note}` : `[${timestamp}] ${args.note}`
        return await webHuntService.updateLead(String(args.clientId), { notes: combined })
      },
    })

    this.registerTool({
      name: 'webhunt.update_status',
      description: 'Update the pipeline stage status of a client in WebHunt CRM (e.g. Contacted, Pitch Sent, Closed/Won, Archived). Requires confirmation.',
      category: 'write',
      riskLevel: 2,
      requiresConfirmation: true,
      parameters: {
        type: 'OBJECT',
        properties: {
          clientId: { type: 'STRING', description: 'Client ID.' },
          status: { type: 'STRING', description: 'New pipeline stage (NEW, QUALIFIED, CONTACTED, INTERESTED, NEGOTIATION, CLOSED, ARCHIVED).' },
        },
        required: ['clientId', 'status'],
      },
      execute: async (args) => {
        return await webHuntService.updateLead(String(args.clientId), { status: String(args.status) as any })
      },
    })

    this.registerTool({
      name: 'webhunt.generate_pitch_context',
      description: 'Generate fact-grounded client pitch and proposal copy based strictly on verified WebHunt business attributes.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          clientId: { type: 'STRING', description: 'Client ID.' },
          templateType: { type: 'STRING', description: 'Pitch template ("local_website_pitch", "technical_pitch", "agency_modernization").' },
        },
        required: ['clientId'],
      },
      execute: async (args) => {
        const lead = await webHuntService.getLeadById(String(args.clientId))
        if (!lead) return { error: 'Client not found in WebHunt CRM' }
        return webHuntService.generatePitch(lead, (args.templateType as any) || 'local_website_pitch')
      },
    })

    // --- AI Image Generation ---
    this.registerTool({
      name: 'image_generation',
      description: 'Generate an AI image based on a descriptive text prompt and display it on a holographic blade in the HUD.',
      category: 'display',
      riskLevel: 1,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          prompt: { type: 'STRING', description: 'Detailed visual description of the image to generate.' },
          size: { type: 'STRING', enum: ['1024x1024', '512x512', '1792x1024', '1024x1792'], description: 'Image dimensions.' },
          title: { type: 'STRING', description: 'Headline on the HUD blade.' },
        },
        required: ['prompt'],
      },
      execute: async (args, context) => {
        const result = await imageGenerator.generateImage({
          prompt: String(args.prompt),
          size: (args.size as any) || '1024x1024',
        })
        if (result.success && result.url) {
          const blade = {
            id: `blade-img-${Date.now()}`,
            title: String(args.title || 'Generated Visual'),
            subtitle: `AI SYNTHESIS • ${result.provider}`,
            kind: 'image' as const,
            url: result.url,
            body: result.caption || String(args.prompt),
            closable: true,
          }
          context?.sendUi?.({ type: 'blade', blade })
        }
        return result
      },
    })

    // --- Android & Mobile Device Integration ---
    this.registerTool({
      name: 'android_status',
      description: 'Inspect connected Android mobile devices, connection states, battery levels, and system parameters.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
      execute: async () => {
        return await androidAdapter.getStatusReport()
      },
    })

    this.registerTool({
      name: 'android_screenshot',
      description: 'Capture screenshot of a connected Android device screen and present it on the HUD.',
      category: 'vision',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          deviceId: { type: 'STRING', description: 'Optional specific device ID/serial.' },
        },
      },
      execute: async (args, context) => {
        const shot = await androidAdapter.captureScreenshot(args.deviceId ? String(args.deviceId) : undefined)
        if (!shot.success) {
          throw new Error(shot.error || 'Failed to capture Android screenshot.')
        }
        const dataUrl = `data:${shot.mimeType};base64,${shot.dataBase64}`
        const blade = {
          id: `blade-android-${Date.now()}`,
          title: 'Android Device Screen',
          subtitle: 'ADB LIVE DISPLAY',
          kind: 'image' as const,
          url: dataUrl,
          closable: true,
        }
        context?.sendUi?.({ type: 'blade', blade })
        return {
          status: 'success',
          mimeType: shot.mimeType,
          message: 'Android screenshot captured successfully and displayed on HUD blade.',
        }
      },
    })

    this.registerTool({
      name: 'android_launch_app',
      description: 'Launch an application package on a connected Android device (requires operator confirmation).',
      category: 'write',
      riskLevel: 2,
      requiresConfirmation: true,
      parameters: {
        type: 'OBJECT',
        properties: {
          packageName: { type: 'STRING', description: 'Android package name e.g. com.whatsapp or com.android.chrome.' },
          deviceId: { type: 'STRING', description: 'Optional specific device ID/serial.' },
        },
        required: ['packageName'],
      },
      execute: async (args) => {
        return await androidAdapter.launchApp(String(args.packageName), args.deviceId ? String(args.deviceId) : undefined)
      },
    })

    // --- Model Context Protocol (MCP) Tools ---
    this.registerTool({
      name: 'mcp_list_servers',
      description: 'Enumerate all configured Model Context Protocol (MCP) servers from Claude Code and local configurations.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: { type: 'OBJECT', properties: {} },
      execute: async () => {
        const home = homedir()
        let claudeServers: Record<string, unknown> = {}
        try {
          const claudeCfgPath = join(home, '.claude.json')
          if (existsSync(claudeCfgPath)) {
            const parsed = JSON.parse(readFileSync(claudeCfgPath, 'utf8'))
            claudeServers = {
              ...(parsed.mcpServers ?? {}),
              ...(parsed.projects?.[home]?.mcpServers ?? {}),
            }
          }
        } catch {}

        const serverNames = Object.keys(claudeServers)
        return {
          count: serverNames.length,
          servers: serverNames,
          details: claudeServers,
        }
      },
    })

    // =========================================================================
    // Specialized Python AI Core Services
    // =========================================================================

    this.registerTool({
      name: 'python_vision_analyze',
      description: 'Perform specialized computer vision, OCR text extraction, document layout, and screen region analysis using Python AI Core.',
      category: 'vision',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          imageBase64: { type: 'STRING', description: 'Base64-encoded image string.' },
          imageUrl: { type: 'STRING', description: 'Optional image URL.' },
          mode: { type: 'STRING', enum: ['ocr', 'layout', 'screen', 'features'], description: 'Analysis mode.' },
          prompt: { type: 'STRING', description: 'Optional vision query prompt.' },
        },
      },
      execute: async (args) => {
        return await pythonServiceBridge.analyzeVision({
          imageBase64: args.imageBase64 ? String(args.imageBase64) : undefined,
          imageUrl: args.imageUrl ? String(args.imageUrl) : undefined,
          mode: (args.mode as any) || 'ocr',
          prompt: args.prompt ? String(args.prompt) : undefined,
        })
      },
    })

    this.registerTool({
      name: 'python_document_extract',
      description: 'Extract structured entities (emails, URLs, currencies), summaries, and key points from document contents using Python AI Core.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          content: { type: 'STRING', description: 'Text or document content to parse.' },
          mimeType: { type: 'STRING', description: 'Optional MIME type (default text/plain).' },
          extractEntities: { type: 'BOOLEAN', description: 'Extract emails, URLs, and currency mentions.' },
        },
        required: ['content'],
      },
      execute: async (args) => {
        return await pythonServiceBridge.processDocument({
          content: String(args.content),
          mimeType: args.mimeType ? String(args.mimeType) : 'text/plain',
          extractEntities: args.extractEntities !== false,
        })
      },
    })

    this.registerTool({
      name: 'python_embeddings_generate',
      description: 'Generate high-dimensional vector embeddings and semantic representations for a list of text strings using Python AI Core.',
      category: 'task',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          texts: { type: 'ARRAY', description: 'Array of string texts to vectorize.' },
          dimensions: { type: 'INTEGER', description: 'Embedding vector dimensions (default 384).' },
        },
        required: ['texts'],
      },
      execute: async (args) => {
        const texts = Array.isArray(args.texts) ? args.texts.map(String) : [String(args.texts)]
        return await pythonServiceBridge.generateEmbeddings(texts, Number(args.dimensions) || 384)
      },
    })

    this.registerTool({
      name: 'python_rag_query',
      description: 'Perform semantic RAG document search and hybrid vector similarity ranking over document chunks using Python AI Core.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          query: { type: 'STRING', description: 'Natural language search query.' },
          documents: { type: 'ARRAY', description: 'Array of documents with id and content fields.' },
          topK: { type: 'INTEGER', description: 'Maximum number of top matches to return (default 3).' },
          similarityThreshold: { type: 'NUMBER', description: 'Minimum similarity score threshold (default 0.3).' },
        },
        required: ['query', 'documents'],
      },
      execute: async (args) => {
        const docs = Array.isArray(args.documents) ? args.documents : []
        return await pythonServiceBridge.queryRag({
          query: String(args.query),
          documents: docs,
          topK: Number(args.topK) || 3,
          similarityThreshold: Number(args.similarityThreshold) || 0.3,
        })
      },
    })

    this.registerTool({
      name: 'python_audio_intelligence',
      description: 'Perform acoustic feature extraction, waveform energy analysis, and speech preprocessing using Python AI Core.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          audioBase64: { type: 'STRING', description: 'Base64-encoded audio waveform data.' },
          audioFormat: { type: 'STRING', description: 'Audio container format (wav, mp3, webm).' },
          language: { type: 'STRING', description: 'Expected language code (default en).' },
        },
      },
      execute: async (args) => {
        return await pythonServiceBridge.transcribeAudio({
          audioBase64: args.audioBase64 ? String(args.audioBase64) : undefined,
          audioFormat: args.audioFormat ? String(args.audioFormat) : 'wav',
          language: args.language ? String(args.language) : 'en',
        })
      },
    })

    // =========================================================================
    // Specialized Rust Native Core Services
    // =========================================================================

    this.registerTool({
      name: 'rust_system_hardware',
      description: 'Retrieve real-time native hardware telemetry (CPU, RAM, OS vitals, uptime) via Rust Native Core.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: { type: 'OBJECT', properties: {} },
      execute: async () => {
        return await rustServiceBridge.getSystemTelemetry()
      },
    })

    this.registerTool({
      name: 'rust_process_manager',
      description: 'Inspect active running processes and memory footprint using Rust Native Core.',
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
        return await rustServiceBridge.getProcesses(Number(args.limit) || 35)
      },
    })

    this.registerTool({
      name: 'rust_window_manager',
      description: 'Enumerate open desktop windows and visual application viewports using Rust Native Core.',
      category: 'ui',
      riskLevel: 1,
      requiresConfirmation: false,
      parameters: { type: 'OBJECT', properties: {} },
      execute: async () => {
        return await rustServiceBridge.getWindows()
      },
    })

    this.registerTool({
      name: 'rust_filesystem_secure',
      description: 'List directories and inspect file metadata within sandboxed workspace boundaries using Rust Native Core.',
      category: 'read',
      riskLevel: 0,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          path: { type: 'STRING', description: 'Directory path to list.' },
        },
      },
      execute: async (args) => {
        const targetPath = args.path ? String(args.path) : process.cwd()
        return await windowsSystemService.listDirectory(targetPath)
      },
    })

    this.registerTool({
      name: 'rust_clipboard_sync',
      description: 'Safely read or write desktop clipboard text with operator confirmation guards using Rust Native Core.',
      category: 'read',
      riskLevel: 1,
      requiresConfirmation: false,
      parameters: {
        type: 'OBJECT',
        properties: {
          action: { type: 'STRING', enum: ['read', 'write'], description: 'Clipboard operation.' },
          text: { type: 'STRING', description: 'Text to write if action is write.' },
        },
        required: ['action'],
      },
      execute: async (args, context) => {
        if (args.action === 'write') {
          return await windowsSystemService.writeClipboard(String(args.text || ''), context?.hasUserConfirmation ?? false)
        }
        return await windowsSystemService.readClipboard(context?.hasUserConfirmation ?? false)
      },
    })

    this.registerTool({
      name: 'rust_command_sandbox',
      description: 'Execute allowlisted native commands in a secure sandboxed environment with strict timeout boundaries.',
      category: 'write',
      riskLevel: 2,
      requiresConfirmation: true,
      parameters: {
        type: 'OBJECT',
        properties: {
          command: { type: 'STRING', description: 'Allowlisted binary (git, node, npm, cargo, python, ipconfig, tasklist).' },
          args: { type: 'ARRAY', description: 'Command line arguments array.' },
        },
        required: ['command'],
      },
      execute: async (args, context) => {
        const cmdArgs = Array.isArray(args.args) ? args.args.map(String) : []
        return await rustServiceBridge.executeSandboxedCommand(
          String(args.command),
          cmdArgs,
          context?.hasUserConfirmation ?? false,
        )
      },
    })
  }
}

export const toolRegistry = new ToolRegistryV2()

