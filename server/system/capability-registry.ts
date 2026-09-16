import os from 'node:os'

export type CapabilityId =
  | 'system_metrics'
  | 'hardware_devices'
  | 'filesystem'
  | 'processes'
  | 'applications'
  | 'clipboard'
  | 'notifications'
  | 'windows_services'

export type PermissionState = 'granted' | 'prompt' | 'denied' | 'admin_required' | 'unavailable'

export type RiskLevel = 'read' | 'write' | 'control' | 'destructive' | 'privileged'

export interface CapabilityMeta {
  id: CapabilityId
  name: string
  description: string
  category: 'Telemetry' | 'Devices' | 'OS Operations' | 'Security'
  riskLevel: RiskLevel
  defaultState: PermissionState
  currentState: PermissionState
  supportedOnPlatform: boolean
  requiresAdmin: boolean
  lastUsedTimestamp?: number
}

export interface CapabilityRegistryStatus {
  platform: string
  isWindows: boolean
  isLocalEnvironment: boolean
  capabilities: Record<CapabilityId, CapabilityMeta>
  timestamp: number
}

export class CapabilityRegistry {
  private capabilities: Map<CapabilityId, CapabilityMeta> = new Map()

  constructor() {
    this.initializeCapabilities()
  }

  private initializeCapabilities(): void {
    const isWin = process.platform === 'win32'

    const entries: CapabilityMeta[] = [
      {
        id: 'system_metrics',
        name: 'System Telemetry & Vitals',
        description: 'Read-only access to CPU, RAM, GPU, Multi-drive Storage, Power/Battery, and Displays.',
        category: 'Telemetry',
        riskLevel: 'read',
        defaultState: 'granted',
        currentState: 'granted',
        supportedOnPlatform: true,
        requiresAdmin: false,
      },
      {
        id: 'hardware_devices',
        name: 'Hardware Devices & Network',
        description: 'Inspect Wi-Fi networks, Bluetooth radios, network adapters, audio endpoints, and printers.',
        category: 'Devices',
        riskLevel: 'read',
        defaultState: 'granted',
        currentState: 'granted',
        supportedOnPlatform: true,
        requiresAdmin: false,
      },
      {
        id: 'filesystem',
        name: 'Local Filesystem Access',
        description: 'Enumerate drives, navigate directories, preview text/code/media, and manage files safely.',
        category: 'OS Operations',
        riskLevel: 'write',
        defaultState: 'prompt',
        currentState: 'prompt',
        supportedOnPlatform: true,
        requiresAdmin: false,
      },
      {
        id: 'processes',
        name: 'Task Manager & Process Control',
        description: 'Inspect active running processes, resource consumption, and safely terminate processes upon confirmation.',
        category: 'OS Operations',
        riskLevel: 'destructive',
        defaultState: 'prompt',
        currentState: 'prompt',
        supportedOnPlatform: isWin,
        requiresAdmin: false,
      },
      {
        id: 'applications',
        name: 'Desktop Applications Management',
        description: 'Discover installed Windows applications, inspect running apps, and launch applications under governed consent.',
        category: 'OS Operations',
        riskLevel: 'control',
        defaultState: 'prompt',
        currentState: 'prompt',
        supportedOnPlatform: isWin,
        requiresAdmin: false,
      },
      {
        id: 'clipboard',
        name: 'System Clipboard Integration',
        description: 'Controlled read and write access to the Windows system clipboard for seamless productivity workflows.',
        category: 'OS Operations',
        riskLevel: 'write',
        defaultState: 'prompt',
        currentState: 'prompt',
        supportedOnPlatform: isWin,
        requiresAdmin: false,
      },
      {
        id: 'notifications',
        name: 'Native Windows Notifications',
        description: 'Dispatch native Windows toast notifications and executive alerts to the desktop.',
        category: 'OS Operations',
        riskLevel: 'control',
        defaultState: 'granted',
        currentState: 'granted',
        supportedOnPlatform: isWin,
        requiresAdmin: false,
      },
      {
        id: 'windows_services',
        name: 'Windows Services Inspection',
        description: 'Safe, read-only inspection of Windows system services and operational states.',
        category: 'Security',
        riskLevel: 'read',
        defaultState: 'granted',
        currentState: 'granted',
        supportedOnPlatform: isWin,
        requiresAdmin: false,
      },
    ]

    for (const entry of entries) {
      this.capabilities.set(entry.id, entry)
    }
  }

  public getCapability(id: CapabilityId): CapabilityMeta | undefined {
    return this.capabilities.get(id)
  }

  public getAllCapabilities(): Record<CapabilityId, CapabilityMeta> {
    const result = {} as Record<CapabilityId, CapabilityMeta>
    for (const [id, meta] of this.capabilities.entries()) {
      result[id] = { ...meta }
    }
    return result
  }

  public setPermission(id: CapabilityId, state: PermissionState): boolean {
    const cap = this.capabilities.get(id)
    if (!cap) return false
    if (!cap.supportedOnPlatform && state !== 'unavailable') {
      return false
    }
    cap.currentState = state
    return true
  }

  public checkPermission(id: CapabilityId): {
    allowed: boolean
    state: PermissionState
    requiresPrompt: boolean
    reason: string
  } {
    const cap = this.capabilities.get(id)
    if (!cap) {
      return {
        allowed: false,
        state: 'unavailable',
        requiresPrompt: false,
        reason: `Capability '${id}' is not registered.`,
      }
    }

    if (!cap.supportedOnPlatform) {
      return {
        allowed: false,
        state: 'unavailable',
        requiresPrompt: false,
        reason: `Capability '${cap.name}' is not supported on this platform (${os.platform()}).`,
      }
    }

    if (cap.currentState === 'denied') {
      return {
        allowed: false,
        state: 'denied',
        requiresPrompt: false,
        reason: `Capability '${cap.name}' has been explicitly denied by operator policy.`,
      }
    }

    if (cap.currentState === 'prompt') {
      return {
        allowed: false,
        state: 'prompt',
        requiresPrompt: true,
        reason: `Capability '${cap.name}' requires explicit operator confirmation before execution.`,
      }
    }

    if (cap.currentState === 'admin_required') {
      return {
        allowed: false,
        state: 'admin_required',
        requiresPrompt: false,
        reason: `Capability '${cap.name}' requires administrator privileges.`,
      }
    }

    // Granted
    cap.lastUsedTimestamp = Date.now()
    return {
      allowed: true,
      state: 'granted',
      requiresPrompt: false,
      reason: `Capability '${cap.name}' is granted.`,
    }
  }

  public getStatus(): CapabilityRegistryStatus {
    return {
      platform: process.platform,
      isWindows: process.platform === 'win32',
      isLocalEnvironment: true,
      capabilities: this.getAllCapabilities(),
      timestamp: Date.now(),
    }
  }
}

export const capabilityRegistry = new CapabilityRegistry()
