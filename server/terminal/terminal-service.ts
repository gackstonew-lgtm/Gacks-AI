import { spawn, ChildProcess } from 'node:child_process'
import { workspaceManager } from '../security/workspace.js'
import { resolve } from 'node:path'

export type TerminalTaskStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out'

export interface TerminalTask {
  id: string
  command: string
  args: string[]
  cwd: string
  status: TerminalTaskStatus
  exitCode: number | null
  stdout: string
  stderr: string
  startedAt: number
  endedAt: number | null
  durationMs: number | null
  timeoutMs: number
  error?: string
}

const MAX_BUFFER_CHARS = 256 * 1024 // 256KB output cap

// Dangerous command blacklists
const BLOCKED_COMMAND_PATTERNS = [
  /\brm\s+-rf\s+([/\\*]|$)/i,
  /\brmdir\s+\/s\s+\/q\s+[a-zA-Z]:\\/i,
  /\bformat\s+[a-zA-Z]:/i,
  /\bmkfs(\.[a-z0-9]+)?\b/i,
  /\bdd\s+if=.*of=\/dev\/[a-z]+/i,
  /\b(shutdown|reboot|poweroff|init\s+0)\b/i,
  /:\(\)\s*\{[^}]*:\s*\|\s*:[^}]*\}/, // Fork bomb
  />\s*\/dev\/sd[a-z]/i,
]

export class TerminalService {
  private tasks: Map<string, TerminalTask> = new Map()
  private runningProcesses: Map<string, ChildProcess> = new Map()
  private listeners: Set<(task: TerminalTask, chunk?: string, isStderr?: boolean) => void> = new Set()

  public onOutput(fn: (task: TerminalTask, chunk?: string, isStderr?: boolean) => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private notify(task: TerminalTask, chunk?: string, isStderr?: boolean) {
    for (const listener of this.listeners) {
      try {
        listener(task, chunk, isStderr)
      } catch {}
    }
  }

  /**
   * Check if command is safe for execution in the approved workspace.
   */
  public validateCommand(commandLine: string): { valid: boolean; error?: string } {
    if (!commandLine || typeof commandLine !== 'string' || !commandLine.trim()) {
      return { valid: false, error: 'Command line must not be empty.' }
    }

    const trimmed = commandLine.trim()
    for (const pattern of BLOCKED_COMMAND_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          valid: false,
          error: `Dangerous command rejected: command matches high-risk pattern (${trimmed.slice(0, 40)}...).`,
        }
      }
    }

    return { valid: true }
  }

  /**
   * Execute a development command within an approved workspace.
   */
  public async executeCommand(
    commandLine: string,
    options: {
      cwd?: string
      timeoutMs?: number
      env?: Record<string, string>
    } = {},
  ): Promise<TerminalTask> {
    const check = this.validateCommand(commandLine)
    if (!check.valid) {
      throw new Error(check.error || 'Command rejected.')
    }

    // Resolve & validate cwd
    const activeWs = workspaceManager.getActiveWorkspace()
    const targetCwd = options.cwd ? resolve(options.cwd) : activeWs.path

    const pathValidation = workspaceManager.validatePath(targetCwd, 'terminal')
    if (!pathValidation.valid || !pathValidation.resolvedPath) {
      throw new Error(pathValidation.error || `Target working directory '${targetCwd}' is not in an approved workspace.`)
    }

    const taskId = `term-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const timeoutMs = Math.max(5000, Math.min(600_000, options.timeoutMs ?? 120_000))

    const task: TerminalTask = {
      id: taskId,
      command: commandLine,
      args: [],
      cwd: pathValidation.resolvedPath,
      status: 'running',
      exitCode: null,
      stdout: '',
      stderr: '',
      startedAt: Date.now(),
      endedAt: null,
      durationMs: null,
      timeoutMs,
    }

    this.tasks.set(taskId, task)
    this.notify(task)

    return new Promise((resolveTask) => {
      let isSettled = false

      const isWin = process.platform === 'win32'
      const shell = isWin ? 'cmd.exe' : '/bin/sh'
      const shellArgs = isWin ? ['/d', '/s', '/c', commandLine] : ['-c', commandLine]

      const child = spawn(shell, shellArgs, {
        cwd: task.cwd,
        windowsVerbatimArguments: isWin,
        env: {
          ...process.env,
          ...(options.env || {}),
          CI: '1',
          FORCE_COLOR: '0',
        },
      })

      this.runningProcesses.set(taskId, child)

      // Timeout watchdog
      const timer = setTimeout(() => {
        if (!isSettled) {
          task.status = 'timed_out'
          task.error = `Command timed out after ${Math.round(timeoutMs / 1000)}s.`
          this.terminateProcess(child)
          finish(124)
        }
      }, timeoutMs)

      const appendStdout = (data: Buffer) => {
        const text = workspaceManager.redactSecrets(data.toString('utf-8'))
        if (task.stdout.length < MAX_BUFFER_CHARS) {
          task.stdout += text
        }
        this.notify(task, text, false)
      }

      const appendStderr = (data: Buffer) => {
        const text = workspaceManager.redactSecrets(data.toString('utf-8'))
        if (task.stderr.length < MAX_BUFFER_CHARS) {
          task.stderr += text
        }
        this.notify(task, text, true)
      }

      child.stdout?.on('data', appendStdout)
      child.stderr?.on('data', appendStderr)

      const finish = (code: number | null) => {
        if (isSettled) return
        isSettled = true
        clearTimeout(timer)
        this.runningProcesses.delete(taskId)

        task.exitCode = code
        task.endedAt = Date.now()
        task.durationMs = task.endedAt - task.startedAt

        if (task.status === 'running') {
          task.status = code === 0 ? 'completed' : 'failed'
        }

        this.notify(task)
        resolveTask(task)
      }

      child.on('error', (err) => {
        task.error = err.message
        task.stderr += `\n[Spawn error: ${err.message}]`
        finish(1)
      })

      child.on('close', (code) => {
        finish(code)
      })
    })
  }

  private terminateProcess(child: ChildProcess) {
    try {
      if (process.platform === 'win32' && child.pid) {
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'])
      } else {
        child.kill('SIGTERM')
        setTimeout(() => {
          try {
            child.kill('SIGKILL')
          } catch {}
        }, 2000)
      }
    } catch {}
  }

  public cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    const proc = this.runningProcesses.get(taskId)

    if (task && proc && task.status === 'running') {
      task.status = 'cancelled'
      task.error = 'Execution cancelled by operator.'
      this.terminateProcess(proc)
      this.runningProcesses.delete(taskId)
      task.endedAt = Date.now()
      task.durationMs = task.endedAt - task.startedAt
      this.notify(task)
      return true
    }
    return false
  }

  public getTask(taskId: string): TerminalTask | undefined {
    return this.tasks.get(taskId)
  }

  public getRecentTasks(limit = 20): TerminalTask[] {
    return Array.from(this.tasks.values())
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit)
  }
}

export const terminalService = new TerminalService()
