/**
 * GACKS AI Assistant OS — Central Service Supervisor & Capability Coordinator
 * 
 * Manages specialized external service runtimes (Python AI Core, Rust Native Core).
 * Provides dynamic capability registration, continuous health polling, and status introspection.
 */

import { pythonServiceBridge, type PythonHealthReport } from './python-service-bridge.js'
import { rustServiceBridge, type RustHealthReport } from './rust-service-bridge.js'

export interface ServiceSystemStatus {
  timestamp: number
  services: {
    pythonAi: PythonHealthReport
    rustNative: RustHealthReport
    gateway: {
      status: 'ONLINE'
      role: 'Central Nervous System & Security Orchestrator'
      version: string
    }
  }
  capabilities: {
    total: number
    python: string[]
    rust: string[]
    builtins: string[]
  }
}

export class ServiceManager {
  private isInitialized = false

  public async initialize(): Promise<void> {
    if (this.isInitialized) return
    this.isInitialized = true

    console.log('[ServiceManager] Discovering specialized service runtimes...')
    await Promise.allSettled([
      pythonServiceBridge.checkHealth(),
      rustServiceBridge.checkHealth(),
    ])

    const pyStatus = pythonServiceBridge.isServiceOnline() ? 'ONLINE' : 'STANDBY (Built-in Fallback Active)'
    const rsStatus = rustServiceBridge.isServiceOnline() ? 'ONLINE' : 'STANDBY (Built-in Fallback Active)'

    console.log(`[ServiceManager] Python AI Core status: ${pyStatus}`)
    console.log(`[ServiceManager] Rust Native Core status: ${rsStatus}`)
  }

  public async getSystemStatus(): Promise<ServiceSystemStatus> {
    const [pyHealth, rsHealth] = await Promise.all([
      pythonServiceBridge.checkHealth(),
      rustServiceBridge.checkHealth(),
    ])

    const pythonCaps = [
      'python_vision_analyze',
      'python_document_extract',
      'python_embeddings_generate',
      'python_rag_query',
      'python_audio_intelligence',
    ]

    const rustCaps = [
      'rust_system_hardware',
      'rust_process_manager',
      'rust_window_manager',
      'rust_filesystem_secure',
      'rust_clipboard_sync',
      'rust_command_sandbox',
    ]

    const builtinCaps = [
      'mcp_list_servers',
      'system_get_metrics',
      'fs_read_file',
      'fs_write_file',
      'fs_list_directory',
    ]

    return {
      timestamp: Date.now(),
      services: {
        pythonAi: pyHealth,
        rustNative: rsHealth,
        gateway: {
          status: 'ONLINE',
          role: 'Central Nervous System & Security Orchestrator',
          version: '2.0.0',
        },
      },
      capabilities: {
        total: pythonCaps.length + rustCaps.length + builtinCaps.length,
        python: pythonCaps,
        rust: rustCaps,
        builtins: builtinCaps,
      },
    }
  }
}

export const serviceManager = new ServiceManager()
