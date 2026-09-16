import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Folder,
  FolderPlus,
  FileCode,
  FileText,
  FileImage,
  FileArchive,
  File,
  Search,
  Terminal,
  Play,
  Square,
  RefreshCw,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  Eye,
  X,
  AlertTriangle,
  Trash2,
  Edit2,
  HardDrive,
  LayoutList,
  LayoutGrid,
  Bot,
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  Cpu,
} from 'lucide-react'
import { useStore } from '../../store'
import { navigate } from '../../lib/router'
import { BRIDGE_HTTP_URL } from '../../config'
import {
  apiClient,
  type LocalDrive,
  type LocalFileItem,
  type FilePreviewResult,
} from '../../lib/api-client'

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

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return '--'
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDate(ms?: number): string {
  if (!ms) return '--'
  try {
    const d = new Date(ms)
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '--'
  }
}

function getFileIcon(item: LocalFileItem) {
  if (item.type === 'dir') {
    return <Folder className="w-4 h-4 text-amber-400 shrink-0" />
  }
  const ext = (item.extension || '').toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext)) {
    return <FileImage className="w-4 h-4 text-emerald-400 shrink-0" />
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return <FileArchive className="w-4 h-4 text-yellow-400 shrink-0" />
  }
  if (['ts', 'tsx', 'js', 'jsx', 'json', 'py', 'html', 'css', 'scss', 'rs', 'go', 'php', 'sql'].includes(ext)) {
    return <FileCode className="w-4 h-4 text-[#00A3FF] shrink-0" />
  }
  if (['md', 'txt', 'log', 'csv', 'yaml', 'yml', 'env', 'ini', 'xml'].includes(ext)) {
    return <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
  }
  return <File className="w-4 h-4 text-gray-400 shrink-0" />
}

function getFileTypeLabel(item: LocalFileItem): string {
  if (item.type === 'dir') return 'File folder'
  const ext = (item.extension || '').toLowerCase()
  const map: Record<string, string> = {
    ts: 'TypeScript File',
    tsx: 'TypeScript JSX File',
    js: 'JavaScript File',
    jsx: 'JavaScript JSX File',
    json: 'JSON Document',
    md: 'Markdown Document',
    txt: 'Text Document',
    html: 'HTML Document',
    css: 'CSS Stylesheet',
    py: 'Python File',
    png: 'PNG Image',
    jpg: 'JPEG Image',
    jpeg: 'JPEG Image',
    svg: 'SVG Image',
    pdf: 'PDF Document',
    zip: 'Compressed Archive',
    exe: 'Windows Executable',
    bat: 'Windows Batch File',
    cmd: 'Windows Command Script',
    ps1: 'PowerShell Script',
  }
  return map[ext] || (ext ? `${ext.toUpperCase()} File` : 'File')
}

export const FilesPage: React.FC = () => {
  const submitQuery = useStore((s) => s.submitQuery)

  // Local filesystem navigation state
  const [drives, setDrives] = useState<LocalDrive[]>([])
  const [currentPath, setCurrentPath] = useState<string>('')
  const [parentPath, setParentPath] = useState<string | null>(null)
  const [items, setItems] = useState<LocalFileItem[]>([])
  const [loading, setLoading] = useState(false)
  const [isGatewayOnline, setIsGatewayOnline] = useState<boolean>(true)
  const [permissionError, setPermissionError] = useState<string | null>(null)

  // Navigation history
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number>(-1)

  // Address bar input state
  const [addressInput, setAddressInput] = useState<string>('')
  const addressInputRef = useRef<HTMLInputElement>(null)

  // Search & View preferences
  const [searchFilter, setSearchFilter] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [selectedItem, setSelectedItem] = useState<LocalFileItem | null>(null)

  // Safe Modals
  const [previewData, setPreviewData] = useState<FilePreviewResult | null>(null)
  const [copiedPreview, setCopiedPreview] = useState(false)

  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [modalActionError, setModalActionError] = useState<string | null>(null)
  const [isSubmittingAction, setIsSubmittingAction] = useState(false)

  const [renameTarget, setRenameTarget] = useState<LocalFileItem | null>(null)
  const [renameNewName, setRenameNewName] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<LocalFileItem | null>(null)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')

  // Terminal Runner state
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [customCommand, setCustomCommand] = useState('')
  const [activeTask, setActiveTask] = useState<TerminalTask | null>(null)
  const [runningTerminal, setRunningTerminal] = useState(false)

  // Load directory contents
  const loadDirectory = useCallback(
    async (targetPath?: string, addToHistory = true) => {
      setLoading(true)
      setPermissionError(null)
      try {
        const res = await apiClient.listDirectory(targetPath)
        if (res.ok && res.data) {
          const data = res.data
          setItems(data.items || [])
          setCurrentPath(data.currentPath)
          setAddressInput(data.currentPath)
          setParentPath(data.parentPath)
          setSelectedItem(null)
          setIsGatewayOnline(true)

          if (addToHistory) {
            setHistory((prev) => {
              const sliced = prev.slice(0, historyIndex + 1)
              return [...sliced, data.currentPath]
            })
            setHistoryIndex((prev) => prev + 1)
          }
        } else {
          if (res.status === 403 || res.error?.includes('Access denied') || res.error?.includes('EACCES')) {
            setPermissionError(res.error || 'Access Denied: Windows permissions prevent opening this directory.')
          } else {
            setPermissionError(res.error || 'Unable to open directory.')
          }
          if (res.status === 0 || !res.status) {
            setIsGatewayOnline(false)
          }
        }
      } catch (err: any) {
        setPermissionError(err.message || 'Error communicating with local filesystem service.')
        setIsGatewayOnline(false)
      } finally {
        setLoading(false)
      }
    },
    [historyIndex],
  )

  // Initial mount: fetch drives and load default directory
  useEffect(() => {
    let mounted = true
    const init = async () => {
      try {
        const res = await apiClient.getFsDrives()
        if (!mounted) return
        if (res.ok && res.data) {
          setDrives(res.data.drives || [])
          const initial = res.data.defaultPath || (res.data.drives[0] ? res.data.drives[0].path : 'C:\\')
          setCurrentPath(initial)
          setAddressInput(initial)
          setHistory([initial])
          setHistoryIndex(0)
          loadDirectory(initial, false)
        } else {
          setIsGatewayOnline(false)
        }
      } catch {
        if (mounted) setIsGatewayOnline(false)
      }
    }
    init()
    return () => {
      mounted = false
    }
  }, [])

  // History navigation handlers
  const handleGoBack = () => {
    if (historyIndex > 0) {
      const nextIndex = historyIndex - 1
      const target = history[nextIndex]
      setHistoryIndex(nextIndex)
      loadDirectory(target, false)
    }
  }

  const handleGoForward = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1
      const target = history[nextIndex]
      setHistoryIndex(nextIndex)
      loadDirectory(target, false)
    }
  }

  const handleGoUp = () => {
    if (parentPath) {
      loadDirectory(parentPath, true)
    }
  }

  const handleRefresh = () => {
    loadDirectory(currentPath, false)
  }

  const handleDriveClick = (drivePath: string) => {
    loadDirectory(drivePath, true)
  }

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (addressInput.trim()) {
      loadDirectory(addressInput.trim(), true)
    }
  }

  // Row selection and navigation
  const handleItemClick = (item: LocalFileItem) => {
    setSelectedItem(item)
  }

  const handleItemDoubleClick = (item: LocalFileItem) => {
    if (item.type === 'dir') {
      loadDirectory(item.path, true)
    } else {
      handleOpenFilePreview(item.path)
    }
  }

  // File Preview
  const handleOpenFilePreview = async (filePath: string) => {
    setPreviewData(null)
    setCopiedPreview(false)
    try {
      const res = await apiClient.readFilePreview(filePath)
      if (res.ok && res.data) {
        setPreviewData(res.data)
      } else {
        alert(res.error || 'Failed to read file preview.')
      }
    } catch (err: any) {
      alert(`Preview failed: ${err.message}`)
    }
  }

  const handleCopyPreview = () => {
    if (previewData?.content) {
      navigator.clipboard.writeText(previewData.content)
      setCopiedPreview(true)
      setTimeout(() => setCopiedPreview(false), 2000)
    }
  }

  // Ask Gacks
  const handleInspect = (filePath: string) => {
    submitQuery(`Please inspect and analyze the file: ${filePath}`)
    navigate('chat')
  }

  // Create Folder
  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim()) return
    setIsSubmittingAction(true)
    setModalActionError(null)
    try {
      const res = await apiClient.createFolder(currentPath, newFolderName.trim())
      if (res.ok) {
        setShowNewFolderModal(false)
        setNewFolderName('')
        loadDirectory(currentPath, false)
      } else {
        setModalActionError(res.error || 'Failed to create folder.')
      }
    } catch (err: any) {
      setModalActionError(err.message || 'Creation failed.')
    } finally {
      setIsSubmittingAction(false)
    }
  }

  // Rename
  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!renameTarget || !renameNewName.trim()) return
    setIsSubmittingAction(true)
    setModalActionError(null)
    try {
      const res = await apiClient.renameFile(renameTarget.path, renameNewName.trim())
      if (res.ok) {
        setRenameTarget(null)
        setRenameNewName('')
        loadDirectory(currentPath, false)
      } else {
        setModalActionError(res.error || 'Failed to rename entry.')
      }
    } catch (err: any) {
      setModalActionError(err.message || 'Rename failed.')
    } finally {
      setIsSubmittingAction(false)
    }
  }

  // Delete
  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deleteTarget || deleteConfirmName !== deleteTarget.name) return
    setIsSubmittingAction(true)
    setModalActionError(null)
    try {
      const res = await apiClient.deleteFile(deleteTarget.path, deleteConfirmName)
      if (res.ok) {
        setDeleteTarget(null)
        setDeleteConfirmName('')
        loadDirectory(currentPath, false)
      } else {
        setModalActionError(res.error || 'Failed to delete entry.')
      }
    } catch (err: any) {
      setModalActionError(err.message || 'Delete failed.')
    } finally {
      setIsSubmittingAction(false)
    }
  }

  // Terminal Drawer Execution
  const handleRunCommand = async (cmd: string) => {
    if (!cmd.trim() || runningTerminal) return
    setRunningTerminal(true)
    try {
      const res = await fetch(`${BRIDGE_HTTP_URL}/api/v1/terminal/run`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command: cmd.trim(), cwd: currentPath }),
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

  // Filtered files
  const filtered = useMemo(() => {
    if (!searchFilter.trim()) return items
    const q = searchFilter.toLowerCase()
    return items.filter((f) => f.name.toLowerCase().includes(q))
  }, [items, searchFilter])

  const folderCount = useMemo(() => filtered.filter((i) => i.type === 'dir').length, [filtered])
  const fileCount = useMemo(() => filtered.filter((i) => i.type === 'file').length, [filtered])

  // Extract drive letter for status
  const currentDrive = useMemo(() => {
    const match = currentPath.match(/^([a-zA-Z]:)/)
    return match ? match[1].toUpperCase() : ''
  }, [currentPath])

  return (
    <div className="gacks-page-container gacks-files-page">
      {/* Header */}
      <div className="gacks-page-header">
        <div className="gacks-page-title-wrap">
          <div className="gacks-page-icon-badge">
            <Folder className="w-4 h-4 text-[#00A3FF]" />
          </div>
          <div>
            <h1 className="gacks-page-title">WINDOWS FILE EXPLORER</h1>
            <p className="gacks-page-subtitle">
              Live Windows file manager with drive navigation, safe file actions, and terminal bridge
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={isGatewayOnline ? 'gacks-security-badge-safe' : 'gacks-perm-badge-inactive'}>
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{isGatewayOnline ? 'Local Gateway Active' : 'Gateway Offline'}</span>
          </div>
        </div>
      </div>

      {/* Main File Manager Container */}
      <div className="gacks-fm-container">
        {/* Drive Selector Row */}
        {drives.length > 0 && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-[11px] font-mono text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5 text-[#00A3FF]" />
              Drives:
            </span>
            <div className="gacks-fm-drives-list">
              {drives.map((d) => {
                const isActive = currentPath.toLowerCase().startsWith(d.path.toLowerCase())
                return (
                  <button
                    key={d.path}
                    type="button"
                    className={`gacks-fm-drive-pill ${isActive ? 'gacks-fm-drive-pill-active' : ''}`}
                    onClick={() => handleDriveClick(d.path)}
                    title={`Browse drive ${d.drive}`}
                  >
                    <span>{d.drive}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Windows-style Header Navigation Bar */}
        <div className="gacks-fm-header-bar">
          {/* Navigation Cluster: Back, Forward, Up, Refresh */}
          <div className="gacks-fm-nav-cluster">
            <button
              type="button"
              className="gacks-fm-icon-btn"
              onClick={handleGoBack}
              disabled={historyIndex <= 0}
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="gacks-fm-icon-btn"
              onClick={handleGoForward}
              disabled={historyIndex >= history.length - 1}
              title="Forward"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="gacks-fm-icon-btn"
              onClick={handleGoUp}
              disabled={!parentPath}
              title="Up one level"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="gacks-fm-icon-btn"
              onClick={handleRefresh}
              disabled={loading}
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Address Bar */}
          <form className="gacks-fm-address-box" onSubmit={handleAddressSubmit}>
            <Folder className="w-4 h-4 text-[#00A3FF] shrink-0" />
            <input
              ref={addressInputRef}
              type="text"
              className="gacks-fm-address-input"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              placeholder="Enter absolute Windows path..."
            />
          </form>

          {/* Search Box */}
          <div className="gacks-files-search-box" style={{ width: '220px' }}>
            <Search className="w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              className="gacks-files-search-input"
              placeholder="Search current folder..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
            {searchFilter && (
              <button
                type="button"
                className="text-gray-400 hover:text-white"
                onClick={() => setSearchFilter('')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View Mode & New Folder Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`gacks-fm-icon-btn ${viewMode === 'list' ? 'border-[#00A3FF] text-[#00A3FF]' : ''}`}
              onClick={() => setViewMode('list')}
              title="Details List View"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              type="button"
              className={`gacks-fm-icon-btn ${viewMode === 'grid' ? 'border-[#00A3FF] text-[#00A3FF]' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="gacks-action-btn-primary"
              onClick={() => {
                setNewFolderName('')
                setModalActionError(null)
                setShowNewFolderModal(true)
              }}
              title="Create new folder"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>New Folder</span>
            </button>
          </div>
        </div>

        {/* Windows Permission Error Banner */}
        {permissionError && (
          <div className="p-3.5 bg-amber-950/40 border border-amber-800/60 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider font-mono">
                Access Denied by Windows
              </h4>
              <p className="text-xs text-amber-200/90 mt-1">
                Windows operating system permissions prevent opening this directory.
              </p>
              <p className="text-[11px] font-mono text-amber-300/70 mt-0.5">{permissionError}</p>
            </div>
          </div>
        )}

        {/* File Manager View: List or Grid */}
        {viewMode === 'list' ? (
          <div className="gacks-fm-table-wrap">
            <table className="gacks-fm-table">
              <thead>
                <tr>
                  <th style={{ width: '45%' }}>Name</th>
                  <th style={{ width: '22%' }}>Date modified</th>
                  <th style={{ width: '18%' }}>Type</th>
                  <th style={{ width: '15%' }}>Size</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {parentPath && (
                  <tr className="gacks-fm-row" onDoubleClick={handleGoUp}>
                    <td colSpan={5}>
                      <div className="flex items-center gap-2 text-gray-400 font-mono text-xs py-1">
                        <ArrowUp className="w-4 h-4 text-[#00A3FF]" />
                        <span>.. (Up to {parentPath})</span>
                      </div>
                    </td>
                  </tr>
                )}

                {filtered.map((item) => {
                  const isSelected = selectedItem?.path === item.path
                  const isDir = item.type === 'dir'
                  return (
                    <tr
                      key={item.path}
                      className={`gacks-fm-row ${isSelected ? 'gacks-fm-row-selected' : ''}`}
                      onClick={() => handleItemClick(item)}
                      onDoubleClick={() => handleItemDoubleClick(item)}
                    >
                      <td>
                        <div className="gacks-fm-name-cell">
                          {getFileIcon(item)}
                          <span
                            className={`truncate font-mono text-xs ${
                              isDir ? 'font-semibold text-white' : 'text-gray-200'
                            }`}
                            title={item.name}
                          >
                            {item.name}
                          </span>
                        </div>
                      </td>
                      <td className="font-mono text-xs text-gray-400">{formatDate(item.modifiedAt)}</td>
                      <td className="font-mono text-xs text-gray-400">{getFileTypeLabel(item)}</td>
                      <td className="font-mono text-xs text-gray-400">
                        {item.type === 'file' ? formatBytes(item.size) : ''}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          {!isDir && (
                            <button
                              type="button"
                              className="gacks-file-inspect-btn"
                              onClick={() => handleOpenFilePreview(item.path)}
                              title="Preview file content"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline ml-1">Preview</span>
                            </button>
                          )}
                          {!isDir && (
                            <button
                              type="button"
                              className="gacks-file-inspect-btn text-[#00A3FF] hover:text-[#38BDF8]"
                              onClick={() => handleInspect(item.path)}
                              title="Ask Gacks AI to inspect this file"
                            >
                              <Bot className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline ml-1">Ask Gacks</span>
                            </button>
                          )}
                          <button
                            type="button"
                            className="gacks-file-inspect-btn text-gray-400 hover:text-white"
                            onClick={() => {
                              setRenameTarget(item)
                              setRenameNewName(item.name)
                              setModalActionError(null)
                            }}
                            title="Rename"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            className="gacks-file-inspect-btn text-red-400 hover:text-red-300"
                            onClick={() => {
                              setDeleteTarget(item)
                              setDeleteConfirmName('')
                              setModalActionError(null)
                            }}
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}

                {filtered.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-500 font-mono text-xs">
                      This folder is empty.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="gacks-files-grid">
            {filtered.map((item) => {
              const isDir = item.type === 'dir'
              const isSelected = selectedItem?.path === item.path
              return (
                <div
                  key={item.path}
                  className={`gacks-file-card ${isSelected ? 'border-[#00A3FF] bg-[#1a1c24]' : ''} ${
                    isDir ? 'hover:border-[#00A3FF]/60 cursor-pointer' : ''
                  }`}
                  onClick={() => handleItemClick(item)}
                  onDoubleClick={() => handleItemDoubleClick(item)}
                >
                  <div className="gacks-file-card-header">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {getFileIcon(item)}
                      <span className="text-sm font-semibold text-white font-mono truncate" title={item.name}>
                        {item.name}
                      </span>
                    </div>

                    {item.size !== undefined && !isDir && (
                      <span className="text-xs font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded shrink-0">
                        {formatBytes(item.size)}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] font-mono text-gray-400 mt-2">
                    {getFileTypeLabel(item)} • {formatDate(item.modifiedAt)}
                  </p>

                  <div className="gacks-file-card-actions mt-3">
                    {!isDir && (
                      <button
                        type="button"
                        className="gacks-file-inspect-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenFilePreview(item.path)
                        }}
                        title="View file contents"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        <span>Preview</span>
                      </button>
                    )}

                    {!isDir && (
                      <button
                        type="button"
                        className="gacks-file-inspect-btn text-[#00A3FF]"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleInspect(item.path)
                        }}
                        title="Ask Gacks to examine this file"
                      >
                        <Bot className="w-3.5 h-3.5 mr-1" />
                        <span>Ask Gacks</span>
                      </button>
                    )}

                    <div className="flex items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="p-1 text-gray-400 hover:text-white"
                        onClick={() => {
                          setRenameTarget(item)
                          setRenameNewName(item.name)
                          setModalActionError(null)
                        }}
                        title="Rename"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        className="p-1 text-red-400 hover:text-red-300"
                        onClick={() => {
                          setDeleteTarget(item)
                          setDeleteConfirmName('')
                          setModalActionError(null)
                        }}
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Explorer Bottom Status Bar */}
        <div className="gacks-fm-status-bar">
          <div className="flex items-center gap-3">
            <span>
              {filtered.length} items ({folderCount} folders, {fileCount} files)
            </span>
            {selectedItem && (
              <span className="text-[#38BDF8]">
                Selected: {selectedItem.name} {selectedItem.type === 'file' ? `(${formatBytes(selectedItem.size)})` : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {currentDrive && <span>Volume {currentDrive}</span>}
            <span className="text-gray-500">NTFS Filesystem</span>
          </div>
        </div>
      </div>

      {/* Collapsible Local Terminal Task Drawer */}
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
            <span className="text-[11px] font-mono text-gray-400 truncate max-w-[280px]">
              cwd: {currentPath || '.'}
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
                <CheckCircle2 className="w-3 h-3 text-amber-400" />
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
                placeholder="Enter command in current directory (e.g. dir, git status, npm test)..."
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
                  <div className="text-gray-500 mb-2 font-mono text-xs">
                    $ {activeTask.command} (exit: {activeTask.exitCode ?? 'running'}, duration:{' '}
                    {activeTask.durationMs ? `${activeTask.durationMs}ms` : 'active'})
                  </div>
                  {activeTask.stdout && <div className="text-gray-200 whitespace-pre-wrap">{activeTask.stdout}</div>}
                  {activeTask.stderr && <div className="text-amber-400 mt-1 whitespace-pre-wrap">{activeTask.stderr}</div>}
                  {activeTask.error && <div className="text-red-400 mt-1 whitespace-pre-wrap">{activeTask.error}</div>}
                </>
              ) : (
                <div className="text-gray-500 italic font-mono text-xs">
                  No active terminal session. Select a preset task or enter a custom command to run in this folder.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal: File Preview */}
      {previewData && (
        <div className="gacks-modal-overlay" onClick={() => setPreviewData(null)}>
          <div className="gacks-modal-window" style={{ maxWidth: '820px' }} onClick={(e) => e.stopPropagation()}>
            <div className="gacks-modal-header">
              <div className="flex items-center gap-2 min-w-0">
                <FileCode className="w-4 h-4 text-[#00A3FF] shrink-0" />
                <span className="text-xs font-mono text-white truncate" title={previewData.path}>
                  {previewData.name} ({formatBytes(previewData.size)})
                </span>
                {previewData.truncated && (
                  <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                    Truncated (1MB limit)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  className="gacks-action-btn-secondary py-1 px-2.5"
                  onClick={handleCopyPreview}
                  title="Copy contents"
                >
                  {copiedPreview ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPreview ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  className="gacks-action-btn-primary py-1 px-2.5"
                  onClick={() => {
                    const p = previewData.path
                    setPreviewData(null)
                    handleInspect(p)
                  }}
                  title="Ask Gacks AI to inspect this file"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Ask Gacks</span>
                </button>
                <button
                  type="button"
                  className="text-gray-400 hover:text-white"
                  onClick={() => setPreviewData(null)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="gacks-modal-body p-0">
              {previewData.isBinary ? (
                <div className="p-8 text-center text-gray-400 font-mono text-xs">
                  <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <p>Binary or non-text file preview is not supported.</p>
                  <p className="text-gray-500 text-[11px] mt-1">
                    Open using native Windows desktop applications or reveal in Explorer.
                  </p>
                </div>
              ) : (
                <pre className="p-4 text-xs font-mono text-gray-200 bg-[#0a0a0d] overflow-x-auto whitespace-pre-wrap max-h-[65vh] leading-relaxed">
                  {previewData.content}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Folder */}
      {showNewFolderModal && (
        <div className="gacks-modal-overlay" onClick={() => setShowNewFolderModal(false)}>
          <div className="gacks-modal-window" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="gacks-modal-header">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-[#00A3FF]" />
                <span className="text-sm font-bold text-white">NEW FOLDER</span>
              </div>
              <button
                type="button"
                className="text-gray-400 hover:text-white"
                onClick={() => setShowNewFolderModal(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFolderSubmit} className="gacks-modal-body">
              <p className="text-xs text-gray-400">
                Create a new subfolder in: <span className="text-white font-mono">{currentPath}</span>
              </p>

              {modalActionError && (
                <div className="p-2.5 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{modalActionError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono text-gray-300 mb-1">Folder Name:</label>
                <input
                  type="text"
                  className="w-full bg-[#0d0d10] border border-white/10 rounded px-3 py-2 text-xs font-mono text-white outline-none focus:border-[#00A3FF]"
                  placeholder="e.g. documentation"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  className="gacks-action-btn-secondary"
                  onClick={() => setShowNewFolderModal(false)}
                  disabled={isSubmittingAction}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="gacks-action-btn-primary"
                  disabled={isSubmittingAction || !newFolderName.trim()}
                >
                  {isSubmittingAction ? 'Creating...' : 'Create Folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Rename */}
      {renameTarget && (
        <div className="gacks-modal-overlay" onClick={() => setRenameTarget(null)}>
          <div className="gacks-modal-window" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="gacks-modal-header">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-[#00A3FF]" />
                <span className="text-sm font-bold text-white">RENAME ENTRY</span>
              </div>
              <button
                type="button"
                className="text-gray-400 hover:text-white"
                onClick={() => setRenameTarget(null)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRenameSubmit} className="gacks-modal-body">
              <p className="text-xs text-gray-400">
                Rename <span className="text-white font-mono font-semibold">{renameTarget.name}</span> to a new name.
              </p>

              {modalActionError && (
                <div className="p-2.5 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{modalActionError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono text-gray-300 mb-1">New Name:</label>
                <input
                  type="text"
                  className="w-full bg-[#0d0d10] border border-white/10 rounded px-3 py-2 text-xs font-mono text-white outline-none focus:border-[#00A3FF]"
                  value={renameNewName}
                  onChange={(e) => setRenameNewName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  className="gacks-action-btn-secondary"
                  onClick={() => setRenameTarget(null)}
                  disabled={isSubmittingAction}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="gacks-action-btn-primary"
                  disabled={isSubmittingAction || !renameNewName.trim() || renameNewName === renameTarget.name}
                >
                  {isSubmittingAction ? 'Renaming...' : 'Rename'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Confirmation (Mandatory Exact Match) */}
      {deleteTarget && (
        <div className="gacks-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="gacks-modal-window" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="gacks-modal-header">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-400" />
                <span className="text-sm font-bold text-red-400">CONFIRM DELETION</span>
              </div>
              <button
                type="button"
                className="text-gray-400 hover:text-white"
                onClick={() => setDeleteTarget(null)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDeleteSubmit} className="gacks-modal-body">
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded text-xs text-red-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">This action permanently deletes the selected item:</p>
                  <p className="font-mono text-white mt-1 break-all">{deleteTarget.path}</p>
                </div>
              </div>

              {modalActionError && (
                <div className="p-2.5 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{modalActionError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono text-gray-300 mb-1">
                  Type <span className="text-white font-bold font-mono">{deleteTarget.name}</span> to confirm:
                </label>
                <input
                  type="text"
                  className="w-full bg-[#0d0d10] border border-white/10 rounded px-3 py-2 text-xs font-mono text-white outline-none focus:border-red-500"
                  placeholder={deleteTarget.name}
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  className="gacks-action-btn-secondary"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isSubmittingAction}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded text-xs font-semibold bg-red-600 hover:bg-red-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition"
                  disabled={isSubmittingAction || deleteConfirmName !== deleteTarget.name}
                >
                  {isSubmittingAction ? 'Deleting...' : 'Permanently Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
