import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Cpu,
  Activity,
  ShieldCheck,
  RefreshCw,
  Server,
  Zap,
  Terminal,
  HardDrive,
  Wifi,
  Bluetooth,
  Monitor,
  Volume2,
  Printer,
  Bell,
  Clipboard,
  Layers,
  Search,
  AlertTriangle,
  Play,
  XOctagon,
  CheckCircle2,
  Clock,
  Laptop,
} from 'lucide-react'
import { useStore } from '../../store'
import { BRIDGE_HTTP_URL } from '../../config'
import {
  apiClient,
  type HardwareReport,
  type DevicesReport,
  type ProcessItem,
  type DesktopApp,
  type CapabilityRegistryStatus,
  type CapabilityId,
  type PermissionState,
  type SystemAuditEntry,
} from '../../lib/api-client'

type SystemTab = 'vitals' | 'devices' | 'tasks' | 'security'

export const SystemPage: React.FC = () => {
  const phase = useStore((s) => s.phase)

  // Active tab state
  const [activeTab, setActiveTab] = useState<SystemTab>('vitals')

  // Telemetry data states
  const [hardware, setHardware] = useState<HardwareReport | null>(null)
  const [devices, setDevices] = useState<DevicesReport | null>(null)
  const [processes, setProcesses] = useState<ProcessItem[]>([])
  const [apps, setApps] = useState<{ installed: DesktopApp[]; running: DesktopApp[] }>({ installed: [], running: [] })
  const [capStatus, setCapStatus] = useState<CapabilityRegistryStatus | null>(null)
  const [auditLogs, setAuditLogs] = useState<SystemAuditEntry[]>([])

  // UI interaction states
  const [loading, setLoading] = useState(false)
  const [latency, setLatency] = useState<number | null>(null)
  const [filterQuery, setFilterQuery] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [terminateTarget, setTerminateTarget] = useState<ProcessItem | null>(null)
  const [isTerminating, setIsTerminating] = useState(false)

  // Show transient notification banner
  const showFeedback = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => {
      setFeedback((current) => (current?.message === message ? null : current))
    }, 4500)
  }, [])

  // Probe all telemetry
  const loadTelemetry = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    const start = performance.now()

    try {
      // 1. Hardware & Capabilities
      const [hwRes, capRes] = await Promise.all([
        apiClient.getHardwareReport(undefined, isBackground),
        apiClient.getCapabilities(),
      ])

      const elapsed = Math.round(performance.now() - start)
      setLatency(elapsed)

      if (hwRes.ok && hwRes.data) {
        setHardware(hwRes.data)
      }
      if (capRes.ok && capRes.data) {
        setCapStatus(capRes.data as any)
      }

      // 2. Devices (backgroundable)
      const devRes = await apiClient.getDevicesReport(undefined, isBackground)
      if (devRes.ok && devRes.data) {
        setDevices(devRes.data)
      }

      // 3. Processes & Apps
      const [procRes, appRes, auditRes] = await Promise.all([
        apiClient.getProcesses(40),
        apiClient.getInstalledAndRunningApps(),
        apiClient.getSystemAuditLog(40),
      ])

      if (procRes.ok && procRes.data?.processes) {
        setProcesses(procRes.data.processes)
      }
      if (appRes.ok && appRes.data) {
        setApps(appRes.data)
      }
      if (auditRes.ok && auditRes.data?.entries) {
        setAuditLogs(auditRes.data.entries)
      }
    } catch {
      setLatency(null)
    } finally {
      if (!isBackground) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTelemetry(false)
    const timer = setInterval(() => void loadTelemetry(true), 12000)
    return () => clearInterval(timer)
  }, [loadTelemetry])

  // Terminate Process Handler
  const handleTerminateProcess = async () => {
    if (!terminateTarget) return
    setIsTerminating(true)
    try {
      const res = await apiClient.terminateProcess(terminateTarget.pid, terminateTarget.name, true)
      if (res.ok) {
        showFeedback('success', res.data?.message || `Terminated PID ${terminateTarget.pid}`)
        setTerminateTarget(null)
        void loadTelemetry(true)
      } else {
        showFeedback('error', res.error || 'Failed to terminate process')
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Termination failed')
    } finally {
      setIsTerminating(false)
    }
  }

  // Launch App Handler
  const handleLaunchApp = async (appName: string) => {
    try {
      const res = await apiClient.launchApp(appName, true)
      if (res.ok) {
        showFeedback('success', `Requested launch of ${appName}`)
        void loadTelemetry(true)
      } else {
        showFeedback('error', res.error || `Could not launch ${appName}`)
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'App launch failed')
    }
  }

  // Permission Toggle Handler
  const handleTogglePermission = async (id: CapabilityId, newState: PermissionState) => {
    try {
      const res = await apiClient.setCapabilityPermission(id, newState)
      if (res.ok) {
        showFeedback('success', `Updated capability '${id}' permission to ${newState.toUpperCase()}`)
        void loadTelemetry(true)
      } else {
        showFeedback('error', res.error || 'Failed to update permission')
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Permission update failed')
    }
  }

  // Quick Action: Send Test Notification
  const handleSendTestToast = async () => {
    try {
      const res = await apiClient.sendSystemNotification(
        'Gacks AI Operating System',
        'Windows system integration layer is active and operational.',
      )
      if (res.ok) {
        showFeedback('success', 'Windows notification sent to desktop.')
      } else {
        showFeedback('error', res.error || 'Notification failed.')
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Notification failed.')
    }
  }

  // Quick Action: Read Clipboard
  const handleReadClipboard = async () => {
    try {
      const res = await apiClient.getClipboard(true)
      if (res.ok) {
        const text = res.data?.text || ''
        if (text) {
          showFeedback('info', `Clipboard content: "${text.slice(0, 75)}${text.length > 75 ? '...' : ''}"`)
        } else {
          showFeedback('info', 'Clipboard is currently empty.')
        }
      } else {
        showFeedback('error', res.error || 'Could not access clipboard.')
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Clipboard access failed.')
    }
  }

  // Quick Action: Copy System Specs
  const handleCopySpecs = async () => {
    if (!hardware) return
    const summary = [
      `GACKS AI OS SPECS`,
      `Host: ${hardware.hostname} | Platform: ${hardware.platform}`,
      `CPU: ${hardware.cpu.model} (${hardware.cpu.physicalCores} Cores / ${hardware.cpu.logicalCores} Threads)`,
      `RAM: ${Math.round(hardware.memory.totalBytes / (1024 ** 3))} GB Total (${hardware.memory.usagePercent}% Used)`,
      `GPU: ${hardware.gpu.name} (${hardware.gpu.status})`,
      `Power: ${hardware.power.status}`,
      `Drives: ${hardware.drives.map((d) => `${d.drive} ${Math.round(d.freeBytes / (1024 ** 3))}GB free`).join(', ')}`,
    ].join('\n')

    try {
      await apiClient.setClipboard(summary, true)
      showFeedback('success', 'System hardware specs copied to clipboard.')
    } catch {
      showFeedback('error', 'Failed to copy specs.')
    }
  }

  // Filtered processes
  const filteredProcesses = useMemo(() => {
    if (!filterQuery.trim()) return processes
    const q = filterQuery.toLowerCase()
    return processes.filter((p) => p.name.toLowerCase().includes(q) || String(p.pid).includes(q))
  }, [processes, filterQuery])

  // Filtered installed apps
  const filteredInstalledApps = useMemo(() => {
    if (!filterQuery.trim()) return apps.installed.slice(0, 30)
    const q = filterQuery.toLowerCase()
    return apps.installed.filter((a) => a.name.toLowerCase().includes(q)).slice(0, 40)
  }, [apps.installed, filterQuery])

  // Render Drive Item
  const formatBytesGb = (bytes: number) => Math.round((bytes / (1024 ** 3)) * 10) / 10

  return (
    <div className="gacks-page-container gacks-system-page">
      {/* Page Header */}
      <div className="gacks-page-header">
        <div className="gacks-page-title-wrap">
          <div className="gacks-page-icon-badge">
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h1 className="gacks-page-title">LOCAL AI OPERATING SYSTEM ASSISTANT</h1>
            <p className="gacks-page-subtitle">
              Windows hardware telemetry, devices, task manager, application control, and security governance
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className="gacks-btn-subtle"
            onClick={handleCopySpecs}
            title="Copy hardware summary to clipboard"
          >
            <Clipboard className="w-3.5 h-3.5 mr-1 text-cyan-400" />
            <span>Copy Specs</span>
          </button>

          <button
            type="button"
            className="gacks-btn-subtle"
            onClick={handleSendTestToast}
            title="Dispatch a native Windows toast notification"
          >
            <Bell className="w-3.5 h-3.5 mr-1 text-amber-400" />
            <span>Test Toast</span>
          </button>

          <button
            type="button"
            className="gacks-btn-subtle"
            onClick={handleReadClipboard}
            title="Read system clipboard safely"
          >
            <Layers className="w-3.5 h-3.5 mr-1 text-purple-400" />
            <span>Read Clipboard</span>
          </button>

          <button
            type="button"
            className="gacks-btn-subtle"
            onClick={() => void loadTelemetry(false)}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Probing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Transient Feedback Banner */}
      {feedback && (
        <div
          className={`px-4 py-2.5 rounded-md text-xs font-mono flex items-center justify-between border transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : feedback.type === 'error'
              ? 'bg-red-950/40 border-red-500/40 text-red-300'
              : 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {feedback.type === 'error' && <AlertTriangle className="w-4 h-4 text-red-400" />}
            {feedback.type === 'info' && <Layers className="w-4 h-4 text-cyan-400" />}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            className="text-gray-400 hover:text-white"
            onClick={() => setFeedback(null)}
          >
            &times;
          </button>
        </div>
      )}

      {/* Quick Overview Summary Banner */}
      <div className="gacks-card p-3 flex items-center justify-between flex-wrap gap-3 border border-[#00A3FF]/20 bg-[#0d131f]/60">
        <div className="flex items-center gap-3">
          <Laptop className="w-5 h-5 text-[#00A3FF]" />
          <div>
            <span className="text-xs font-mono font-bold text-white block">
              {hardware ? `${hardware.hostname} • ${hardware.platform}` : 'Connecting to local bridge...'}
            </span>
            <span className="text-[11px] font-mono text-gray-400">
              Gateway: {BRIDGE_HTTP_URL} • Latency: {latency !== null ? `${latency} ms` : 'Local Core'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981]" />
            <span className="text-gray-300">OS Bridge:</span>
            <span className="text-emerald-400 font-bold uppercase">{phase !== 'offline' ? 'ONLINE' : 'OFFLINE'}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-gray-300">Security:</span>
            <span className="text-cyan-400 font-bold">5-TIER GOVERNED</span>
          </div>

          {hardware && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-gray-400">Uptime:</span>
              <span className="text-gray-200">
                {Math.floor(hardware.uptimeSeconds / 3600)}h {Math.floor((hardware.uptimeSeconds % 3600) / 60)}m
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-gray-800 pb-2">
        <button
          type="button"
          className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all flex items-center gap-1.5 ${
            activeTab === 'vitals'
              ? 'bg-[#00A3FF]/20 text-[#00A3FF] border border-[#00A3FF]/40'
              : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => setActiveTab('vitals')}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>HARDWARE & VITALS</span>
        </button>

        <button
          type="button"
          className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all flex items-center gap-1.5 ${
            activeTab === 'devices'
              ? 'bg-[#00A3FF]/20 text-[#00A3FF] border border-[#00A3FF]/40'
              : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => setActiveTab('devices')}
        >
          <Wifi className="w-3.5 h-3.5" />
          <span>DEVICES & NETWORK</span>
        </button>

        <button
          type="button"
          className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all flex items-center gap-1.5 ${
            activeTab === 'tasks'
              ? 'bg-[#00A3FF]/20 text-[#00A3FF] border border-[#00A3FF]/40'
              : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => setActiveTab('tasks')}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>TASK MANAGER & APPS ({processes.length})</span>
        </button>

        <button
          type="button"
          className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all flex items-center gap-1.5 ${
            activeTab === 'security'
              ? 'bg-[#00A3FF]/20 text-[#00A3FF] border border-[#00A3FF]/40'
              : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => setActiveTab('security')}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>PERMISSIONS & AUDIT</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: HARDWARE & VITALS                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'vitals' && (
        <div className="space-y-4">
          {/* Main 4 Vitals Tiles */}
          <div className="gacks-system-vitals-grid">
            {/* CPU Vitals Card */}
            <div className="gacks-card gacks-vital-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-gray-400">PROCESSOR (CPU)</span>
                <Cpu className="w-4 h-4 text-[#00A3FF]" />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold text-white font-mono">
                  {hardware ? `${hardware.cpu.utilizationPercent}%` : '--'}
                </span>
                <span className="text-xs text-gray-400 font-mono">
                  {hardware ? `${hardware.cpu.physicalCores}C / ${hardware.cpu.logicalCores}T` : 'Cores'}
                </span>
              </div>
              {/* CPU Load Meter Bar */}
              <div className="w-full bg-gray-800 rounded-full h-1.5 mt-2.5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-[#00A3FF] transition-all duration-500"
                  style={{ width: `${hardware ? hardware.cpu.utilizationPercent : 0}%` }}
                />
              </div>
              <span className="text-[11px] text-gray-400 font-mono mt-2 block truncate" title={hardware?.cpu.model}>
                {hardware?.cpu.model || 'Detecting CPU model...'}
              </span>
            </div>

            {/* RAM Vitals Card */}
            <div className="gacks-card gacks-vital-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-gray-400">MEMORY (RAM)</span>
                <Activity className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold text-white font-mono">
                  {hardware ? `${hardware.memory.usagePercent}%` : '--'}
                </span>
                <span className="text-xs text-gray-400 font-mono">
                  {hardware
                    ? `${formatBytesGb(hardware.memory.usedBytes)} / ${formatBytesGb(hardware.memory.totalBytes)} GB`
                    : 'RAM Usage'}
                </span>
              </div>
              {/* RAM Meter Bar */}
              <div className="w-full bg-gray-800 rounded-full h-1.5 mt-2.5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                  style={{ width: `${hardware ? hardware.memory.usagePercent : 0}%` }}
                />
              </div>
              <span className="text-[11px] text-gray-400 font-mono mt-2 block">
                {hardware ? `${formatBytesGb(hardware.memory.freeBytes)} GB Free Available` : 'Calculating free memory...'}
              </span>
            </div>

            {/* GPU Card */}
            <div className="gacks-card gacks-vital-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-gray-400">GRAPHICS (GPU)</span>
                <Zap className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    hardware?.gpu.available ? 'bg-purple-400 shadow-[0_0_8px_#A855F7]' : 'bg-gray-500'
                  }`}
                />
                <span className="text-base font-bold text-white font-mono truncate" title={hardware?.gpu.name}>
                  {hardware?.gpu.name || 'Unavailable'}
                </span>
              </div>
              <div className="text-[11px] text-gray-400 font-mono mt-3">
                {hardware?.gpu.driverVersion ? `Driver: ${hardware.gpu.driverVersion}` : 'Standard Display Adapter'}
              </div>
              <span className="text-[11px] text-purple-400 font-mono mt-1 block">
                Status: {hardware?.gpu.status || 'Unavailable'}
              </span>
            </div>

            {/* Power & Battery Card */}
            <div className="gacks-card gacks-vital-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-gray-400">POWER & BATTERY</span>
                <Server className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold text-white font-mono">
                  {hardware ? `${hardware.power.chargePercent}%` : '--'}
                </span>
                <span className="text-xs text-amber-400 font-mono">
                  {hardware?.power.hasBattery ? (hardware.power.acConnected ? 'Charging' : 'On Battery') : 'Desktop (AC)'}
                </span>
              </div>
              {/* Battery Bar */}
              <div className="w-full bg-gray-800 rounded-full h-1.5 mt-2.5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500"
                  style={{ width: `${hardware ? hardware.power.chargePercent : 100}%` }}
                />
              </div>
              <span className="text-[11px] text-gray-400 font-mono mt-2 block">
                {hardware?.power.status || 'AC Wall Power Connected'}
              </span>
            </div>
          </div>

          {/* Secondary Row: Multi-Drive Storage & Connected Displays */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Storage Drives (2 Columns) */}
            <div className="lg:col-span-2 gacks-card p-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-[#00A3FF]" />
                  <span className="text-xs font-mono font-bold text-gray-200 uppercase">
                    Storage Volumes & Partitions ({hardware?.drives.length || 1})
                  </span>
                </div>
                <span className="text-[11px] font-mono text-gray-400">Live Disk Telemetry</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                {(hardware?.drives || []).map((drive) => (
                  <div key={drive.drive} className="p-3 bg-black/40 rounded border border-gray-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-white">
                        <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{drive.label}</span>
                      </div>
                      <span className="text-xs font-mono text-cyan-400 font-bold">{drive.usagePercent}%</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-800 rounded-full h-1.5 mt-2 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          drive.usagePercent > 85 ? 'bg-red-500' : 'bg-[#00A3FF]'
                        }`}
                        style={{ width: `${drive.usagePercent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between mt-2 text-[11px] font-mono text-gray-400">
                      <span>{formatBytesGb(drive.freeBytes)} GB Free</span>
                      <span>Total: {formatBytesGb(drive.totalBytes)} GB</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Displays & Monitors (1 Column) */}
            <div className="gacks-card p-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-mono font-bold text-gray-200 uppercase">
                    Displays ({hardware?.displays.length || 1})
                  </span>
                </div>
                <span className="text-[11px] font-mono text-gray-400">Monitors</span>
              </div>

              <div className="space-y-2 mt-3">
                {(hardware?.displays || []).map((disp, idx) => (
                  <div key={idx} className="p-2.5 bg-black/40 rounded border border-gray-800 text-xs font-mono">
                    <div className="flex items-center justify-between text-white font-bold">
                      <span className="truncate">{disp.name}</span>
                      <span className="text-emerald-400 text-[10px] uppercase font-bold">{disp.status}</span>
                    </div>
                    <div className="flex items-center justify-between text-gray-400 text-[11px] mt-1">
                      <span>Resolution: {disp.resolution}</span>
                      <span>{disp.refreshRateHz} Hz</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DEVICES & NETWORK                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'devices' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Wi-Fi & Wireless Card */}
          <div className="gacks-card p-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono font-bold text-gray-200 uppercase">Wi-Fi & Wireless Status</span>
              </div>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  devices?.wifi.connected
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-gray-800 text-gray-400'
                }`}
              >
                {devices?.wifi.connected ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>

            <div className="mt-3 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between p-2 bg-black/40 rounded">
                <span className="text-gray-400">Network SSID:</span>
                <span className="text-white font-bold">{devices?.wifi.ssid || 'Not connected to Wi-Fi'}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-black/40 rounded">
                <span className="text-gray-400">Signal Strength:</span>
                <span className="text-cyan-400 font-bold">
                  {devices?.wifi.signalPercent !== undefined ? `${devices.wifi.signalPercent}%` : 'Ethernet / Direct'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-black/40 rounded">
                <span className="text-gray-400">Radio Standard:</span>
                <span className="text-gray-300">{devices?.wifi.radioType || '802.11ax / ac'}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-black/40 rounded">
                <span className="text-gray-400">Interface:</span>
                <span className="text-gray-300">{devices?.wifi.interfaceName || 'Wi-Fi Adapter'}</span>
              </div>
            </div>
          </div>

          {/* Network Adapters Card */}
          <div className="gacks-card p-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-[#00A3FF]" />
                <span className="text-xs font-mono font-bold text-gray-200 uppercase">
                  Network Adapters ({devices?.networkAdapters.length || 0})
                </span>
              </div>
            </div>

            <div className="mt-3 space-y-2 text-xs font-mono max-h-56 overflow-y-auto">
              {(devices?.networkAdapters || []).map((adapter, idx) => (
                <div key={idx} className="p-2 bg-black/40 rounded border border-gray-800">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold truncate">{adapter.name}</span>
                    <span
                      className={`text-[10px] uppercase ${
                        adapter.status === 'Up' ? 'text-emerald-400 font-bold' : 'text-gray-500'
                      }`}
                    >
                      {adapter.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1">
                    <span className="truncate">{adapter.description || 'Ethernet'}</span>
                    <span>{adapter.linkSpeed || 'Gigabit'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bluetooth Devices Card */}
          <div className="gacks-card p-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Bluetooth className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-mono font-bold text-gray-200 uppercase">
                  Bluetooth Radio & Peripherals ({devices?.bluetoothDevices.length || 0})
                </span>
              </div>
            </div>

            <div className="mt-3 space-y-2 text-xs font-mono max-h-56 overflow-y-auto">
              {(devices?.bluetoothDevices || []).length === 0 ? (
                <div className="p-3 text-center text-gray-500 font-mono text-xs">No active Bluetooth devices detected.</div>
              ) : (
                devices?.bluetoothDevices.map((bt, idx) => (
                  <div key={idx} className="p-2 bg-black/40 rounded border border-gray-800 flex items-center justify-between">
                    <span className="text-white font-bold truncate">{bt.name}</span>
                    <span className="text-emerald-400 text-[10px] uppercase font-bold">{bt.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Audio Devices & Printers Card */}
          <div className="gacks-card p-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono font-bold text-gray-200 uppercase">Audio & Printers</span>
              </div>
            </div>

            <div className="mt-3 space-y-2 text-xs font-mono">
              <span className="text-[11px] font-mono text-gray-400 block font-bold">AUDIO ENDPOINTS:</span>
              {(devices?.audioDevices || []).slice(0, 3).map((audio, idx) => (
                <div key={idx} className="p-2 bg-black/40 rounded border border-gray-800 flex items-center justify-between">
                  <span className="text-white truncate">{audio.name}</span>
                  <span className="text-emerald-400 text-[10px]">{audio.status}</span>
                </div>
              ))}

              <span className="text-[11px] font-mono text-gray-400 block font-bold pt-2">PRINTERS:</span>
              {(devices?.printers || []).slice(0, 3).map((pr, idx) => (
                <div key={idx} className="p-2 bg-black/40 rounded border border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 truncate">
                    <Printer className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-white truncate">{pr.name}</span>
                  </div>
                  {pr.isDefault && <span className="text-cyan-400 text-[10px] font-bold">DEFAULT</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: TASK MANAGER & APPS                                                */}
      {/* ========================================================================= */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {/* Search and Control Bar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                className="w-full bg-[#141416] border border-gray-800 rounded pl-9 pr-3 py-2 text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-[#00A3FF]"
                placeholder="Search processes by name or PID..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
              />
            </div>
            <div className="text-xs font-mono text-gray-400">
              Showing {filteredProcesses.length} of {processes.length} running processes
            </div>
          </div>

          {/* Processes Table */}
          <div className="gacks-card overflow-hidden">
            <div className="p-3 border-b border-gray-800 flex items-center justify-between">
              <span className="text-xs font-mono text-gray-200 font-bold uppercase">
                Active Windows Processes (Task Manager)
              </span>
              <span className="text-[11px] font-mono text-gray-400">Sorted by CPU Load</span>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="gacks-tools-table">
                <thead>
                  <tr>
                    <th>PID</th>
                    <th>PROCESS NAME</th>
                    <th>CPU TIME (S)</th>
                    <th>MEMORY (MB)</th>
                    <th>STATUS</th>
                    <th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProcesses.map((proc) => (
                    <tr key={proc.pid}>
                      <td className="font-mono text-xs text-gray-400">{proc.pid}</td>
                      <td>
                        <div className="flex items-center gap-2 font-mono text-xs text-white font-bold">
                          <Activity className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{proc.name}</span>
                        </div>
                      </td>
                      <td className="font-mono text-xs text-gray-300">{proc.cpuSeconds} s</td>
                      <td className="font-mono text-xs text-cyan-400 font-bold">{proc.memoryMb} MB</td>
                      <td>
                        <span
                          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                            proc.responding ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {proc.responding ? 'Running' : 'Suspended'}
                        </span>
                      </td>
                      <td>
                        {proc.isSystemProcess ? (
                          <span className="text-[10px] font-mono text-gray-500">System Protected</span>
                        ) : (
                          <button
                            type="button"
                            className="px-2 py-1 rounded bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 border border-red-500/30 text-[11px] font-mono font-bold transition-all flex items-center gap-1"
                            onClick={() => setTerminateTarget(proc)}
                          >
                            <XOctagon className="w-3 h-3" />
                            <span>End Task</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Installed & Running Applications Grid */}
          <div className="gacks-card p-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-mono font-bold text-gray-200 uppercase">
                  Desktop Applications Discovery ({apps.installed.length} installed)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-3 max-h-72 overflow-y-auto">
              {filteredInstalledApps.map((app, idx) => (
                <div
                  key={idx}
                  className="p-2.5 bg-black/40 rounded border border-gray-800 flex items-center justify-between text-xs font-mono"
                >
                  <div className="truncate mr-2">
                    <span className="text-white font-bold block truncate" title={app.name}>
                      {app.name}
                    </span>
                    <span className="text-[10px] text-gray-400 truncate block">{app.publisher || app.version || 'Desktop App'}</span>
                  </div>
                  <button
                    type="button"
                    className="p-1.5 rounded bg-[#00A3FF]/20 hover:bg-[#00A3FF]/40 text-[#00A3FF] border border-[#00A3FF]/30 transition-all"
                    onClick={() => void handleLaunchApp(app.name)}
                    title={`Launch ${app.name}`}
                  >
                    <Play className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PERMISSIONS & AUDIT                                                */}
      {/* ========================================================================= */}
      {activeTab === 'security' && (
        <div className="space-y-4">
          {/* Capability Registry Matrix */}
          <div className="gacks-card overflow-hidden">
            <div className="p-3 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono text-gray-200 font-bold uppercase">
                  OS Capability Permissions Matrix (Active Local Policy)
                </span>
              </div>
              <span className="text-[11px] font-mono text-gray-400">Zero Trust Governance</span>
            </div>

            <div className="overflow-x-auto">
              <table className="gacks-tools-table">
                <thead>
                  <tr>
                    <th>CAPABILITY</th>
                    <th>CATEGORY</th>
                    <th>RISK LEVEL</th>
                    <th>SCOPE & DESCRIPTION</th>
                    <th>CURRENT PERMISSION</th>
                  </tr>
                </thead>
                <tbody>
                  {capStatus &&
                    Object.values(capStatus.capabilities).map((cap) => (
                      <tr key={cap.id}>
                        <td>
                          <div className="flex items-center gap-2 font-mono text-xs text-white font-bold">
                            <Terminal className="w-3.5 h-3.5 text-[#00A3FF]" />
                            <span>{cap.name}</span>
                          </div>
                        </td>
                        <td>
                          <span className="gacks-table-category-badge">{cap.category}</span>
                        </td>
                        <td>
                          <span
                            className={`text-xs font-mono font-bold uppercase ${
                              cap.riskLevel === 'destructive'
                                ? 'text-red-400'
                                : cap.riskLevel === 'control' || cap.riskLevel === 'write'
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            {cap.riskLevel}
                          </span>
                        </td>
                        <td className="text-xs text-gray-300 max-w-md">{cap.description}</td>
                        <td>
                          <select
                            className="bg-[#141416] border border-gray-700 text-xs font-mono rounded px-2 py-1 text-white focus:outline-none focus:border-[#00A3FF]"
                            value={cap.currentState}
                            onChange={(e) => void handleTogglePermission(cap.id, e.target.value as PermissionState)}
                          >
                            <option value="granted">Granted (Auto)</option>
                            <option value="prompt">Prompt (Consent)</option>
                            <option value="denied">Denied (Forbidden)</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* System Audit Log */}
          <div className="gacks-card overflow-hidden">
            <div className="p-3 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono text-gray-200 font-bold uppercase">
                  System Operation Audit Log ({auditLogs.length} entries)
                </span>
              </div>
              <span className="text-[11px] font-mono text-gray-400">Tamper-Evident History</span>
            </div>

            <div className="overflow-x-auto max-h-80">
              <table className="gacks-tools-table">
                <thead>
                  <tr>
                    <th>TIMESTAMP</th>
                    <th>CAPABILITY</th>
                    <th>ACTION</th>
                    <th>INITIATOR</th>
                    <th>STATUS</th>
                    <th>DURATION</th>
                    <th>SUMMARY</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center text-gray-500 py-4 font-mono text-xs">
                        No system operations logged yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="text-[11px] font-mono text-gray-400">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td>
                          <span className="gacks-table-category-badge">{log.capability}</span>
                        </td>
                        <td className="font-mono text-xs text-white font-bold">{log.action}</td>
                        <td className="font-mono text-xs uppercase text-cyan-400">{log.initiator}</td>
                        <td>
                          <span
                            className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                              log.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {log.confirmationState}
                          </span>
                        </td>
                        <td className="text-xs font-mono text-gray-400">{log.durationMs} ms</td>
                        <td className="text-xs text-gray-300 max-w-xs truncate">{log.resultSummary || log.error || '--'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PROCESS TERMINATION CONFIRMATION MODAL                                    */}
      {/* ========================================================================= */}
      {terminateTarget && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141416] border border-red-500/40 rounded-lg max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-red-950 border border-red-500/50">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-mono font-bold text-white uppercase">Confirm Process Termination</h3>
                <p className="text-xs text-gray-400">High-consequence system action</p>
              </div>
            </div>

            <p className="text-xs font-mono text-gray-300">
              Are you sure you want to forcibly terminate process{' '}
              <span className="text-red-400 font-bold">{terminateTarget.name}</span> (PID: {terminateTarget.pid})? Unsaved
              application data may be lost.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded text-xs font-mono text-gray-300 hover:text-white bg-gray-800"
                onClick={() => setTerminateTarget(null)}
                disabled={isTerminating}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded text-xs font-mono text-white bg-red-600 hover:bg-red-500 font-bold transition-all flex items-center gap-1.5"
                onClick={handleTerminateProcess}
                disabled={isTerminating}
              >
                <XOctagon className="w-3.5 h-3.5" />
                <span>{isTerminating ? 'Terminating...' : 'Force Kill Task'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

