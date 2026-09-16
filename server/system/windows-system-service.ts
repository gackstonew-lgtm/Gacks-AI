import os from 'node:os'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { statfs } from 'node:fs/promises'
import { systemMonitor } from './system-monitor.js'
import { capabilityRegistry } from './capability-registry.js'
import { systemAuditLogger } from './audit-logger.js'

const execFileAsync = promisify(execFile)

// Protected system processes that can never be terminated
const CRITICAL_SYSTEM_PROCESSES = new Set([
  'system',
  'idle',
  'csrss',
  'smss',
  'services',
  'lsass',
  'winlogon',
  'wininit',
  'svchost',
  'explorer',
  'taskhostw',
  'dwm',
])

export interface CpuTelemetry {
  model: string
  physicalCores: number
  logicalCores: number
  speedMhz: number
  utilizationPercent: number
  architecture: string
}

export interface MemoryTelemetry {
  totalBytes: number
  usedBytes: number
  freeBytes: number
  usagePercent: number
}

export interface GpuTelemetry {
  available: boolean
  name: string
  driverVersion?: string
  videoProcessor?: string
  adapterRamBytes?: number
  status: string
}

export interface PowerTelemetry {
  hasBattery: boolean
  acConnected: boolean
  chargePercent: number
  status: string
}

export interface DisplayTelemetry {
  name: string
  resolution: string
  refreshRateHz: number
  status: string
}

export interface DriveTelemetry {
  drive: string
  label: string
  totalBytes: number
  usedBytes: number
  freeBytes: number
  usagePercent: number
}

export interface HardwareReport {
  cpu: CpuTelemetry
  memory: MemoryTelemetry
  gpu: GpuTelemetry
  power: PowerTelemetry
  displays: DisplayTelemetry[]
  drives: DriveTelemetry[]
  uptimeSeconds: number
  platform: string
  hostname: string
  timestamp: number
}

export interface WifiInfo {
  connected: boolean
  ssid?: string
  signalPercent?: number
  interfaceName?: string
  radioType?: string
  state?: string
}

export interface BluetoothDevice {
  name: string
  status: string
  present: boolean
}

export interface NetworkInterfaceInfo {
  name: string
  description?: string
  linkSpeed?: string
  status: string
  macAddress?: string
}

export interface AudioDevice {
  name: string
  manufacturer?: string
  status: string
}

export interface PrinterInfo {
  name: string
  driverName?: string
  isDefault: boolean
  status: string
  jobCount: number
}

export interface DevicesReport {
  wifi: WifiInfo
  bluetoothDevices: BluetoothDevice[]
  networkAdapters: NetworkInterfaceInfo[]
  audioDevices: AudioDevice[]
  printers: PrinterInfo[]
  timestamp: number
}

export interface ProcessItem {
  pid: number
  name: string
  cpuSeconds: number
  memoryBytes: number
  memoryMb: number
  responding: boolean
  isSystemProcess: boolean
}

export interface DesktopApp {
  name: string
  version?: string
  publisher?: string
  installLocation?: string
  isRunning?: boolean
  pid?: number
}

export interface WindowsServiceInfo {
  name: string
  displayName: string
  status: string
  startType?: string
}

export class WindowsSystemService {
  private isWindows = process.platform === 'win32'
  private cachedApps: DesktopApp[] | null = null
  private lastAppsFetchTime = 0
  private appsCacheTtlMs = 60000 // Cache installed apps for 60s

  /**
   * Safe helper to run PowerShell command with timeout and un-interpolated arguments
   */
  private async runPsCommand(command: string, timeoutMs = 4000): Promise<string> {
    if (!this.isWindows) {
      return ''
    }
    try {
      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command],
        { timeout: timeoutMs },
      )
      return stdout ? stdout.trim() : ''
    } catch {
      return ''
    }
  }

  // ============================================================================
  // 1. Comprehensive Hardware & Telemetry
  // ============================================================================

  public async getHardwareReport(): Promise<HardwareReport> {
    const cpus = os.cpus()
    const logicalCores = cpus.length
    const model = cpus[0]?.model || 'Generic CPU'
    const speedMhz = cpus[0]?.speed || 0

    // 1. Instantaneous CPU load
    const metrics = await systemMonitor.getMetrics()
    const cpuUtilization = metrics.cpuUsagePercent

    // 2. Physical cores
    let physicalCores = Math.max(1, Math.floor(logicalCores / 2))
    if (this.isWindows) {
      try {
        const out = await this.runPsCommand(
          '(Get-CimInstance Win32_Processor | Select-Object -First 1 NumberOfCores).NumberOfCores',
          2500,
        )
        const parsed = parseInt(out, 10)
        if (!isNaN(parsed) && parsed > 0) {
          physicalCores = parsed
        }
      } catch {}
    }

    const cpu: CpuTelemetry = {
      model,
      physicalCores,
      logicalCores,
      speedMhz,
      utilizationPercent: cpuUtilization,
      architecture: os.arch(),
    }

    // 3. Memory
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = Math.max(0, totalMem - freeMem)
    const memUsagePercent = totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0

    const memory: MemoryTelemetry = {
      totalBytes: totalMem,
      usedBytes: usedMem,
      freeBytes: freeMem,
      usagePercent: memUsagePercent,
    }

    // 4. GPU Telemetry
    let gpu: GpuTelemetry = {
      available: false,
      name: 'Unavailable',
      status: 'Unavailable',
    }
    if (this.isWindows) {
      try {
        const out = await this.runPsCommand(
          "Get-CimInstance Win32_VideoController | Select-Object -First 1 Name, DriverVersion, VideoProcessor, AdapterRAM, Status | ConvertTo-Json -Compress",
          3000,
        )
        if (out) {
          const parsed = JSON.parse(out)
          if (parsed && parsed.Name) {
            gpu = {
              available: true,
              name: String(parsed.Name),
              driverVersion: parsed.DriverVersion ? String(parsed.DriverVersion) : undefined,
              videoProcessor: parsed.VideoProcessor ? String(parsed.VideoProcessor) : undefined,
              adapterRamBytes: parsed.AdapterRAM ? Number(parsed.AdapterRAM) : undefined,
              status: parsed.Status ? String(parsed.Status) : 'OK',
            }
          }
        }
      } catch {}
    }

    // 5. Power & Battery
    let power: PowerTelemetry = {
      hasBattery: false,
      acConnected: true,
      chargePercent: 100,
      status: 'AC Power (Desktop)',
    }
    if (this.isWindows) {
      try {
        const out = await this.runPsCommand(
          "Get-CimInstance Win32_Battery | Select-Object -First 1 EstimatedChargeRemaining, BatteryStatus, Status | ConvertTo-Json -Compress",
          2500,
        )
        if (out) {
          const parsed = JSON.parse(out)
          if (parsed && parsed.EstimatedChargeRemaining !== undefined) {
            const charge = Number(parsed.EstimatedChargeRemaining)
            const isCharging = parsed.BatteryStatus === 2 || parsed.BatteryStatus === 6
            power = {
              hasBattery: true,
              acConnected: isCharging || parsed.BatteryStatus === 1,
              chargePercent: charge,
              status: isCharging ? `Charging (${charge}%)` : `Battery (${charge}%)`,
            }
          }
        }
      } catch {}
    }

    // 6. Displays
    const displays: DisplayTelemetry[] = []
    if (this.isWindows) {
      try {
        const out = await this.runPsCommand(
          "Get-CimInstance Win32_VideoController | Select-Object Name, CurrentHorizontalResolution, CurrentVerticalResolution, CurrentRefreshRate | ConvertTo-Json",
          3000,
        )
        if (out) {
          const parsed = JSON.parse(out)
          const items = Array.isArray(parsed) ? parsed : [parsed]
          for (const item of items) {
            if (item && item.CurrentHorizontalResolution && item.CurrentVerticalResolution) {
              displays.push({
                name: String(item.Name || 'Display'),
                resolution: `${item.CurrentHorizontalResolution}x${item.CurrentVerticalResolution}`,
                refreshRateHz: Number(item.CurrentRefreshRate || 60),
                status: 'Connected',
              })
            }
          }
        }
      } catch {}
    }
    if (displays.length === 0) {
      displays.push({
        name: 'Primary Display',
        resolution: 'Auto-detect',
        refreshRateHz: 60,
        status: 'Active',
      })
    }

    // 7. Multi-Drive Storage
    const drives: DriveTelemetry[] = []
    if (this.isWindows) {
      try {
        const out = await this.runPsCommand(
          "Get-PSDrive -PSProvider FileSystem | Select-Object Name, Root, Free, Used | ConvertTo-Json",
          2500,
        )
        if (out) {
          const parsed = JSON.parse(out)
          const items = Array.isArray(parsed) ? parsed : [parsed]
          for (const item of items) {
            if (item && item.Name && item.Free !== undefined && item.Used !== undefined) {
              const free = Number(item.Free)
              const used = Number(item.Used)
              const total = free + used
              const usagePercent = total > 0 ? Math.round((used / total) * 100) : 0
              drives.push({
                drive: `${item.Name}:`,
                label: item.Root || `${item.Name}:\\`,
                totalBytes: total,
                usedBytes: used,
                freeBytes: free,
                usagePercent,
              })
            }
          }
        }
      } catch {}
    }
    // Fallback: query cwd statfs if drives list empty
    if (drives.length === 0) {
      try {
        const cwd = process.cwd()
        const st = await statfs(cwd)
        const bsize = BigInt(st.bsize)
        const total = Number(BigInt(st.blocks) * bsize)
        const free = Number(BigInt(st.bavail) * bsize)
        const used = total - free
        drives.push({
          drive: 'C:',
          label: 'Local Disk (C:)',
          totalBytes: total,
          usedBytes: used,
          freeBytes: free,
          usagePercent: total > 0 ? Math.round((used / total) * 100) : 0,
        })
      } catch {}
    }

    return {
      cpu,
      memory,
      gpu,
      power,
      displays,
      drives,
      uptimeSeconds: Math.round(os.uptime()),
      platform: `${os.type()} ${os.release()} (${os.arch()})`,
      hostname: os.hostname(),
      timestamp: Date.now(),
    }
  }

  // ============================================================================
  // 2. Hardware Devices & Network
  // ============================================================================

  public async getDevicesReport(): Promise<DevicesReport> {
    let wifi: WifiInfo = { connected: false }
    const bluetoothDevices: BluetoothDevice[] = []
    const networkAdapters: NetworkInterfaceInfo[] = []
    const audioDevices: AudioDevice[] = []
    const printers: PrinterInfo[] = []

    if (this.isWindows) {
      // 1. Wi-Fi inspection via netsh
      try {
        const { stdout } = await execFileAsync('netsh', ['wlan', 'show', 'interfaces'], { timeout: 3000 })
        if (stdout) {
          const ssidMatch = stdout.match(/^\s*SSID\s*:\s*(.+)$/m)
          const signalMatch = stdout.match(/^\s*Signal\s*:\s*(\d+)%/m)
          const stateMatch = stdout.match(/^\s*State\s*:\s*(.+)$/m)
          const radioMatch = stdout.match(/^\s*Radio type\s*:\s*(.+)$/m)
          const ifaceMatch = stdout.match(/^\s*Name\s*:\s*(.+)$/m)

          if (ssidMatch && ssidMatch[1]) {
            wifi = {
              connected: stateMatch ? stateMatch[1].trim().toLowerCase() === 'connected' : true,
              ssid: ssidMatch[1].trim(),
              signalPercent: signalMatch ? parseInt(signalMatch[1], 10) : undefined,
              interfaceName: ifaceMatch ? ifaceMatch[1].trim() : 'Wi-Fi',
              radioType: radioMatch ? radioMatch[1].trim() : undefined,
              state: stateMatch ? stateMatch[1].trim() : 'connected',
            }
          }
        }
      } catch {}

      // 2. Network Adapters
      try {
        const out = await this.runPsCommand(
          "Get-NetAdapter | Select-Object -First 6 Name, InterfaceDescription, LinkSpeed, Status, MacAddress | ConvertTo-Json",
          3000,
        )
        if (out) {
          const parsed = JSON.parse(out)
          const items = Array.isArray(parsed) ? parsed : [parsed]
          for (const item of items) {
            if (item && item.Name) {
              networkAdapters.push({
                name: String(item.Name),
                description: item.InterfaceDescription ? String(item.InterfaceDescription) : undefined,
                linkSpeed: item.LinkSpeed ? String(item.LinkSpeed) : undefined,
                status: String(item.Status || 'Unknown'),
                macAddress: item.MacAddress ? String(item.MacAddress) : undefined,
              })
            }
          }
        }
      } catch {}

      // 3. Bluetooth Devices
      try {
        const out = await this.runPsCommand(
          "Get-PnpDevice -Class Bluetooth | Where-Object Status -eq 'OK' | Select-Object -First 8 FriendlyName, Status, Present | ConvertTo-Json",
          3500,
        )
        if (out) {
          const parsed = JSON.parse(out)
          const items = Array.isArray(parsed) ? parsed : [parsed]
          for (const item of items) {
            if (item && item.FriendlyName) {
              bluetoothDevices.push({
                name: String(item.FriendlyName),
                status: String(item.Status || 'OK'),
                present: Boolean(item.Present),
              })
            }
          }
        }
      } catch {}

      // 4. Audio Devices
      try {
        const out = await this.runPsCommand(
          "Get-CimInstance Win32_SoundDevice | Select-Object -First 8 Name, Status, Manufacturer | ConvertTo-Json",
          3000,
        )
        if (out) {
          const parsed = JSON.parse(out)
          const items = Array.isArray(parsed) ? parsed : [parsed]
          for (const item of items) {
            if (item && item.Name) {
              audioDevices.push({
                name: String(item.Name),
                manufacturer: item.Manufacturer ? String(item.Manufacturer) : undefined,
                status: String(item.Status || 'OK'),
              })
            }
          }
        }
      } catch {}

      // 5. Printers
      try {
        const out = await this.runPsCommand(
          "Get-Printer | Select-Object -First 8 Name, DriverName, Default, PrinterStatus, JobCount | ConvertTo-Json",
          3000,
        )
        if (out) {
          const parsed = JSON.parse(out)
          const items = Array.isArray(parsed) ? parsed : [parsed]
          for (const item of items) {
            if (item && item.Name) {
              printers.push({
                name: String(item.Name),
                driverName: item.DriverName ? String(item.DriverName) : undefined,
                isDefault: Boolean(item.Default),
                status: String(item.PrinterStatus || 'Normal'),
                jobCount: Number(item.JobCount || 0),
              })
            }
          }
        }
      } catch {}
    }

    return {
      wifi,
      bluetoothDevices,
      networkAdapters,
      audioDevices,
      printers,
      timestamp: Date.now(),
    }
  }

  // ============================================================================
  // 3. Task Manager & Process Management
  // ============================================================================

  public async getProcesses(limit = 35): Promise<ProcessItem[]> {
    if (!this.isWindows) {
      return []
    }

    try {
      const out = await this.runPsCommand(
        `Get-Process | Sort-Object -Property CPU -Descending | Select-Object -First ${limit} Id, ProcessName, CPU, WorkingSet64, Responding | ConvertTo-Json`,
        4000,
      )
      if (!out) return []

      const parsed = JSON.parse(out)
      const items = Array.isArray(parsed) ? parsed : [parsed]
      return items.map((p) => {
        const memBytes = Number(p.WorkingSet64 || 0)
        const name = String(p.ProcessName || 'Unknown')
        return {
          pid: Number(p.Id),
          name,
          cpuSeconds: Math.round(Number(p.CPU || 0) * 10) / 10,
          memoryBytes: memBytes,
          memoryMb: Math.round(memBytes / (1024 * 1024)),
          responding: p.Responding !== false,
          isSystemProcess: CRITICAL_SYSTEM_PROCESSES.has(name.toLowerCase()) || Number(p.Id) <= 4,
        }
      })
    } catch {
      return []
    }
  }

  public async terminateProcess(
    pid: number,
    confirmName: string,
    hasConfirmation = false,
  ): Promise<{ success: boolean; message: string }> {
    const perm = capabilityRegistry.checkPermission('processes')
    if (!perm.allowed && !hasConfirmation) {
      return { success: false, message: `Permission Denied: ${perm.reason}` }
    }

    if (pid <= 4 || pid === process.pid) {
      return { success: false, message: 'Cannot terminate critical system or agent runtime PID.' }
    }

    if (!confirmName || confirmName.trim().length === 0) {
      return { success: false, message: 'Process confirmation name is required.' }
    }

    if (CRITICAL_SYSTEM_PROCESSES.has(confirmName.toLowerCase())) {
      return { success: false, message: `Process '${confirmName}' is a protected Windows core process and cannot be terminated.` }
    }

    try {
      const startTime = Date.now()
      await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Stop-Process -Id ${pid} -Force`,
      ])
      const durationMs = Date.now() - startTime

      systemAuditLogger.log({
        capability: 'processes',
        action: 'terminate_process',
        inputs: { pid, confirmName },
        riskLevel: 'destructive',
        confirmationState: hasConfirmation ? 'confirmed' : 'granted',
        success: true,
        durationMs,
        resultSummary: `Terminated process PID ${pid} (${confirmName})`,
      })

      return { success: true, message: `Process ${confirmName} (PID ${pid}) successfully terminated.` }
    } catch (err: any) {
      return { success: false, message: `Failed to terminate process: ${err.message}` }
    }
  }

  // ============================================================================
  // 4. Applications Discovery & Governed Launch
  // ============================================================================

  public async getInstalledApps(): Promise<DesktopApp[]> {
    const now = Date.now()
    if (this.cachedApps && now - this.lastAppsFetchTime < this.appsCacheTtlMs) {
      return this.cachedApps
    }

    if (!this.isWindows) {
      return []
    }

    try {
      // Query registry uninstall keys safely
      const psScript = `
        $paths = @(
          'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
          'HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
          'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
        )
        Get-ItemProperty $paths -ErrorAction SilentlyContinue |
          Where-Object { $_.DisplayName -and $_.DisplayName.Trim() -ne '' -and -not $_.SystemComponent } |
          Select-Object -Unique DisplayName, DisplayVersion, Publisher, InstallLocation |
          Sort-Object DisplayName |
          Select-Object -First 100 |
          ConvertTo-Json
      `

      const out = await this.runPsCommand(psScript, 5000)
      if (out) {
        const parsed = JSON.parse(out)
        const items = Array.isArray(parsed) ? parsed : [parsed]
        const apps: DesktopApp[] = items
          .filter((item) => item && item.DisplayName)
          .map((item) => ({
            name: String(item.DisplayName).trim(),
            version: item.DisplayVersion ? String(item.DisplayVersion).trim() : undefined,
            publisher: item.Publisher ? String(item.Publisher).trim() : undefined,
            installLocation: item.InstallLocation ? String(item.InstallLocation).trim() : undefined,
          }))

        this.cachedApps = apps
        this.lastAppsFetchTime = now
        return apps
      }
    } catch {}

    return []
  }

  public async getRunningApps(): Promise<DesktopApp[]> {
    if (!this.isWindows) return []

    try {
      const out = await this.runPsCommand(
        "Get-Process | Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle.Trim() -ne '' } | Select-Object Id, ProcessName, MainWindowTitle | ConvertTo-Json",
        3500,
      )
      if (!out) return []

      const parsed = JSON.parse(out)
      const items = Array.isArray(parsed) ? parsed : [parsed]
      return items.map((p) => ({
        name: String(p.ProcessName),
        version: String(p.MainWindowTitle),
        isRunning: true,
        pid: Number(p.Id),
      }))
    } catch {
      return []
    }
  }

  public async launchApp(
    appNameOrPath: string,
    hasConfirmation = false,
  ): Promise<{ success: boolean; message: string }> {
    const perm = capabilityRegistry.checkPermission('applications')
    if (!perm.allowed && !hasConfirmation) {
      return { success: false, message: `Permission Denied: ${perm.reason}` }
    }

    const trimmed = appNameOrPath.trim()
    // Validation: block scripts, batch files, powershell, cmd, or command chaining
    if (/(\.bat|\.cmd|\.vbs|\.ps1|\.sh|;|\||&|>|<|`|\$)/i.test(trimmed)) {
      return { success: false, message: 'Invalid executable format or forbidden shell characters.' }
    }

    try {
      const startTime = Date.now()
      // Safe launch via explorer or spawn
      const child = spawn(trimmed, [], {
        detached: true,
        stdio: 'ignore',
        shell: false,
      })
      child.unref()
      const durationMs = Date.now() - startTime

      systemAuditLogger.log({
        capability: 'applications',
        action: 'launch_app',
        inputs: { appNameOrPath: trimmed },
        riskLevel: 'control',
        confirmationState: hasConfirmation ? 'confirmed' : 'granted',
        success: true,
        durationMs,
        resultSummary: `Launched application '${trimmed}'`,
      })

      return { success: true, message: `Successfully requested launch of '${trimmed}'.` }
    } catch (err: any) {
      return { success: false, message: `Failed to launch application: ${err.message}` }
    }
  }

  // ============================================================================
  // 5. Clipboard Integration
  // ============================================================================

  public async readClipboard(hasConfirmation = false): Promise<{ success: boolean; text?: string; error?: string }> {
    const perm = capabilityRegistry.checkPermission('clipboard')
    if (!perm.allowed && !hasConfirmation) {
      return { success: false, error: `Permission Denied: ${perm.reason}` }
    }

    if (!this.isWindows) {
      return { success: false, error: 'Clipboard access supported on Windows only.' }
    }

    try {
      const startTime = Date.now()
      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', 'Get-Clipboard'],
        { timeout: 3000 },
      )
      const text = stdout ? stdout.slice(0, 10000) : ''
      const durationMs = Date.now() - startTime

      systemAuditLogger.log({
        capability: 'clipboard',
        action: 'read_clipboard',
        inputs: {},
        riskLevel: 'write',
        confirmationState: hasConfirmation ? 'confirmed' : 'granted',
        success: true,
        durationMs,
        resultSummary: `Read ${text.length} characters from clipboard`,
      })

      return { success: true, text }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  public async writeClipboard(
    text: string,
    hasConfirmation = false,
  ): Promise<{ success: boolean; error?: string }> {
    const perm = capabilityRegistry.checkPermission('clipboard')
    if (!perm.allowed && !hasConfirmation) {
      return { success: false, error: `Permission Denied: ${perm.reason}` }
    }

    if (!this.isWindows) {
      return { success: false, error: 'Clipboard access supported on Windows only.' }
    }

    try {
      const startTime = Date.now()
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Set-Clipboard -Value $input'], {
        stdio: ['pipe', 'ignore', 'ignore'],
      })
      child.stdin.write(text)
      child.stdin.end()

      await new Promise<void>((resolve, reject) => {
        child.on('close', (code) => {
          if (code === 0) resolve()
          else reject(new Error(`Set-Clipboard exited with code ${code}`))
        })
        child.on('error', reject)
      })

      const durationMs = Date.now() - startTime
      systemAuditLogger.log({
        capability: 'clipboard',
        action: 'write_clipboard',
        inputs: { length: text.length },
        riskLevel: 'write',
        confirmationState: hasConfirmation ? 'confirmed' : 'granted',
        success: true,
        durationMs,
        resultSummary: `Wrote ${text.length} characters to clipboard`,
      })

      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  // ============================================================================
  // 6. Native Windows Desktop Notification
  // ============================================================================

  public async sendNotification(
    title: string,
    message: string,
  ): Promise<{ success: boolean; error?: string }> {
    const perm = capabilityRegistry.checkPermission('notifications')
    if (!perm.allowed) {
      return { success: false, error: `Permission Denied: ${perm.reason}` }
    }

    if (!this.isWindows) {
      return { success: false, error: 'Notifications supported on Windows.' }
    }

    const cleanTitle = title.replace(/["'$`]/g, '')
    const cleanMsg = message.replace(/["'$`]/g, '')

    try {
      const startTime = Date.now()
      // Modern Windows Toast notification script
      const script = `
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
        $template = @"
        <toast>
            <visual>
                <binding template="ToastGeneric">
                    <text>${cleanTitle}</text>
                    <text>${cleanMsg}</text>
                </binding>
            </visual>
        </toast>
"@
        $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
        $xml.LoadXml($template)
        $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Gacks AI").Show($toast)
      `

      await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
        timeout: 4000,
      })
      const durationMs = Date.now() - startTime

      systemAuditLogger.log({
        capability: 'notifications',
        action: 'send_notification',
        inputs: { title: cleanTitle, message: cleanMsg },
        riskLevel: 'control',
        confirmationState: 'granted',
        success: true,
        durationMs,
        resultSummary: `Dispatched toast notification: "${cleanTitle}"`,
      })

      return { success: true }
    } catch (err: any) {
      // Fallback: system balloon tip
      try {
        const balloonScript = `
          Add-Type -AssemblyName System.Windows.Forms
          $notify = New-Object System.Windows.Forms.NotifyIcon
          $notify.Icon = [System.Drawing.SystemIcons]::Information
          $notify.Visible = $true
          $notify.ShowBalloonTip(4000, "${cleanTitle}", "${cleanMsg}", [System.Windows.Forms.ToolTipIcon]::Info)
        `
        await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', balloonScript], {
          timeout: 4000,
        })
        return { success: true }
      } catch {
        return { success: false, error: err.message }
      }
    }
  }

  // ============================================================================
  // 7. Safe Windows Services (Read-Only)
  // ============================================================================

  public async getRunningServices(limit = 30): Promise<WindowsServiceInfo[]> {
    if (!this.isWindows) return []

    try {
      const out = await this.runPsCommand(
        `Get-Service | Where-Object Status -eq 'Running' | Select-Object -First ${limit} Name, DisplayName, Status, StartType | ConvertTo-Json`,
        3500,
      )
      if (!out) return []

      const parsed = JSON.parse(out)
      const items = Array.isArray(parsed) ? parsed : [parsed]
      return items.map((s) => ({
        name: String(s.Name),
        displayName: String(s.DisplayName || s.Name),
        status: String(s.Status || 'Running'),
        startType: s.StartType !== undefined ? String(s.StartType) : undefined,
      }))
    } catch {
      return []
    }
  }
}

export const windowsSystemService = new WindowsSystemService()
