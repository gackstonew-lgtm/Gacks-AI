import React, { useState, useEffect } from 'react'
import { Cpu, Layers, HardDrive, Wifi } from 'lucide-react'
import { useStore } from '../../store'
import { apiClient, type SystemMetrics } from '../../lib/api-client'

export const SystemStatusCard: React.FC = () => {
  const phase = useStore((s) => s.phase)

  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [isLocalConnected, setIsLocalConnected] = useState(true)

  useEffect(() => {
    let cancelled = false
    const abortController = new AbortController()

    const fetchHardwareMetrics = async () => {
      try {
        const res = await apiClient.getSystemMetrics(abortController.signal, true)
        if (cancelled) return

        if (res.ok && res.data) {
          setMetrics(res.data)
          setIsLocalConnected(true)
          setLoading(false)
        } else if (res.isOffline) {
          setIsLocalConnected(false)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setIsLocalConnected(false)
          setLoading(false)
        }
      }
    }

    // Initial query
    fetchHardwareMetrics()

    // 2.5s update cadence for hardware monitoring
    const timer = setInterval(fetchHardwareMetrics, 2500)

    return () => {
      cancelled = true
      abortController.abort()
      clearInterval(timer)
    }
  }, [phase])

  // Circular gauge SVG helper with clamped bounds
  const renderGauge = (pct: number, color: string) => {
    const clamped = Math.max(0, Math.min(100, isNaN(pct) ? 0 : Math.round(pct)))
    const radius = 26
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (clamped / 100) * circumference

    return (
      <svg className="gacks-gauge-svg" width="64" height="64" viewBox="0 0 64 64">
        <circle
          className="gacks-gauge-bg"
          cx="32"
          cy="32"
          r={radius}
          strokeWidth="4"
        />
        <circle
          className="gacks-gauge-fill"
          cx="32"
          cy="32"
          r={radius}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          stroke={color}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
    )
  }

  // Derive status banner text and styling
  const statusLabel = !isLocalConnected
    ? 'Local system access unavailable'
    : metrics?.operationalState === 'degraded'
    ? 'System monitoring degraded'
    : 'All systems operational'

  const isHealthy = isLocalConnected && metrics?.operationalState === 'operational'

  const cpuVal = metrics ? metrics.cpuUsagePercent : 0
  const memVal = metrics ? metrics.memoryUsagePercent : 0
  const storVal = metrics ? metrics.storageUsagePercent : 0

  // Network gauge & label
  const netActive = Boolean(metrics && metrics.network && (metrics.network.status === 'Up' || metrics.network.status === 'Connected'))
  const netGaugePct = netActive ? 100 : 0
  const netDisplay = metrics?.network.linkSpeed
    ? metrics.network.linkSpeed
    : metrics?.network.adapterName
    ? metrics.network.adapterName
    : isLocalConnected
    ? 'Connected'
    : 'Offline'

  const memoryDetail = metrics
    ? `${(metrics.memoryUsedBytes / 1073741824).toFixed(1)}G / ${(metrics.memoryTotalBytes / 1073741824).toFixed(0)}G`
    : ''

  const storageDetail = metrics
    ? `${metrics.storageDrive} ${(metrics.storageUsedBytes / 1073741824).toFixed(0)}G`
    : ''

  return (
    <div className="gacks-card gacks-system-card">
      <div className="gacks-card-header">
        <div className="gacks-card-title-wrap">
          <span className="gacks-orange-bullet" />
          <h3 className="gacks-card-title">SYSTEM STATUS</h3>
        </div>
        <span
          className={`gacks-system-banner ${
            isHealthy ? 'gacks-system-operational' : 'gacks-system-attention'
          }`}
        >
          • {statusLabel}
        </span>
      </div>

      <div className="gacks-system-grid">
        {/* CPU */}
        <div className="gacks-system-tile" title={metrics ? `Real CPU Load: ${cpuVal}%` : 'Hardware CPU'}>
          <div className="gacks-gauge-wrap">
            {renderGauge(loading ? 0 : cpuVal, '#00A3FF')}
            <div className="gacks-gauge-center">
              <Cpu className="w-4 h-4 text-[#00A3FF]" />
            </div>
          </div>
          <div className="gacks-system-tile-data">
            <span className="gacks-system-label">CPU</span>
            <span className="gacks-system-val">{loading ? '--' : `${cpuVal}%`}</span>
          </div>
        </div>

        {/* MEMORY */}
        <div className="gacks-system-tile" title={memoryDetail ? `RAM: ${memoryDetail}` : 'Physical RAM'}>
          <div className="gacks-gauge-wrap">
            {renderGauge(loading ? 0 : memVal, '#FF453A')}
            <div className="gacks-gauge-center">
              <Layers className="w-4 h-4 text-[#FF453A]" />
            </div>
          </div>
          <div className="gacks-system-tile-data">
            <span className="gacks-system-label">MEMORY</span>
            <span className="gacks-system-val">{loading ? '--' : `${memVal}%`}</span>
          </div>
        </div>

        {/* STORAGE */}
        <div className="gacks-system-tile" title={storageDetail ? `Disk (${storageDetail})` : 'System Storage'}>
          <div className="gacks-gauge-wrap">
            {renderGauge(loading ? 0 : storVal, '#38BDF8')}
            <div className="gacks-gauge-center">
              <HardDrive className="w-4 h-4 text-[#38BDF8]" />
            </div>
          </div>
          <div className="gacks-system-tile-data">
            <span className="gacks-system-label">STORAGE</span>
            <span className="gacks-system-val">{loading ? '--' : `${storVal}%`}</span>
          </div>
        </div>

        {/* NETWORK */}
        <div
          className="gacks-system-tile"
          title={metrics?.network.adapterType || metrics?.network.adapterName || 'Active Adapter'}
        >
          <div className="gacks-gauge-wrap">
            {renderGauge(loading ? 0 : netGaugePct, '#10B981')}
            <div className="gacks-gauge-center">
              <Wifi className="w-4 h-4 text-[#10B981]" />
            </div>
          </div>
          <div className="gacks-system-tile-data">
            <span className="gacks-system-label">NETWORK</span>
            <span
              className="gacks-system-val"
              style={{
                fontSize: netDisplay.length > 8 ? '11px' : undefined,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '75px',
              }}
            >
              {loading ? '--' : netDisplay}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

