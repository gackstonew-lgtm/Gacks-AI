import React, { useState, useEffect, useCallback } from 'react'
import {
  Folder,
  FolderPlus,
  FileCode,
  FileText,
  ShieldCheck,
  Search,
  Terminal,
  Play,
  Square,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ArrowUp,
  Eye,
  X,
  CheckCircle,
  AlertTriangle,
  Lock,
  Trash2,
  Cpu,
} from 'lucide-react'
import { useStore } from '../../store'
import { navigate } from '../../lib/router'
import { BRIDGE_HTTP_URL } from '../../config'

interface ApprovedWorkspace {
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

interface FileEntry {
  name: string
  path: string
  fullPath?: string
  type: 'dir' | 'file'
  size?: number
  modifiedAt?: number
  isSensitive?: boolean
  desc?: string
}

interface TerminalTask {
  id: string
  command: string
  cwd: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timed_out'
  exitCode: number | null
  stdout: string
  stderr: string
  startedAt: number
  endedAt: number | null
  durationMs: number | null
  error?: string
}

const FALLBACK_FILES: FileEntry[] = [
  { name: 'server', path: 'server', type: 'dir', desc: 'Agent Runtime: Context Engine, Planner, Executor, Gateway' },
  { name: 'src', path: 'src', type: 'dir', desc: 'React 19 Frontend: HUD, Arc Reactor Three.js, Control Center' },
  { name: 'bridge', path: 'bridge', type: 'dir', desc: 'Node Bridge network gate & media proxy' },
  { name: 'tests', path: 'tests', type: 'dir', desc: 'Architectural test suite' },
  { name: 'package.json', path: 'package.json', type: 'file', size: 1840, desc: 'Dependencies & build scripts' },
  { name: 'tsconfig.json', path: 'tsconfig.json', type: 'file', size: 1120, desc: 'Strict TypeScript configuration' },
  { name: 'vite.config.ts', path: 'vite.config.ts', type: 'file', size: 820, desc: 'Vite build configuration' },
  { name: 'ARCHITECTURE.md', path: 'ARCHITECTURE.md', type: 'file', size: 8600, desc: 'GACKS P.A. V2 architecture specification' },
  { name: 'DEPLOYMENT.md', path: 'DEPLOYMENT.md', type: 'file', size: 5300, desc: 'Cloud deployment runbook' },
  { name: 'Dockerfile', path: 'Dockerfile', type: 'file', size: 1200, desc: 'Production container setup' },
  { name: '.env.example', path: '.env.example', type: 'file', size: 920, desc: 'Environment variables template', isSensitive: true },
]

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const FilesPage: React.FC = () => {
  const submitQuery = useStore((s) => s.submitQuery)

  // Workspaces state
  const [workspaces, setWorkspaces] = useState<ApprovedWorkspace[]>([])
  const [activeWorkspace, setActiveWorkspace] = useState<ApprovedWorkspace | null>(null)
  const [currentSubpath, setCurrentSubpath] = useState<string>('.')
  const [items, setItems] = useState<FileEntry[]>(FALLBACK_FILES)
  const [loading, setLoading] = useState(false)
  const [bridgeConnected, setBridgeConnected] = useState(true)

  // Search & Filter
  const [searchFilter, setSearchFilter] = useState('')

  // Modals & Preview
  const [previewFile, setPreviewFile] = useState<{ path: string; content: string } | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newPath, setNewPath] = useState('')
  const [newName, setNewName] = useState('')
  const [newPerms, setNewPerms] = useState({ read: true, write: true, terminal: true })
  const [modalError, setModalError] = useState<string | null>(null)

  // Terminal state
  const [terminalOpen, setTerminalOpen] = useState(true)
  const [customCommand, setCustomCommand] = useState('')
  const [activeTask, setActiveTask] = useState<TerminalTask | null>(null)
  const [runningTerminal, setRunningTerminal] = useState(false)

  // Load Workspaces
  const loadWorkspaces = useCallback(async () => {
    try {
      const res = await fetch(`${BRIDGE_HTTP_URL}/api/v1/workspaces`)
      if (!res.ok) throw new Error('Gateway unavailable')
      const data = await res.json()
      setWorkspaces(data.workspaces || [])
      setActiveWorkspace(data.activeWorkspace || null)
      setBridgeConnected(true)
    } catch {
      setBridgeConnected(false)
    }
  }, [])

  // Load Directory Items
  const loadDirectory = useCallback(
    async (subpath = '.') => {
      setLoading(true)
      try {
        const url = `${BRIDGE_HTTP_URL}/api/v1/fs/list?path=${encodeURIComponent(subpath)}`
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Failed to load directory: ${res.statusText}`)
        const data = await res.json()
        if (data.items) {
          setItems(data.items)
          setCurrentSubpath(data.currentPath || subpath)
          setBridgeConnected(true)
        }
      } catch (e) {
        console.warn('[FilesPage] Local bridge offline or fetch error, using fallback view.', e)
        setBridgeConnected(false)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    loadWorkspaces()
    loadDirectory('.')
  }, [loadWorkspaces, loadDirectory])

  // Select Workspace
  const handleSelectWorkspace = async (id: string) => {
    try {
      const res = await fetch(`${BRIDGE_HTTP_URL}/api/v1/workspaces/select`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        const data = await res.json()
        setActiveWorkspace(data.activeWorkspace)
        setCurrentSubpath('.')
        loadDirectory('.')
      }
    } catch {}
  }

  // Add Workspace
  const handleAddWorkspaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setModalError(null)
    if (!newPath.trim()) {
      setModalError('Local folder path is required.')
      return
    }

    try {
      const res = await fetch(`${BRIDGE_HTTP_URL}/api/v1/workspaces`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          path: newPath.trim(),
          name: newName.trim() || undefined,
          permissions: newPerms,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add workspace')
      }

      setShowAddModal(false)
      setNewPath('')
      setNewName('')
      await loadWorkspaces()
      loadDirectory('.')
    } catch (err: any) {
      setModalError(err.message)
    }
  }

  // Revoke Workspace
  const handleRevokeWorkspace = async (id: string) => {
    if (id === 'default') return
    try {
      const res = await fetch(`${BRIDGE_HTTP_URL}/api/v1/workspaces?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        await loadWorkspaces()
        loadDirectory('.')
      }
    } catch {}
  }

  // Reveal in Explorer
  const handleReveal = async (path = '.') => {
    try {
      await fetch(`${BRIDGE_HTTP_URL}/api/v1/fs/reveal`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: path || currentSubpath }),
      })
    } catch {}
  }

  // Preview File
  const handlePreview = async (filePath: string) => {
    try {
      const res = await fetch(`${BRIDGE_HTTP_URL}/api/v1/fs/read?path=${encodeURIComponent(filePath)}`)
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed to read file')
        return
      }
      const data = await res.json()
      setPreviewFile({ path: filePath, content: data.content })
    } catch (e: any) {
      alert(`Preview unavailable: ${e.message}`)
    }
  }

  // Ask Gacks to Inspect
  const handleInspect = (filePath: string) => {
    submitQuery(`Please inspect and analyze the file: ${filePath}`)
    navigate('chat')
  }

  // Navigate Directory
  const handleNavigate = (targetPath: string) => {
    loadDirectory(targetPath)
  }

  const handleNavigateUp = () => {
    if (currentSubpath === '.' || currentSubpath === '') return
    const parts = currentSubpath.split(/[\\/]/).filter(Boolean)
    parts.pop()
    const parent = parts.length === 0 ? '.' : parts.join('/')
    loadDirectory(parent)
  }

  // Terminal Execution
  const handleRunCommand = async (cmd: string) => {
    if (!cmd.trim() || runningTerminal) return
    setRunningTerminal(true)
    try {
      const res = await fetch(`${BRIDGE_HTTP_URL}/api/v1/terminal/run`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command: cmd.trim(), cwd: currentSubpath }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Terminal command execution failed.')
        return
      }
      setActiveTask(data.task)
    } catch (err: any) {
      alert(`Terminal execution failed: ${err.message}`)
    } finally {
      setRunningTerminal(false)
    }
  }

  const handleCancelCommand = async () => {
    if (!activeTask || activeTask.status !== 'running') return
    try {
      await fetch(`${BRIDGE_HTTP_URL}/api/v1/terminal/cancel`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ taskId: activeTask.id }),
      })
      setActiveTask({
        ...activeTask,
        status: 'cancelled',
        error: 'Execution cancelled by operator.',
      })
    } catch {}
  }

  // Filter items
  const filtered = items.filter(
    (f) =>
      f.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (f.desc && f.desc.toLowerCase().includes(searchFilter.toLowerCase())),
  )

  // Breadcrumbs calculation
  const breadcrumbs = currentSubpath === '.' ? [] : currentSubpath.split(/[\\/]/).filter(Boolean)

  return (
    <div className="gacks-page-container gacks-files-page">
      {/* Header */}
      <div className="gacks-page-header">
        <div className="gacks-page-title-wrap">
          <div className="gacks-page-icon-badge">
            <Folder className="w-4 h-4 text-[#00A3FF]" />
          </div>
          <div>
            <h1 className="gacks-page-title">LOCAL WORKSPACE & FILE SYSTEM</h1>
            <p className="gacks-page-subtitle">
              Secure local operator environment with approved workspace isolation and terminal bridge
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={bridgeConnected ? 'gacks-security-badge-safe' : 'gacks-perm-badge-inactive'}>
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{bridgeConnected ? 'Local Bridge Active' : 'Offline Mode'}</span>
          </div>
        </div>
      </div>

      {/* Workspace Management Bar */}
      <div className="gacks-workspace-card">
        <div className="gacks-workspace-header-row">
          <div className="gacks-workspace-info">
            <div className="gacks-workspace-name-wrap">
              <span className="gacks-workspace-name">
                {activeWorkspace?.name || 'Local Repository Workspace'}
              </span>
              {workspaces.length > 1 && (
                <select
                  value={activeWorkspace?.id}
                  onChange={(e) => handleSelectWorkspace(e.target.value)}
                  className="bg-[#141418] border border-white/10 text-xs text-white rounded px-2 py-0.5 outline-none font-mono"
                >
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <span className="gacks-workspace-path">
              Path: {activeWorkspace?.path || 'Approved Workspace Root'}
            </span>
          </div>

          <div className="gacks-workspace-actions">
            <div className="gacks-workspace-badges">
              <span className="gacks-perm-badge gacks-perm-badge-active">
                <CheckCircle className="w-3 h-3" /> Read
              </span>
              <span
                className={`gacks-perm-badge ${
                  activeWorkspace?.permissions?.write !== false
                    ? 'gacks-perm-badge-active'
                    : 'gacks-perm-badge-inactive'
                }`}
              >
                {activeWorkspace?.permissions?.write !== false ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <Lock className="w-3 h-3" />
                )}
                Write
              </span>
              <span
                className={`gacks-perm-badge ${
                  activeWorkspace?.permissions?.terminal !== false
                    ? 'gacks-perm-badge-active'
                    : 'gacks-perm-badge-inactive'
                }`}
              >
                {activeWorkspace?.permissions?.terminal !== false ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <Lock className="w-3 h-3" />
                )}
                Terminal
              </span>
            </div>

            <button
              type="button"
              className="gacks-action-btn-secondary"
              onClick={() => handleReveal(currentSubpath)}
              title="Reveal active folder in Explorer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Reveal in Explorer</span>
            </button>

            <button
              type="button"
              className="gacks-action-btn-primary"
              onClick={() => setShowAddModal(true)}
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Grant Folder Access</span>
            </button>

            {activeWorkspace && activeWorkspace.id !== 'default' && (
              <button
                type="button"
                className="gacks-action-btn-secondary text-red-400 hover:text-red-300"
                onClick={() => handleRevokeWorkspace(activeWorkspace.id)}
                title="Revoke access to this workspace"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Revoke</span>
              </button>
            )}

            <button
              type="button"
              className="gacks-action-btn-secondary"
              onClick={() => loadDirectory(currentSubpath)}
              disabled={loading}
              title="Refresh directory contents"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Directory Breadcrumbs Bar */}
      <div className="gacks-breadcrumb-bar">
        <button
          type="button"
          className={`gacks-breadcrumb-item ${breadcrumbs.length === 0 ? 'gacks-breadcrumb-active' : ''}`}
          onClick={() => handleNavigate('.')}
        >
          <Folder className="w-3.5 h-3.5 text-[#00A3FF]" />
          <span>Root</span>
        </button>

        {breadcrumbs.map((segment, idx) => {
          const sub = breadcrumbs.slice(0, idx + 1).join('/')
          const isLast = idx === breadcrumbs.length - 1
          return (
            <React.Fragment key={sub}>
              <ChevronRight className="w-3 h-3 text-gray-500 shrink-0" />
              <button
                type="button"
                className={`gacks-breadcrumb-item ${isLast ? 'gacks-breadcrumb-active' : ''}`}
                onClick={() => handleNavigate(sub)}
              >
                <span>{segment}</span>
              </button>
            </React.Fragment>
          )
        })}
      </div>

      {/* Filter & Search Bar */}
      <div className="gacks-files-filter-bar">
        <div className="gacks-files-search-box">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            className="gacks-files-search-input"
            placeholder="Search files and directories in current path..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
        </div>
        <span className="text-xs font-mono text-gray-400">
          Showing {filtered.length} items {currentSubpath !== '.' ? `in ${currentSubpath}` : ''}
        </span>
      </div>

      {/* File & Folder Grid */}
      <div className="gacks-files-grid">
        {currentSubpath !== '.' && (
          <div
            className="gacks-file-card cursor-pointer border-dashed border-white/20 hover:border-[#00A3FF]"
            onClick={handleNavigateUp}
          >
            <div className="gacks-file-card-header">
              <div className="flex items-center gap-2.5">
                <ArrowUp className="w-5 h-5 text-[#00A3FF]" />
                <span className="text-sm font-mono text-white font-semibold">.. (Up one level)</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Return to parent directory</p>
          </div>
        )}

        {filtered.map((item) => {
          const isDir = item.type === 'dir'
          return (
            <div
              key={item.path}
              className={`gacks-file-card ${isDir ? 'hover:border-[#00A3FF]/60 cursor-pointer' : ''}`}
              onClick={isDir ? () => handleNavigate(item.path) : undefined}
            >
              <div className="gacks-file-card-header">
                <div className="flex items-center gap-2.5 min-w-0">
                  {isDir ? (
                    <Folder className="w-5 h-5 text-amber-400 shrink-0" />
                  ) : item.name.endsWith('.md') ? (
                    <FileText className="w-5 h-5 text-cyan-400 shrink-0" />
                  ) : (
                    <FileCode className="w-5 h-5 text-[#00A3FF] shrink-0" />
                  )}
                  <span className="text-sm font-semibold text-white font-mono truncate" title={item.name}>
                    {item.name}
                  </span>
                </div>

                {item.isSensitive && (
                  <span className="text-[10px] font-mono bg-red-950/80 text-red-400 border border-red-800/60 px-1.5 py-0.5 rounded">
                    PROTECTED
                  </span>
                )}

                {item.size !== undefined && (
                  <span className="text-xs font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded shrink-0">
                    {formatBytes(item.size)}
                  </span>
                )}
              </div>

              {item.desc && <p className="text-xs text-gray-400 line-clamp-2 mt-2 mb-3">{item.desc}</p>}

              <div className="gacks-file-card-actions">
                {!isDir && (
                  <button
                    type="button"
                    className="gacks-file-inspect-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      handlePreview(item.path)
                    }}
                    title="View file contents"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    <span>Preview</span>
                  </button>
                )}

                <button
                  type="button"
                  className="gacks-file-inspect-btn ml-auto"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleInspect(item.path)
                  }}
                  title="Ask Gacks to examine this file"
                >
                  <span>Ask Gacks</span>
                  <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Collapsible Terminal Task Drawer */}
      <div className="gacks-terminal-drawer">
        <div
          className="gacks-terminal-header"
          onClick={() => setTerminalOpen((v) => !v)}
          title="Toggle Terminal Drawer"
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#00A3FF]" />
            <span className="text-xs font-mono font-bold text-white tracking-wider">
              LOCAL WORKSPACE TERMINAL ENGINE
            </span>
            {activeTask && (
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                  activeTask.status === 'running'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                    : activeTask.status === 'completed'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}
              >
                {activeTask.status.toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-gray-400">
              cwd: {currentSubpath !== '.' ? currentSubpath : activeWorkspace?.name || 'root'}
            </span>
            <span className="text-xs text-[#00A3FF] font-mono">{terminalOpen ? '▲ Collapse' : '▼ Expand'}</span>
          </div>
        </div>

        {terminalOpen && (
          <div className="gacks-terminal-body">
            {/* Command Presets */}
            <div className="gacks-terminal-controls">
              <span className="text-xs font-mono text-gray-400">Tasks:</span>
              <button
                type="button"
                className="gacks-terminal-chip"
                onClick={() => handleRunCommand('npm run build')}
                disabled={runningTerminal}
              >
                <Play className="w-3 h-3 text-emerald-400" />
                <span>npm run build</span>
              </button>
              <button
                type="button"
                className="gacks-terminal-chip"
                onClick={() => handleRunCommand('npm test')}
                disabled={runningTerminal}
              >
                <Cpu className="w-3 h-3 text-cyan-400" />
                <span>npm test</span>
              </button>
              <button
                type="button"
                className="gacks-terminal-chip"
                onClick={() => handleRunCommand('npm run lint')}
                disabled={runningTerminal}
              >
                <CheckCircle className="w-3 h-3 text-amber-400" />
                <span>npm run lint</span>
              </button>

              {activeTask?.status === 'running' && (
                <button
                  type="button"
                  className="gacks-terminal-chip text-red-400 border-red-500/40 hover:bg-red-950/40 ml-auto"
                  onClick={handleCancelCommand}
                >
                  <Square className="w-3 h-3 fill-red-400" />
                  <span>Cancel Process</span>
                </button>
              )}
            </div>

            {/* Custom Command Input */}
            <form
              className="gacks-terminal-input-bar"
              onSubmit={(e) => {
                e.preventDefault()
                handleRunCommand(customCommand)
              }}
            >
              <Terminal className="w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                className="gacks-terminal-input"
                placeholder="Enter development command (e.g. npm test, npx tsc --noEmit)..."
                value={customCommand}
                onChange={(e) => setCustomCommand(e.target.value)}
                disabled={runningTerminal}
              />
              <button
                type="submit"
                className="gacks-action-btn-primary py-1 px-3"
                disabled={runningTerminal || !customCommand.trim()}
              >
                <Play className="w-3 h-3" />
                <span>Execute</span>
              </button>
            </form>

            {/* Console Output Viewer */}
            <div className="gacks-terminal-screen">
              {activeTask ? (
                <>
                  <div className="text-gray-500 mb-2">
                    $ {activeTask.command} (exit: {activeTask.exitCode ?? 'running'}, duration:{' '}
                    {activeTask.durationMs ? `${activeTask.durationMs}ms` : 'active'})
                  </div>
                  {activeTask.stdout && <div className="text-gray-200">{activeTask.stdout}</div>}
                  {activeTask.stderr && <div className="text-amber-400 mt-1">{activeTask.stderr}</div>}
                  {activeTask.error && <div className="text-red-400 mt-1">{activeTask.error}</div>}
                </>
              ) : (
                <div className="text-gray-500 italic">
                  No active terminal session. Select a task above or enter a command to run within the approved workspace.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Grant Access / Add Workspace Modal */}
      {showAddModal && (
        <div className="gacks-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="gacks-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="gacks-modal-header">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-[#00A3FF]" />
                <span className="text-sm font-bold text-white">GRANT LOCAL WORKSPACE ACCESS</span>
              </div>
              <button
                type="button"
                className="text-gray-400 hover:text-white"
                onClick={() => setShowAddModal(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddWorkspaceSubmit} className="gacks-modal-body">
              <p className="text-xs text-gray-400">
                Register an approved local directory for the GACKS AI Operator. All file modifications and terminal
                commands will be strictly isolated to this path.
              </p>

              {modalError && (
                <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono text-gray-300 mb-1">
                  Local Folder Path (Absolute):
                </label>
                <input
                  type="text"
                  className="w-full bg-[#0d0d10] border border-white/10 rounded px-3 py-2 text-xs font-mono text-white outline-none focus:border-[#00A3FF]"
                  placeholder="e.g. C:/xampp/htdocs/MyProject"
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-300 mb-1">
                  Workspace Display Name (Optional):
                </label>
                <input
                  type="text"
                  className="w-full bg-[#0d0d10] border border-white/10 rounded px-3 py-2 text-xs font-mono text-white outline-none focus:border-[#00A3FF]"
                  placeholder="e.g. Client Web App"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-300 mb-2">Granted Permissions:</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs text-white font-mono cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPerms.read}
                      onChange={(e) => setNewPerms({ ...newPerms, read: e.target.checked })}
                    />
                    <span>Read Files</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-white font-mono cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPerms.write}
                      onChange={(e) => setNewPerms({ ...newPerms, write: e.target.checked })}
                    />
                    <span>Write Files</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-white font-mono cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPerms.terminal}
                      onChange={(e) => setNewPerms({ ...newPerms, terminal: e.target.checked })}
                    />
                    <span>Terminal Commands</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  className="gacks-action-btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="gacks-action-btn-primary">
                  Approve & Save Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <div className="gacks-modal-overlay" onClick={() => setPreviewFile(null)}>
          <div className="gacks-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="gacks-modal-header">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-[#00A3FF]" />
                <span className="text-xs font-mono text-white">{previewFile.path}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="gacks-action-btn-primary py-1 px-2.5"
                  onClick={() => {
                    const p = previewFile.path
                    setPreviewFile(null)
                    handleInspect(p)
                  }}
                >
                  <span>Ask Gacks</span>
                </button>
                <button
                  type="button"
                  className="text-gray-400 hover:text-white"
                  onClick={() => setPreviewFile(null)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="gacks-modal-body p-0">
              <pre className="p-4 text-xs font-mono text-gray-200 bg-[#0a0a0d] overflow-x-auto whitespace-pre-wrap max-h-[60vh] leading-relaxed">
                {previewFile.content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

