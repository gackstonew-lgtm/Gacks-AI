import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { existsSync } from 'node:fs'

const execFileAsync = promisify(execFile)

export interface AndroidDevice {
  id: string
  model?: string
  state: 'device' | 'offline' | 'unauthorized' | 'unknown'
  product?: string
}

export interface AndroidStatusReport {
  available: boolean
  adbInstalled: boolean
  devicesCount: number
  devices: AndroidDevice[]
  primaryDevice?: {
    id: string
    model?: string
    androidVersion?: string
    batteryLevel?: number
    isCharging?: boolean
    wifiIp?: string
    screenResolution?: string
  }
  error?: string
}

export class AndroidDeviceAdapter {
  private adbPath: string = 'adb'
  private adbResolved = false

  constructor() {
    this.resolveAdbPath()
  }

  private resolveAdbPath(): void {
    if (process.platform === 'win32') {
      const localAppData = process.env.LOCALAPPDATA
      const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
      const candidates = [
        'adb',
        localAppData ? path.join(localAppData, 'Android', 'Sdk', 'platform-tools', 'adb.exe') : null,
        androidHome ? path.join(androidHome, 'platform-tools', 'adb.exe') : null,
      ].filter(Boolean) as string[]

      for (const candidate of candidates) {
        if (candidate === 'adb' || existsSync(candidate)) {
          this.adbPath = candidate
          break
        }
      }
    }
  }

  public async isAdbAvailable(): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync(this.adbPath, ['version'], { timeout: 3000 })
      this.adbResolved = true
      return stdout.toLowerCase().includes('android debug bridge')
    } catch {
      return false
    }
  }

  public async getConnectedDevices(): Promise<AndroidDevice[]> {
    try {
      const { stdout } = await execFileAsync(this.adbPath, ['devices', '-l'], { timeout: 5000 })
      const lines = stdout.split('\n')
      const devices: AndroidDevice[] = []

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('List of devices')) continue
        const parts = trimmed.split(/\s+/)
        if (parts.length >= 2) {
          const id = parts[0]
          const state = parts[1] as AndroidDevice['state']
          let model: string | undefined
          let product: string | undefined

          for (const item of parts.slice(2)) {
            if (item.startsWith('model:')) model = item.replace('model:', '')
            if (item.startsWith('product:')) product = item.replace('product:', '')
          }

          devices.push({
            id,
            state: ['device', 'offline', 'unauthorized'].includes(state) ? state : 'unknown',
            model,
            product,
          })
        }
      }
      return devices
    } catch {
      return []
    }
  }

  public async getStatusReport(): Promise<AndroidStatusReport> {
    const adbOk = await this.isAdbAvailable()
    if (!adbOk) {
      return {
        available: false,
        adbInstalled: false,
        devicesCount: 0,
        devices: [],
        error: 'Android Debug Bridge (adb) is not detected or not in system PATH',
      }
    }

    const devices = await this.getConnectedDevices()
    const activeDevice = devices.find((d) => d.state === 'device')

    if (!activeDevice) {
      return {
        available: true,
        adbInstalled: true,
        devicesCount: devices.length,
        devices,
        error: devices.length === 0 ? 'No Android devices connected' : 'Connected devices are offline or unauthorized',
      }
    }

    try {
      const [versionOut, batteryOut, ipOut, wmOut] = await Promise.all([
        execFileAsync(this.adbPath, ['-s', activeDevice.id, 'shell', 'getprop', 'ro.build.version.release'], { timeout: 3000 }).catch(() => ({ stdout: '' })),
        execFileAsync(this.adbPath, ['-s', activeDevice.id, 'shell', 'dumpsys', 'battery'], { timeout: 3000 }).catch(() => ({ stdout: '' })),
        execFileAsync(this.adbPath, ['-s', activeDevice.id, 'shell', 'ip', 'route'], { timeout: 3000 }).catch(() => ({ stdout: '' })),
        execFileAsync(this.adbPath, ['-s', activeDevice.id, 'shell', 'wm', 'size'], { timeout: 3000 }).catch(() => ({ stdout: '' })),
      ])

      let batteryLevel: number | undefined
      let isCharging: boolean | undefined
      for (const line of batteryOut.stdout.split('\n')) {
        const matchLevel = line.match(/level:\s*(\d+)/i)
        if (matchLevel) batteryLevel = parseInt(matchLevel[1], 10)
        const matchStatus = line.match(/status:\s*(\d+)/i)
        if (matchStatus) isCharging = matchStatus[1] === '2' // 2 = CHARGING
      }

      let wifiIp: string | undefined
      const ipMatch = ipOut.stdout.match(/src\s+(\d+\.\d+\.\d+\.\d+)/)
      if (ipMatch) wifiIp = ipMatch[1]

      let screenResolution: string | undefined
      const wmMatch = wmOut.stdout.match(/Physical size:\s*(\d+x\d+)/i)
      if (wmMatch) screenResolution = wmMatch[1]

      return {
        available: true,
        adbInstalled: true,
        devicesCount: devices.length,
        devices,
        primaryDevice: {
          id: activeDevice.id,
          model: activeDevice.model,
          androidVersion: versionOut.stdout.trim() || undefined,
          batteryLevel,
          isCharging,
          wifiIp,
          screenResolution,
        },
      }
    } catch (err: any) {
      return {
        available: true,
        adbInstalled: true,
        devicesCount: devices.length,
        devices,
        primaryDevice: {
          id: activeDevice.id,
          model: activeDevice.model,
        },
        error: err.message,
      }
    }
  }

  public async captureScreenshot(deviceId?: string): Promise<{ success: boolean; mimeType: string; dataBase64?: string; error?: string }> {
    const devices = await this.getConnectedDevices()
    const target = deviceId || devices.find((d) => d.state === 'device')?.id

    if (!target) {
      return { success: false, mimeType: 'image/png', error: 'No active Android device available for screenshot' }
    }

    // Sanitize device ID to prevent command injection
    if (!/^[a-zA-Z0-9._:-]+$/.test(target)) {
      return { success: false, mimeType: 'image/png', error: 'Invalid device ID format' }
    }

    try {
      const { stdout } = await execFileAsync(this.adbPath, ['-s', target, 'exec-out', 'screencap', '-p'], {
        encoding: 'buffer',
        maxBuffer: 20 * 1024 * 1024,
        timeout: 10000,
      })

      return {
        success: true,
        mimeType: 'image/png',
        dataBase64: stdout.toString('base64'),
      }
    } catch (err: any) {
      return {
        success: false,
        mimeType: 'image/png',
        error: `Failed to capture Android screenshot: ${err.message}`,
      }
    }
  }

  public async launchApp(packageName: string, deviceId?: string): Promise<{ success: boolean; message: string }> {
    // Sanitize package name (e.g. com.whatsapp, com.android.chrome)
    if (!/^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)+$/.test(packageName)) {
      return { success: false, message: `Invalid Android package name format: ${packageName}` }
    }

    const devices = await this.getConnectedDevices()
    const target = deviceId || devices.find((d) => d.state === 'device')?.id

    if (!target) {
      return { success: false, message: 'No active Android device available' }
    }

    if (!/^[a-zA-Z0-9._:-]+$/.test(target)) {
      return { success: false, message: 'Invalid device ID format' }
    }

    try {
      const { stdout } = await execFileAsync(
        this.adbPath,
        ['-s', target, 'shell', 'monkey', '-p', packageName, '-c', 'android.intent.category.LAUNCHER', '1'],
        { timeout: 8000 },
      )

      if (stdout.includes('No activities found') || stdout.includes('Events injected: 0')) {
        return { success: false, message: `Package ${packageName} could not be launched or is not installed.` }
      }

      return { success: true, message: `Launched package ${packageName} successfully on device ${target}` }
    } catch (err: any) {
      return { success: false, message: `Failed to launch app: ${err.message}` }
    }
  }
}

export const androidAdapter = new AndroidDeviceAdapter()
