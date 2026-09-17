/**
 * GACKS AI — Model Selector Panel (Phase 21-22)
 *
 * Compact floating panel embedded into the existing HUD/settings area.
 * Allows the user to pin a specific AI model or select a routing mode
 * without leaving the chat or dashboard.
 *
 * Preserves existing UI — non-invasive addition only.
 */

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '../../lib/api-client'
import type { ModelDescriptor, RoutingMode, PrivacyPolicy } from '../../lib/api-client'

const PROVIDER_COLORS: Record<string, string> = {
  gemini: '#4285F4',
  anthropic: '#C06A3D',
  openai: '#10A37F',
  groq: '#F55036',
  mistral: '#FF7000',
  openrouter: '#7C3AED',
  ollama: '#22C55E',
  llamacpp: '#EAB308',
}

interface ModelSelectorPanelProps {
  onClose: () => void
}

export default function ModelSelectorPanel({ onClose }: ModelSelectorPanelProps) {
  const [models, setModels] = useState<ModelDescriptor[]>([])
  const [loading, setLoading] = useState(true)
  const [routingMode, setRoutingMode] = useState<RoutingMode>('AUTO')
  const [privacyPolicy, setPrivacyPolicy] = useState<PrivacyPolicy>('CLOUD_ALLOWED')
  const [pinnedModelId, setPinnedModelId] = useState<string | undefined>()
  const [searchTerm, setSearchTerm] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [modelsRes, prefsRes] = await Promise.allSettled([
      apiClient.getModels(),
      apiClient.getModelPreferences(),
    ])

    if (modelsRes.status === 'fulfilled' && modelsRes.value.ok) {
      setModels(modelsRes.value.data?.models ?? [])
    }
    if (prefsRes.status === 'fulfilled' && prefsRes.value.ok && prefsRes.value.data) {
      setRoutingMode(prefsRes.value.data.routingMode)
      setPrivacyPolicy(prefsRes.value.data.privacyPolicy)
      setPinnedModelId(prefsRes.value.data.preferredModelId)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    const res = await apiClient.updateModelPreferences({
      routingMode,
      privacyPolicy,
      preferredModelId: pinnedModelId,
    })
    if (res.ok) {
      setSavedMsg('✓ Saved')
      setTimeout(() => setSavedMsg(''), 2000)
    }
    setSaving(false)
  }

  const filteredModels = models.filter((m) =>
    !searchTerm || m.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div style={{
      position: 'fixed',
      bottom: '80px',
      right: '20px',
      width: '380px',
      maxHeight: '600px',
      borderRadius: '16px',
      background: 'rgba(15,23,42,0.97)',
      border: '1px solid rgba(34,211,238,0.2)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      backdropFilter: 'blur(20px)',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--gacks-cyan,#22d3ee)' }}>◎ AI Model</div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: '1px' }}>
            {pinnedModelId ? `Pinned: ${models.find(m => m.id === pinnedModelId)?.displayName ?? pinnedModelId}` : `Mode: ${routingMode}`}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1, padding: '4px' }}>×</button>
      </div>

      {/* Routing mode bar */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {(['AUTO', 'LOCAL_ONLY', 'CLOUD_ONLY', 'OFFLINE'] as RoutingMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => { setRoutingMode(mode); if (mode !== 'AUTO') setPinnedModelId(undefined) }}
            style={{
              padding: '4px 10px',
              borderRadius: '12px',
              border: `1px solid ${routingMode === mode ? 'var(--gacks-cyan,#22d3ee)' : 'rgba(255,255,255,0.1)'}`,
              background: routingMode === mode ? 'rgba(34,211,238,0.1)' : 'transparent',
              color: routingMode === mode ? 'var(--gacks-cyan,#22d3ee)' : 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
              fontSize: '0.65rem',
              fontWeight: 700,
            }}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder='Search models...'
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '8px 12px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.8)',
            fontSize: '0.8rem',
            outline: 'none',
          }}
        />
      </div>

      {/* Model list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {/* Auto-select option */}
        <div
          onClick={() => setPinnedModelId(undefined)}
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            padding: '10px 12px',
            borderRadius: '8px',
            marginBottom: '4px',
            cursor: 'pointer',
            background: !pinnedModelId ? 'rgba(34,211,238,0.07)' : 'transparent',
            border: `1px solid ${!pinnedModelId ? 'rgba(34,211,238,0.25)' : 'transparent'}`,
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>⚡</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'rgba(255,255,255,0.9)' }}>Auto-Select</div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>Best model per task, hardware-aware</div>
          </div>
          {!pinnedModelId && <span style={{ color: 'var(--gacks-cyan,#22d3ee)', fontWeight: 700, fontSize: '0.75rem' }}>ACTIVE</span>}
        </div>

        {loading && <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>Loading…</div>}

        {filteredModels.map((model) => {
          const isSelected = pinnedModelId === model.id
          const providerColor = PROVIDER_COLORS[model.provider] ?? '#64748b'

          return (
            <div
              key={model.id}
              onClick={() => setPinnedModelId(isSelected ? undefined : model.id)}
              style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'center',
                padding: '10px 12px',
                borderRadius: '8px',
                marginBottom: '4px',
                cursor: 'pointer',
                background: isSelected ? 'rgba(34,211,238,0.07)' : 'transparent',
                border: `1px solid ${isSelected ? 'rgba(34,211,238,0.25)' : 'transparent'}`,
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ color: providerColor, fontSize: '1.1rem', flexShrink: 0 }}>
                {model.isLocal ? '🖥' : '☁'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {model.displayName}
                </div>
                <div style={{ fontSize: '0.68rem', color: providerColor, fontWeight: 600 }}>
                  {model.provider} · {(model.contextWindow / 1000).toFixed(0)}K ctx
                  {model.costPerMillionTokens ? ` · $${model.costPerMillionTokens}/M` : ' · Free'}
                </div>
              </div>
              {model.isLocal && (
                <span style={{ fontSize: '0.6rem', padding: '2px 5px', borderRadius: '8px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)', flexShrink: 0 }}>LOCAL</span>
              )}
              {isSelected && (
                <span style={{ color: 'var(--gacks-cyan,#22d3ee)', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>✓</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <select
          value={privacyPolicy}
          onChange={(e) => setPrivacyPolicy(e.target.value as PrivacyPolicy)}
          style={{ flex: 1, padding: '7px 10px', borderRadius: '7px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}
        >
          <option value='CLOUD_ALLOWED'>🌐 Cloud Allowed</option>
          <option value='HYBRID'>⚖ Hybrid</option>
          <option value='LOCAL_ONLY'>🔒 Local Only</option>
        </select>
        <button
          onClick={save}
          disabled={saving}
          style={{ padding: '7px 16px', borderRadius: '7px', background: 'linear-gradient(135deg,var(--gacks-cyan,#22d3ee),#3b82f6)', border: 'none', color: '#0f172a', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0 }}
        >
          {savedMsg || (saving ? '…' : 'Save')}
        </button>
      </div>
    </div>
  )
}

