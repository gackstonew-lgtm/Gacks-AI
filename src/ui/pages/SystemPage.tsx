import React, { useState, useEffect, useCallback } from 'react'
import {
  Cpu,
  Activity,
  ShieldCheck,
  RefreshCw,
  Server,
  Zap,
  Terminal,
} from 'lucide-react'
import { useStore } from '../../store'
import { BRIDGE_HTTP_URL } from '../../config'
import { navigate } from '../../lib/router'
import { apiClient } from '../../lib/api-client'

export const SystemPage: React.FC = () => {
  const phase = useStore((s) => s.phase)
  const submitQuery = useStore((s) => s.submitQuery)

  const [healthData, setHealthData] = useState<{
    ok?: boolean
    services?: Record<string, { status: string; engine?: string; provider?: string }>
    environment?: string
    status?: string
  }>({
    status: 'checking',
  })
  const [latency, setLatency] = useState<number | null>(null)
  const [checking, setChecking] = useState(false)

  const checkHealth = useCallback(async (isBackground = false) => {
    setChecking(true)
    const start = performance.now()
    try {
      const res = await apiClient.getHealth(undefined, isBackground)
      const elapsed = Math.round(performance.now() - start)
      setLatency(elapsed)
      if (res.ok && res.data) {
        setHealthData(res.data)
      } else if (res.isOffline) {
        setHealthData({ status: 'offline' })
        setLatency(null)
      } else {
        setHealthData({ status: 'degraded' })
      }
    } catch {
      setHealthData({ status: phase !== 'offline' ? 'online-client' : 'offline' })
      setLatency(null)
    } finally {
      setChecking(false)
    }
  }, [phase])

  useEffect(() => {
    void checkHealth(false)
    const timer = setInterval(() => void checkHealth(true), 15000)
    return () => clearInterval(timer)
  }, [checkHealth])

  const registeredTools = [
    { name: 'read_file', category: 'Filesystem', level: 'Level 0 (Autonomous)', desc: 'Reads sandboxed workspace files safely' },
    { name: 'list_directory', category: 'Filesystem', level: 'Level 0 (Autonomous)', desc: 'Lists directory structures inside approved roots' },
    { name: 'write_file', category: 'Filesystem', level: 'Level 2 (Governed)', desc: 'Writes or modifies workspace source files' },
    { name: 'look', category: 'Vision', level: 'Level 0 (Autonomous)', desc: 'Inspects real-time camera frames and environment' },
    { name: 'capture_screen', category: 'Vision', level: 'Level 0 (Autonomous)', desc: 'Captures full screen viewport for visual comprehension' },
    { name: 'send_email', category: 'Communication', level: 'Level 4 (High Risk)', desc: 'Dispatches notification email with operator approval' },
    { name: 'send_whatsapp_message', category: 'Communication', level: 'Level 4 (High Risk)', desc: 'Sends message to designated contact via WhatsApp API' },
    { name: 'blade', category: 'Holographic HUD', level: 'Level 0 (Autonomous)', desc: 'Presents readable full-height article or media surface' },
    { name: 'display', category: 'Holographic HUD', level: 'Level 0 (Autonomous)', desc: 'Renders floating holographic card beside reactor' },
    { name: 'ui_theme', category: 'Holographic HUD', level: 'Level 0 (Autonomous)', desc: 'Controls interface accent, reactor spin and palette' },
    { name: 'ui_effect', category: 'Holographic HUD', level: 'Level 0 (Autonomous)', desc: 'Fires momentary cyber glitch or pulse effect' },
    { name: 'check_integrations', category: 'System', level: 'Level 0 (Autonomous)', desc: 'Probes real live statuses of external services' },
  ]

  return (
    <div className="gacks-page-container gacks-system-page">
      {/* Page Header */}
      <div className="gacks-page-header">
        <div className="gacks-page-title-wrap">
          <div className="gacks-page-icon-badge">
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h1 className="gacks-page-title">SYSTEM DIAGNOSTICS & TELEMETRY</h1>
            <p className="gacks-page-subtitle">
              Unified Agent Gateway :8787 runtime telemetry, Tool Registry V2, and Security Governance
            </p>
          </div>
        </div>

        <button
          type="button"
          className="gacks-btn-subtle"
          onClick={() => void checkHealth()}
          disabled={checking}
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${checking ? 'animate-spin' : ''}`} />
          <span>{checking ? 'Probing...' : 'Refresh Telemetry'}</span>
        </button>
      </div>

      {/* Vitals Cards Row */}
      <div className="gacks-system-vitals-grid">
        <div className="gacks-card gacks-vital-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-gray-400">AGENT GATEWAY</span>
            <Server className="w-4 h-4 text-[#00A3FF]" />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10B981]" />
            <span className="text-base font-bold text-white font-mono uppercase">
              {healthData.status === 'ok' ? 'HEALTHY' : healthData.status}
            </span>
          </div>
          <span className="text-xs text-gray-400 font-mono mt-1">
            Endpoint: {BRIDGE_HTTP_URL}
          </span>
        </div>

        <div className="gacks-card gacks-vital-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-gray-400">API LATENCY</span>
            <Activity className="w-4 h-4 text-orange-400" />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-2xl font-bold text-white font-mono">
              {latency !== null ? `${latency} ms` : 'Local Core'}
            </span>
          </div>
          <span className="text-xs text-gray-400 font-mono mt-1">
            Round-trip response ping
          </span>
        </div>

        <div className="gacks-card gacks-vital-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-gray-400">SECURITY GOVERNANCE</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-base font-bold text-emerald-400 font-mono">
              5-TIER ACTIVE
            </span>
          </div>
          <span className="text-xs text-gray-400 font-mono mt-1">
            Path containment & SSRF filtering
          </span>
        </div>

        <div className="gacks-card gacks-vital-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-gray-400">PRIMARY AI PROVIDER</span>
            <Zap className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-base font-bold text-white font-mono">
              Google Gemini 2.5 Flash
            </span>
          </div>
          <span className="text-xs text-cyan-400 font-mono mt-1">
            Claude 3.5 Sonnet Fallback Enabled
          </span>
        </div>
      </div>

      {/* Tool Registry Section */}
      <div className="gacks-system-registry-section">
        <div className="gacks-system-registry-header">
          <div className="flex items-center gap-2">
            <span className="gacks-orange-bullet" />
            <h3 className="text-xs font-mono text-gray-200 uppercase tracking-wider font-semibold">
              Tool Registry V2 ({registeredTools.length} tools registered)
            </h3>
          </div>
          <button
            type="button"
            className="gacks-card-header-link"
            onClick={() => {
              submitQuery('Run check_integrations and report full system diagnostics.')
              navigate('chat')
            }}
          >
            Run System Probe
          </button>
        </div>

        <div className="gacks-tools-table-container">
          <table className="gacks-tools-table">
            <thead>
              <tr>
                <th>TOOL IDENTIFIER</th>
                <th>CATEGORY</th>
                <th>SECURITY POLICY</th>
                <th>PURPOSE & CAPABILITY</th>
              </tr>
            </thead>
            <tbody>
              {registeredTools.map((t) => (
                <tr key={t.name}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-[#00A3FF]" />
                      <span className="font-mono text-xs text-white font-bold">{t.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className="gacks-table-category-badge">{t.category}</span>
                  </td>
                  <td>
                    <span
                      className={`text-xs font-mono ${
                        t.level.startsWith('Level 4')
                          ? 'text-red-400'
                          : t.level.startsWith('Level 2')
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {t.level}
                    </span>
                  </td>
                  <td className="text-xs text-gray-300">{t.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
