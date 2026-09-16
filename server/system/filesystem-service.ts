import os from 'node:os'
import path from 'node:path'
import { readdir, stat, readFile, mkdir, rename, rm, access } from 'node:fs/promises'
import { constants } from 'node:fs'

export interface LocalDrive {
  drive: string
  path: string
  label: string
}

export interface LocalFileItem {
  name: string
  path: string
  type: 'dir' | 'file'
  size?: number
  extension?: string
  modifiedAt?: number
  isSensitive?: boolean
  isReadOnly?: boolean
}

export interface DirectoryListingResult {
  currentPath: string
  parentPath: string | null
  drive: string
  items: LocalFileItem[]
  totalItems: number
  totalDirs: number
  totalFiles: number
}

const SENSITIVE_PATTERNS = [
  /^\.env(\..+)?$/i,
  /\.(pem|key|pkcs12|pfx|p12|kdbx)$/i,
  /^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /^(credentials|service-account|client-secret)\.json$/i,
  /^\.npmrc$/i,
  /^\.netrc$/i,
]

const SYSTEM_PROTECTED_PATHS = new Set([
  'c:\\windows',
  'c:\\program files',
  'c:\\program files (x86)',
  'c:\\system volume information',
  'c:\\$recycle.bin',
  'c:\\recovery',
  '/',
  '/bin',
  '/sbin',
  '/usr',
  '/etc',
  '/root',
])

export class LocalFilesystemService {
  /**
   * Enumerate accessible physical disk drives on Windows or system roots.
   */
  public async getDrives(): Promise<LocalDrive[]> {
    if (process.platform === 'win32') {
      const drives: LocalDrive[] = []
      // Check common drive letters C through Z
      for (let code = 67; code <= 90; code++) {
        const letter = String.fromCharCode(code)
        const root = `${letter}:\\`
        try {
          await access(root, constants.R_OK)
          drives.push({
            drive: `${letter}:`,
            path: root,
            label: letter === 'C' ? `OS Disk (${letter}:)` : `Local Drive (${letter}:)`,
          })
        } catch {
          // Drive letter not mounted or not accessible
        }
      }
      if (drives.length > 0) return drives
    }

    return [{ drive: 'Root', path: path.resolve('/'), label: 'System Root' }]
  }

  /**
   * Determine the default starting directory dynamically.
   */
  public getDefaultPath(): string {
    try {
      const home = os.homedir()
      if (home && home.trim()) {
        return path.normalize(home)
      }
    } catch {}
    return path.normalize(process.cwd())
  }

  /**
   * Sanitize and validate path string.
   */
  public sanitizePath(rawPath?: string): string {
    if (!rawPath || typeof rawPath !== 'string' || !rawPath.trim()) {
      return this.getDefaultPath()
    }
    // Prevent null-byte injection
    if (rawPath.includes('\0')) {
      throw new Error('Invalid path format: null bytes are forbidden.')
    }
    const normalized = path.normalize(rawPath.trim())
    return path.resolve(normalized)
  }

  /**
   * Check if a file is considered a sensitive credential file.
   */
  public isSensitive(filename: string): boolean {
    return SENSITIVE_PATTERNS.some((re) => re.test(filename))
  }

  /**
   * List directory contents for the specified path with metadata.
   */
  public async listDirectory(targetPath?: string): Promise<DirectoryListingResult> {
    const resolvedPath = this.sanitizePath(targetPath)

    try {
      const dirStat = await stat(resolvedPath)
      if (!dirStat.isDirectory()) {
        throw new Error(`Specified path is not a directory: ${resolvedPath}`)
      }
    } catch (err: any) {
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        const customErr: any = new Error(`Access denied: Windows permissions prevent opening this directory.`)
        customErr.code = 'EACCES'
        throw customErr
      }
      if (err.code === 'ENOENT') {
        const customErr: any = new Error(`Directory not found: ${resolvedPath}`)
        customErr.code = 'ENOENT'
        throw customErr
      }
      throw err
    }

    let entries: import('node:fs').Dirent[]
    try {
      entries = await readdir(resolvedPath, { withFileTypes: true })
    } catch (err: any) {
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        const customErr: any = new Error(`Access denied: Insufficient permissions to read contents of ${resolvedPath}`)
        customErr.code = 'EACCES'
        throw customErr
      }
      throw err
    }

    const items: LocalFileItem[] = []

    for (const ent of entries) {
      const full = path.join(resolvedPath, ent.name)
      const isDir = ent.isDirectory()
      let size: number | undefined
      let modifiedAt: number | undefined

      try {
        const st = await stat(full)
        size = isDir ? undefined : st.size
        modifiedAt = st.mtimeMs
      } catch {
        // Protected item or broken symlink
      }

      const ext = isDir ? undefined : path.extname(ent.name).toLowerCase().replace(/^\./, '')

      items.push({
        name: ent.name,
        path: full,
        type: isDir ? 'dir' : 'file',
        size,
        extension: ext,
        modifiedAt,
        isSensitive: this.isSensitive(ent.name),
      })
    }

    // Sort: directories first, then alphabetically case-insensitive
    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })

    const parent = path.dirname(resolvedPath)
    const parentPath = parent !== resolvedPath ? parent : null
    const drive = resolvedPath.match(/^[A-Za-z]:/)?.[0] || 'Root'

    return {
      currentPath: resolvedPath,
      parentPath,
      drive,
      items,
      totalItems: items.length,
      totalDirs: items.filter((i) => i.type === 'dir').length,
      totalFiles: items.filter((i) => i.type === 'file').length,
    }
  }

  /**
   * Read preview content of a text or code file (bounded to maxBytes).
   */
  public async readFilePreview(
    filePath: string,
    maxBytes = 1048576, // 1MB limit for safe in-browser viewing
  ): Promise<{
    path: string
    name: string
    size: number
    modifiedAt: number
    content: string
    isBinary: boolean
    truncated: boolean
  }> {
    const resolvedPath = this.sanitizePath(filePath)
    const fileName = path.basename(resolvedPath)

    if (this.isSensitive(fileName)) {
      throw new Error('Access denied: Viewing sensitive configuration or key files is restricted.')
    }

    const st = await stat(resolvedPath)
    if (st.isDirectory()) {
      throw new Error('Cannot preview a directory as file content.')
    }

    const buffer = await readFile(resolvedPath)
    const isTruncated = buffer.length > maxBytes
    const slice = isTruncated ? buffer.subarray(0, maxBytes) : buffer

    // Check for binary content (control characters)
    let isBinary = false
    const checkLength = Math.min(slice.length, 512)
    for (let i = 0; i < checkLength; i++) {
      if (slice[i] === 0) {
        isBinary = true
        break
      }
    }

    const content = isBinary ? '[Binary file contents cannot be displayed as plain text]' : slice.toString('utf-8')

    return {
      path: resolvedPath,
      name: fileName,
      size: st.size,
      modifiedAt: st.mtimeMs,
      content,
      isBinary,
      truncated: isTruncated,
    }
  }

  /**
   * Safely create a new directory inside an existing parent path.
   */
  public async createDirectory(parentPath: string, folderName: string): Promise<string> {
    const cleanParent = this.sanitizePath(parentPath)
    const cleanName = folderName.trim()

    if (!cleanName || /[\\/:*?"<>|]/.test(cleanName)) {
      throw new Error('Invalid folder name: Contains illegal filesystem characters.')
    }

    const target = path.join(cleanParent, cleanName)
    await mkdir(target, { recursive: false })
    return target
  }

  /**
   * Safely rename a file or folder.
   */
  public async renameEntry(oldPath: string, newName: string): Promise<string> {
    const cleanOld = this.sanitizePath(oldPath)
    const cleanName = newName.trim()

    if (!cleanName || /[\\/:*?"<>|]/.test(cleanName)) {
      throw new Error('Invalid new name: Contains illegal filesystem characters.')
    }

    const parent = path.dirname(cleanOld)
    const cleanNew = path.join(parent, cleanName)

    await rename(cleanOld, cleanNew)
    return cleanNew
  }

  /**
   * Safely delete a file or directory with mandatory confirmation name matching.
   */
  public async deleteEntry(targetPath: string, confirmName: string): Promise<void> {
    const cleanTarget = this.sanitizePath(targetPath)
    const base = path.basename(cleanTarget)

    if (base.toLowerCase() !== confirmName.trim().toLowerCase()) {
      throw new Error(`Deletion confirmation mismatch: Provided "${confirmName}" does not match target "${base}".`)
    }

    // Safety guard against deleting system root drives or critical directories
    const lower = cleanTarget.toLowerCase()
    if (/^[a-z]:\\?$/i.test(lower) || lower === '/' || SYSTEM_PROTECTED_PATHS.has(lower)) {
      throw new Error('Operation blocked: Cannot delete a system root drive or protected OS folder.')
    }

    await rm(cleanTarget, { recursive: true, force: false })
  }
}

export const localFilesystemService = new LocalFilesystemService()
