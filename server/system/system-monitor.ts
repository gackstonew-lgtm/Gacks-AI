import os from 'node:os'
import { statfs } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface NetworkAdapterInfo {
  adapterName: string
  adapterType?: string
  linkSpeed?: string
  status: 'Up' | 'Connected' | 'Disconnected' | 'Unknown'
}

export interface SystemMetrics {
  cpuUsagePercent: number
  memoryUsagePercent: number
  memoryUsedBytes: number
  memoryTotalBytes: number
  memoryFreeBytes: number
  storageUsagePercent: number
  storageUsedBytes: number
  storageTotalBytes: number
  storageDrive: string
  network: NetworkAdapterInfo
  operationalState: 'operational' | 'degraded' | 'unavailable'
  statusMessage: string
  timestamp: number
}

export interface SystemCapabilities {
  localSystemAccess: boolean
  systemMetrics: boolean
  filesystemAccess: boolean
  platform: string
}

interface CpuSnapshot {
  idle: number
  total: number
}

export class SystemMonitor {
  private lastCpuSnapshot: CpuSnapshot | null = null
  private currentCpuPercent = 0
  private lastNetworkInfo: NetworkAdapterInfo = {
    adapterName: 'Network',
    status: 'Connected',
  }
  private lastNetworkCheckTime = 0
  private networkCheckIntervalMs = 12000 // Refresh adapter link speed every 12 seconds
  private samplingInterval: NodeJS.Timeout | null = null

  constructor() {
    this.takeCpuSnapshot()
    // Background CPU sampling every 1.5 seconds for instantaneous accuracy
    this.samplingInterval = setInterval(() => {
      this.sampleCpu()
    }, 1500)
    // Don't keep process open solely for this timer
    if (this.samplingInterval.unref) {
      this.samplingInterval.unref()
    }
    // Initial network probe
    void this.sampleNetwork()
  }

  public destroy(): void {
    if (this.samplingInterval) {
      clearInterval(this.samplingInterval)
      this.samplingInterval = null
    }
  }

  private takeCpuSnapshot(): CpuSnapshot {
    const cpus = os.cpus()
    let idle = 0
    let total = 0

    for (const cpu of cpus) {
      const times = cpu.times
      idle += times.idle
      total += times.user + times.nice + times.sys + times.idle + times.irq
    }

    const snap = { idle, total }
    this.lastCpuSnapshot = snap
    return snap
  }

  private sampleCpu(): number {
    const previous = this.lastCpuSnapshot
    const current = this.takeCpuSnapshot()

    if (!previous) {
      return this.currentCpuPercent
    }

    const deltaIdle = current.idle - previous.idle
    const deltaTotal = current.total - previous.total

    if (deltaTotal > 0) {
      const usage = 100 * (1 - deltaIdle / deltaTotal)
      this.currentCpuPercent = Math.max(0, Math.min(100, Math.round(usage)))
    }

    return this.currentCpuPercent
  }

  private async sampleNetwork(): Promise<NetworkAdapterInfo> {
    const now = Date.now()
    if (now - this.lastNetworkCheckTime < this.networkCheckIntervalMs) {
      return this.lastNetworkInfo
    }
    this.lastNetworkCheckTime = now

    // 1. On Windows, query active adapter via safe, un-interpolated PowerShell command
    if (process.platform === 'win32') {
      try {
        const { stdout } = await execFileAsync(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            "Get-NetAdapter | Where-Object Status -eq 'Up' | Select-Object -First 1 Name, InterfaceDescription, LinkSpeed, Status | ConvertTo-Json",
          ],
          { timeout: 3500 },
        )

        if (stdout && stdout.trim()) {
          const parsed = JSON.parse(stdout.trim())
          const item = Array.isArray(parsed) ? parsed[0] : parsed
          if (item && item.Name) {
            this.lastNetworkInfo = {
              adapterName: item.Name,
              adapterType: item.InterfaceDescription || undefined,
              linkSpeed: item.LinkSpeed && item.LinkSpeed !== '0 bps' ? item.LinkSpeed : undefined,
              status: item.Status === 'Up' ? 'Up' : 'Connected',
            }
            return this.lastNetworkInfo
          }
        }
      } catch {
        // Fall back to Node native os.networkInterfaces()
      }
    }

    // 2. Node native fallback using os.networkInterfaces()
    try {
      const ifaces = os.networkInterfaces()
      for (const [name, addrs] of Object.entries(ifaces)) {
        if (!addrs) continue
        // Look for active external IPv4
        const activeIpv4 = addrs.find((a) => !a.internal && a.family === 'IPv4')
        if (activeIpv4) {
          this.lastNetworkInfo = {
            adapterName: name,
            status: 'Connected',
          }
          return this.lastNetworkInfo
        }
      }
    } catch {}

    return this.lastNetworkInfo
  }

  public async getMetrics(): Promise<SystemMetrics> {
    const now = Date.now()

    // 1. CPU
    const cpu = this.currentCpuPercent

    // 2. Memory / RAM
    let memoryTotalBytes = 0
    let memoryFreeBytes = 0
    let memoryUsedBytes = 0
    let memoryUsagePercent = 0
    try {
      memoryTotalBytes = os.totalmem()
      memoryFreeBytes = os.freemem()
      memoryUsedBytes = Math.max(0, memoryTotalBytes - memoryFreeBytes)
      if (memoryTotalBytes > 0) {
        memoryUsagePercent = Math.max(0, Math.min(100, Math.round((memoryUsedBytes / memoryTotalBytes) * 100)))
      }
    } catch {}

    // 3. Storage / Disk
    let storageTotalBytes = 0
    let storageUsedBytes = 0
    let storageUsagePercent = 0
    let storageDrive = 'C:'
    try {
      const cwd = process.cwd()
      const driveMatch = cwd.match(/^[A-Za-z]:/)
      if (driveMatch) {
        storageDrive = driveMatch[0].toUpperCase()
      }
      const st = await statfs(cwd)
      const bsize = BigInt(st.bsize)
      const total = BigInt(st.blocks) * bsize
      const avail = BigInt(st.bavail) * bsize
      const used = total - avail

      storageTotalBytes = Number(total)
      storageUsedBytes = Number(used)
      if (storageTotalBytes > 0) {
        storageUsagePercent = Math.max(0, Math.min(100, Math.round((storageUsedBytes / storageTotalBytes) * 100)))
      }
    } catch {}

    // 4. Network
    const network = await this.sampleNetwork()

    // 5. Derived health state
    let operationalState: 'operational' | 'degraded' | 'unavailable' = 'operational'
    let statusMessage = 'All systems operational'

    if (memoryTotalBytes === 0 || storageTotalBytes === 0) {
      operationalState = 'degraded'
      statusMessage = 'System monitoring degraded'
    }

    return {
      cpuUsagePercent: cpu,
      memoryUsagePercent,
      memoryUsedBytes,
      memoryTotalBytes,
      memoryFreeBytes,
      storageUsagePercent,
      storageUsedBytes,
      storageTotalBytes,
      storageDrive,
      network,
      operationalState,
      statusMessage,
      timestamp: now,
    }
  }

  public getCapabilities(): SystemCapabilities {
    return {
      localSystemAccess: true,
      systemMetrics: true,
      filesystemAccess: true,
      platform: process.platform,
    }
  }
}

export const systemMonitor = new SystemMonitor()
