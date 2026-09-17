import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '../../lib/api-client'
import type {
  ModelDescriptor,
  HardwareCompatibilityReport,
  ModelDiscoveryResult,
  ModelHealthReport,
  AIUserPreferences,
  RoutingMode,
  PrivacyPolicy,
} from '../../lib/api-client'

const PROVIDER_COLORS: Record<string, string> = {
  gemini: '#4285F4',
  anthropic: '#C06A3D',
  openai: '#10A37F',
  groq: '#F55036',
  mistral: '#FF7000',
  openrouter: '#7C3AED',
  litellm: '#0284C7',
  ollama: '#22C55E',
  llamacpp: '#EAB308',
}

const PROVIDER_ICONS: Record<string, string> = {
  gemini: '✦',
  anthropic: '◈',
  openai: '⬡',
  groq: '⚡',
  mistral: '∿',
  openrouter: '◎',
  litellm: '🌐',
  ollama: '🦙',
  llamacpp: '🖥',
}

export default function ModelHubPage() {
  const [tab, setTab] = useState<'catalog' | 'local' | 'hardware' | 'telemetry' | 'preferences'>('catalog')
  const [models, setModels] = useState<ModelDescriptor[]>([])
  const [filter, setFilter] = useState<'all' | 'local' | 'cloud' | 'litellm'>('all')
  const [roleFilter, setRoleFilter] = useState('')
  const [health, setHealth] = useState<ModelHealthReport | null>(null)
  const [hardware, setHardware] = useState<HardwareCompatibilityReport | null>(null)
  const [discovery, setDiscovery] = useState<ModelDiscoveryResult | null>(null)
  const [prefs, setPrefs] = useState<AIUserPreferences | null>(null)
  const [loading, setLoading] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [installModelId, setInstallModelId] = useState('')
  const [installConsent, setInstallConsent] = useState(false)
  const [installStatus, setInstallStatus] = useState('')
  const [selectedModel, setSelectedModel] = useState<ModelDescriptor | null>(null)

  // Testing & Config States
  const [testingModelId, setTestingModelId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { status: string; latencyMs: number; error?: string; sampleResponse?: string }>>({})
  const [configModalModel, setConfigModalModel] = useState<ModelDescriptor | null>(null)
  const [customModalOpen, setCustomModalOpen] = useState(false)
  const [customModelData, setCustomModelData] = useState({
    id: '',
    displayName: '',
    provider: 'litellm',
    modelName: '',
    contextWindow: 128000,
    costPerMillion: 1.0,
  })

  const loadModels = useCallback(async () => {
    setLoading(true)
    const [modelsRes, healthRes] = await Promise.allSettled([
      apiClient.getModels(filter === 'all' || filter === 'litellm' ? undefined : filter, roleFilter || undefined),
      apiClient.getModelHealth(),
    ])
    if (modelsRes.status === 'fulfilled' && modelsRes.value.ok) {
      let list = modelsRes.value.data?.models ?? []
      if (filter === 'litellm') {
        list = list.filter((m) => m.provider === 'litellm')
      }
      setModels(list)
    }
    if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
      setHealth(healthRes.value.data ?? null)
    }
    setLoading(false)
  }, [filter, roleFilter])

  useEffect(() => { loadModels() }, [loadModels])

  const loadHardware = useCallback(async () => {
    const res = await apiClient.getHardwareCompatibility()
    if (res.ok) setHardware(res.data ?? null)
  }, [])

  const loadPrefs = useCallback(async () => {
    const res = await apiClient.getModelPreferences()
    if (res.ok) setPrefs(res.data ?? null)
  }, [])

  useEffect(() => {
    if (tab === 'hardware') loadHardware()
    if (tab === 'preferences') loadPrefs()
  }, [tab, loadHardware, loadPrefs])

  const runDiscovery = async () => {
    setDiscovering(true)
    const res = await apiClient.discoverLocalModels()
    if (res.ok) {
      setDiscovery(res.data ?? null)
      loadModels()
    }
    setDiscovering(false)
  }

  const handleInstall = async () => {
    if (!installConsent || !installModelId.trim()) return
    const res = await apiClient.installModel(installModelId.trim(), 'ollama', true)
    if (res.ok) {
      setInstallStatus(`✅ Installation of ${installModelId} started. Use Discover to refresh.`)
    } else {
      setInstallStatus(`❌ ${res.error}`)
    }
    setInstallConsent(false)
    setInstallModelId('')
  }

  const savePrefs = async (updates: Partial<AIUserPreferences>) => {
    const res = await apiClient.updateModelPreferences(updates)
    if (res.ok) setPrefs(res.data?.preferences ?? null)
  }

  const handleTestModel = async (modelId: string) => {
    setTestingModelId(modelId)
    try {
      const res = await apiClient.testModel(modelId)
      if (res.ok && res.data) {
        setTestResults((prev) => ({ ...prev, [modelId]: res.data! }))
      } else {
        setTestResults((prev) => ({
          ...prev,
          [modelId]: { status: 'ERROR', latencyMs: 0, error: res.error || 'Test request failed' },
        }))
      }
    } catch (e: any) {
      setTestResults((prev) => ({
        ...prev,
        [modelId]: { status: 'ERROR', latencyMs: 0, error: e.message || 'Test exception' },
      }))
    } finally {
      setTestingModelId(null)
    }
  }

  const handleUpdateModel = async (modelId: string, updates: Partial<ModelDescriptor>) => {
    const res = await apiClient.updateModel(modelId, updates)
    if (res.ok) {
      loadModels()
      if (configModalModel?.id === modelId) {
        setConfigModalModel((prev) => (prev ? { ...prev, ...updates } : null))
      }
    }
  }

  const handleCreateCustom = async () => {
    if (!customModelData.id || !customModelData.displayName || !customModelData.modelName) return
    const res = await apiClient.registerCustomModel({
      id: customModelData.id.trim(),
      displayName: customModelData.displayName.trim(),
      provider: customModelData.provider,
      modelName: customModelData.modelName.trim(),
      contextWindow: Number(customModelData.contextWindow) || 128000,
      costPerMillionTokens: Number(customModelData.costPerMillion) || 1.0,
      roles: ['GENERAL'],
      capabilities: ['text_generation', 'streaming', 'multi_turn', 'tool_calling'],
    })
    if (res.ok) {
      setCustomModalOpen(false)
      setCustomModelData({ id: '', displayName: '', provider: 'litellm', modelName: '', contextWindow: 128000, costPerMillion: 1.0 })
      loadModels()
    }
  }

  const isProviderOnline = (provider: string): boolean => {
    if (!health) return false
    const cloud = health.cloud.find((h) => h.name === provider)
    if (cloud) return cloud.available
    if (provider === 'ollama') return health.local.ollama.available
    if (provider === 'llamacpp') return health.local.llamacpp.available
    return true
  }

  const defaultModel = models.find((m) => m.id === prefs?.preferredModelId) || models.find((m) => m.enabled) || models[0]

  const filteredModels = models.filter((m) => {
    if (roleFilter && !m.roles.includes(roleFilter as never)) return false
    return true
  })

  return (
    <div className="gacks-page-container">
      {/* Page Header */}
      <div className="gacks-page-header">
        <div className="gacks-page-title-wrap">
          <div className="gacks-page-icon-badge">
            <span style={{ fontSize: '14px', color: '#00A3FF' }}>◎</span>
          </div>
          <div>
            <h1 className="gacks-page-title">MODEL HUB &amp; AI GATEWAY</h1>
            <p className="gacks-page-subtitle">
              LiteLLM Centralized AI Model Gateway &amp; Dynamic Multi-Provider Router
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCustomModalOpen(true)}
          className="gacks-btn-primary"
        >
          <span>+ Add Model / Provider</span>
        </button>
      </div>

      {/* Hero: Active Default Model Banner */}
      {defaultModel && (
        <div
          style={{
            marginBottom: '20px',
            padding: '18px 22px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(0, 163, 255, 0.08), rgba(24, 24, 26, 0.95))',
            border: '1px solid rgba(0, 163, 255, 0.25)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', color: '#00A3FF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              ● Active Default Model
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#EDEDEF', marginTop: '3px' }}>
              {defaultModel.displayName}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#A1A1A6', marginTop: '3px' }}>
              Provider: <span style={{ color: PROVIDER_COLORS[defaultModel.provider] || '#A1A1A6', fontWeight: 600 }}>{defaultModel.provider.toUpperCase()}</span> · Context: {(defaultModel.contextWindow / 1000).toFixed(0)}K · Priority: {defaultModel.priority ?? 5}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => handleTestModel(defaultModel.id)}
              disabled={testingModelId === defaultModel.id}
              className="gacks-btn-subtle"
            >
              <span>{testingModelId === defaultModel.id ? 'Testing…' : '⚡ Test Connection'}</span>
            </button>
            <button
              type="button"
              onClick={() => setConfigModalModel(defaultModel)}
              className="gacks-btn-subtle"
            >
              <span>⚙ Configure</span>
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px', overflowX: 'auto' }}>
        {(['catalog', 'local', 'hardware', 'telemetry', 'preferences'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px',
              background: tab === t ? 'rgba(0, 163, 255, 0.15)' : 'rgba(24, 24, 26, 0.6)',
              color: tab === t ? '#00A3FF' : '#A1A1A6',
              border: `1px solid ${tab === t ? 'rgba(0, 163, 255, 0.4)' : 'rgba(255, 255, 255, 0.05)'}`,
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: tab === t ? 700 : 500,
              borderRadius: '8px',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {t === 'catalog' ? '📦 Models Catalog' : t === 'local' ? '🖥 Local Models' : t === 'hardware' ? '⚙️ Hardware Profile' : t === 'telemetry' ? '📊 Telemetry' : '⚙ Routing Preferences'}
          </button>
        ))}
      </div>

      {/* CATALOG TAB */}
      {tab === 'catalog' && (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
            {(['all', 'cloud', 'local', 'litellm'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: `1px solid ${filter === f ? 'var(--gacks-cyan,#22d3ee)' : 'rgba(255,255,255,0.15)'}`,
                background: filter === f ? 'rgba(34,211,238,0.1)' : 'transparent',
                color: filter === f ? 'var(--gacks-cyan,#22d3ee)' : 'var(--gacks-text-muted,#94a3b8)',
                cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, textTransform: 'capitalize',
              }}>
                {f === 'all' ? '🌐 All' : f === 'cloud' ? '☁️ Cloud' : f === 'local' ? '🖥 Local' : '🌐 LiteLLM Gateway'}
              </button>
            ))}
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={{
              padding: '6px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)', color: 'var(--gacks-text,#e2e8f0)', fontSize: '0.8rem',
            }}>
              <option value=''>All Roles</option>
              {['GENERAL','FAST','REASONING','CODING','VISION','LOCAL','AGENT','RESEARCH'].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button onClick={loadModels} style={{ padding: '6px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--gacks-text-muted,#94a3b8)', cursor: 'pointer', fontSize: '0.8rem' }}>↻ Refresh</button>
          </div>

          {loading && <div style={{ color: 'var(--gacks-text-muted,#94a3b8)', padding: '40px', textAlign: 'center' }}>Loading models…</div>}

          {/* Model grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
            {filteredModels.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                online={isProviderOnline(model.provider)}
                onSelect={() => setSelectedModel(model === selectedModel ? null : model)}
                isSelected={selectedModel?.id === model.id}
                pinnedId={prefs?.preferredModelId}
                onPin={() => savePrefs({ preferredModelId: prefs?.preferredModelId === model.id ? undefined : model.id })}
                onTest={() => handleTestModel(model.id)}
                isTesting={testingModelId === model.id}
                testResult={testResults[model.id]}
                onConfigure={() => setConfigModalModel(model)}
                onToggleEnabled={(enabled) => handleUpdateModel(model.id, { enabled })}
              />
            ))}
          </div>

          {filteredModels.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--gacks-text-muted,#94a3b8)' }}>
              No models match your filter.
            </div>
          )}
        </div>
      )}

      {/* MODEL CONFIGURATION MODAL */}
      {configModalModel && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
        }}>
          <div style={{
            background: '#141416',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '14px',
            maxWidth: '520px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#EDEDEF', fontWeight: 700 }}>
                ⚙ Configure: {configModalModel.displayName}
              </h3>
              <button
                type="button"
                onClick={() => setConfigModalModel(null)}
                style={{ background: 'transparent', border: 'none', color: '#A1A1A6', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#A1A1A6', marginBottom: '4px' }}>
                  Model Priority (Higher is preferred in auto-routing)
                </label>
                <input
                  type="number"
                  defaultValue={configModalModel.priority ?? 5}
                  onChange={(e) => (configModalModel.priority = Number(e.target.value))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '8px', background: '#0D0E11', border: '1px solid rgba(255,255,255,0.1)', color: '#EDEDEF' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#A1A1A6', marginBottom: '4px' }}>
                  Fallback Order (1 = Primary, 2 = Secondary fallback, etc.)
                </label>
                <input
                  type="number"
                  defaultValue={configModalModel.fallbackOrder ?? 1}
                  onChange={(e) => (configModalModel.fallbackOrder = Number(e.target.value))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '8px', background: '#0D0E11', border: '1px solid rgba(255,255,255,0.1)', color: '#EDEDEF' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#A1A1A6', marginBottom: '4px' }}>
                  Temperature Override ({configModalModel.parameters?.temperature ?? configModalModel.defaultTemperature})
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="2"
                  defaultValue={configModalModel.parameters?.temperature ?? configModalModel.defaultTemperature}
                  onChange={(e) => {
                    configModalModel.parameters = {
                      ...(configModalModel.parameters || {}),
                      temperature: Number(e.target.value),
                    }
                  }}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '8px', background: '#0D0E11', border: '1px solid rgba(255,255,255,0.1)', color: '#EDEDEF' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#A1A1A6', marginBottom: '4px' }}>
                  Max Tokens Override
                </label>
                <input
                  type="number"
                  defaultValue={configModalModel.parameters?.maxTokens ?? configModalModel.defaultMaxTokens}
                  onChange={(e) => {
                    configModalModel.parameters = {
                      ...(configModalModel.parameters || {}),
                      maxTokens: Number(e.target.value),
                    }
                  }}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '8px', background: '#0D0E11', border: '1px solid rgba(255,255,255,0.1)', color: '#EDEDEF' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                <label style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer', fontSize: '0.85rem', color: '#EDEDEF' }}>
                  <input
                    type="checkbox"
                    defaultChecked={configModalModel.enabled !== false}
                    onChange={(e) => (configModalModel.enabled = e.target.checked)}
                  />
                  Enable Model for AI Dispatch
                </label>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setConfigModalModel(null)}
                    className="gacks-btn-subtle"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleUpdateModel(configModalModel.id, {
                        priority: configModalModel.priority,
                        fallbackOrder: configModalModel.fallbackOrder,
                        enabled: configModalModel.enabled,
                        parameters: configModalModel.parameters,
                      })
                      setConfigModalModel(null)
                    }}
                    className="gacks-btn-primary"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD CUSTOM MODEL MODAL */}
      {customModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
        }}>
          <div style={{
            background: '#141416',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '14px',
            maxWidth: '520px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#EDEDEF', fontWeight: 700 }}>
                + Register New Model / LiteLLM Proxy Deployment
              </h3>
              <button
                type="button"
                onClick={() => setCustomModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#A1A1A6', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#A1A1A6', marginBottom: '4px' }}>Model Identifier (Unique ID)</label>
                <input
                  value={customModelData.id}
                  onChange={(e) => setCustomModelData({ ...customModelData, id: e.target.value })}
                  placeholder="e.g. litellm:mistral-7b or custom:my-fine-tune"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '8px', background: '#0D0E11', border: '1px solid rgba(255,255,255,0.1)', color: '#EDEDEF' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#A1A1A6', marginBottom: '4px' }}>Display Name</label>
                <input
                  value={customModelData.displayName}
                  onChange={(e) => setCustomModelData({ ...customModelData, displayName: e.target.value })}
                  placeholder="e.g. Mistral 7B Instruct (Gateway)"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '8px', background: '#0D0E11', border: '1px solid rgba(255,255,255,0.1)', color: '#EDEDEF' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#A1A1A6', marginBottom: '4px' }}>Provider</label>
                  <select
                    value={customModelData.provider}
                    onChange={(e) => setCustomModelData({ ...customModelData, provider: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '8px', background: '#0D0E11', border: '1px solid rgba(255,255,255,0.1)', color: '#EDEDEF' }}
                  >
                    <option value="litellm">LiteLLM Gateway Proxy</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="groq">Groq</option>
                    <option value="ollama">Ollama</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#A1A1A6', marginBottom: '4px' }}>Backend Model Name</label>
                  <input
                    value={customModelData.modelName}
                    onChange={(e) => setCustomModelData({ ...customModelData, modelName: e.target.value })}
                    placeholder="e.g. mistral/mistral-tiny"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '8px', background: '#0D0E11', border: '1px solid rgba(255,255,255,0.1)', color: '#EDEDEF' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#A1A1A6', marginBottom: '4px' }}>Context Window (tokens)</label>
                  <input
                    type="number"
                    value={customModelData.contextWindow}
                    onChange={(e) => setCustomModelData({ ...customModelData, contextWindow: Number(e.target.value) })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '8px', background: '#0D0E11', border: '1px solid rgba(255,255,255,0.1)', color: '#EDEDEF' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#A1A1A6', marginBottom: '4px' }}>Cost / Million Tokens ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={customModelData.costPerMillion}
                    onChange={(e) => setCustomModelData({ ...customModelData, costPerMillion: Number(e.target.value) })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '8px', background: '#0D0E11', border: '1px solid rgba(255,255,255,0.1)', color: '#EDEDEF' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setCustomModalOpen(false)}
                  className="gacks-btn-subtle"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateCustom}
                  className="gacks-btn-primary"
                >
                  Register Model
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LOCAL TAB */}
      {tab === 'local' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Discovery */}
          <div style={cardStyle}>
            <h3 style={sectionTitle}>🔍 Discover Local Models</h3>
            <p style={{ color: 'var(--gacks-text-muted,#94a3b8)', fontSize: '0.875rem', margin: '0 0 16px' }}>
              Scans running Ollama and llama.cpp servers for installed models.
            </p>
            <button onClick={runDiscovery} disabled={discovering} style={primaryBtn}>
              {discovering ? 'Scanning…' : '🔍 Run Discovery'}
            </button>
            {discovery && (
              <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <StatusCard label='Ollama' reachable={discovery.ollama.reachable} count={discovery.ollama.registered} models={discovery.ollama.models} />
                <StatusCard label='llama.cpp' reachable={discovery.llamacpp.reachable} count={discovery.llamacpp.registered} models={discovery.llamacpp.models} />
              </div>
            )}
          </div>

          {/* Install (user-consent required) */}
          <div style={cardStyle}>
            <h3 style={sectionTitle}>📥 Install Local Model (Ollama)</h3>
            <p style={{ color: 'var(--gacks-text-muted,#94a3b8)', fontSize: '0.875rem', margin: '0 0 16px' }}>
              Enter an Ollama model name to pull. Installation requires your explicit consent. No model is ever installed automatically.
            </p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <input
                value={installModelId}
                onChange={(e) => setInstallModelId(e.target.value)}
                placeholder='e.g. llama3.2, deepseek-r1:7b, phi3'
                style={{ flex: 1, minWidth: '200px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--gacks-text,#e2e8f0)', fontSize: '0.875rem' }}
              />
            </div>
            <label style={{ display: 'flex', gap: '10px', alignItems: 'center', cursor: 'pointer', fontSize: '0.875rem', marginBottom: '12px', color: 'var(--gacks-text,#e2e8f0)' }}>
              <input type='checkbox' checked={installConsent} onChange={(e) => setInstallConsent(e.target.checked)} />
              I understand this will download model weights to my local device via Ollama
            </label>
            <button
              onClick={handleInstall}
              disabled={!installConsent || !installModelId.trim()}
              style={{ ...primaryBtn, opacity: (!installConsent || !installModelId.trim()) ? 0.4 : 1 }}
            >
              📥 Install Model
            </button>
            {installStatus && (
              <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', fontSize: '0.875rem', color: 'var(--gacks-text,#e2e8f0)' }}>
                {installStatus}
              </div>
            )}
          </div>
        </div>
      )}

      {/* HARDWARE TAB */}
      {tab === 'hardware' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {!hardware ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--gacks-text-muted,#94a3b8)' }}>Loading hardware profile…</div>
          ) : (
            <>
              <div style={cardStyle}>
                <h3 style={sectionTitle}>⚙️ Hardware Profile</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  <Metric label='Total RAM' value={`${hardware.profile.totalRamGb.toFixed(1)} GB`} />
                  <Metric label='Available RAM' value={`${hardware.profile.availableRamGb.toFixed(1)} GB`} />
                  <Metric label='GPU VRAM' value={hardware.profile.hasGpu ? `${hardware.profile.gpuVramGb.toFixed(1)} GB` : 'No GPU'} />
                  <Metric label='CPU Cores' value={String(hardware.profile.cpuCores)} />
                  <Metric label='CPU' value={hardware.profile.cpuModel} small />
                  <Metric label='Max Model Size' value={`~${hardware.profile.recommendedMaxModelSizeGb.toFixed(1)} GB`} />
                </div>
                {hardware.cloudFallbackAdvised && (
                  <div style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24', fontSize: '0.875rem' }}>
                    ⚠️ This system has limited RAM for local models. Cloud providers are recommended.
                  </div>
                )}
              </div>

              <div style={cardStyle}>
                <h3 style={sectionTitle}>💡 Model Recommendations</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {hardware.recommendations.slice(0, 8).map((rec) => (
                    <div key={rec.model.id} style={{ display: 'flex', gap: '12px', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${rec.canRun ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                      <div style={{ fontSize: '1.2rem' }}>{rec.canRun ? '✅' : '❌'}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{rec.model.displayName}</div>
                        <div style={{ color: 'var(--gacks-text-muted,#94a3b8)', fontSize: '0.75rem', marginTop: '2px' }}>{rec.reason}</div>
                      </div>
                      <div style={{ color: 'var(--gacks-cyan,#22d3ee)', fontSize: '0.75rem', fontWeight: 700 }}>{rec.fitScore}/100</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* PREFERENCES TAB */}
      {tab === 'preferences' && prefs && (
        <div style={cardStyle}>
          <h3 style={sectionTitle}>⚙ AI Routing Preferences</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <PreferenceRow
              label='Routing Mode'
              description='Controls which providers the AI may use'
              value={prefs.routingMode}
              options={[['AUTO','AUTO — Best available'],['LOCAL_ONLY','LOCAL_ONLY — Local models only'],['CLOUD_ONLY','CLOUD_ONLY — Cloud providers only'],['OFFLINE','OFFLINE — Offline mode']]}
              onChange={(v) => savePrefs({ routingMode: v as RoutingMode })}
            />
            <PreferenceRow
              label='Privacy Policy'
              description='How sensitive data may flow to providers'
              value={prefs.privacyPolicy}
              options={[['LOCAL_ONLY','LOCAL_ONLY — No data leaves device'],['HYBRID','HYBRID — Prefer local, allow cloud'],['CLOUD_ALLOWED','CLOUD_ALLOWED — Cloud providers permitted']]}
              onChange={(v) => savePrefs({ privacyPolicy: v as PrivacyPolicy })}
            />
            <div>
              <div style={{ fontWeight: 600, marginBottom: '4px', fontSize: '0.875rem' }}>Pinned Model</div>
              <div style={{ color: 'var(--gacks-text-muted,#94a3b8)', fontSize: '0.75rem', marginBottom: '8px' }}>Always use this specific model</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <code style={{ background: 'rgba(255,255,255,0.05)', padding: '6px 10px', borderRadius: '6px', fontSize: '0.8rem', flex: 1 }}>
                  {prefs.preferredModelId ?? '(none — auto-select)'}
                </code>
                {prefs.preferredModelId && (
                  <button onClick={() => savePrefs({ preferredModelId: undefined })} style={{ padding: '6px 12px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', cursor: 'pointer', fontSize: '0.8rem' }}>Clear</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'telemetry' && <TelemetryTab />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ModelCard({
  model,
  online,
  onSelect,
  isSelected,
  pinnedId,
  onPin,
  onTest,
  isTesting,
  testResult,
  onConfigure,
  onToggleEnabled,
}: {
  model: ModelDescriptor
  online: boolean
  onSelect: () => void
  isSelected: boolean
  pinnedId?: string
  onPin: () => void
  onTest: () => void
  isTesting?: boolean
  testResult?: { status: string; latencyMs: number; error?: string; sampleResponse?: string }
  onConfigure: () => void
  onToggleEnabled: (enabled: boolean) => void
}) {
  const providerColor = PROVIDER_COLORS[model.provider] ?? '#64748b'
  const providerIcon = PROVIDER_ICONS[model.provider] ?? '◇'
  const isPinned = pinnedId === model.id
  const isEnabled = model.enabled !== false

  return (
    <div
      onClick={onSelect}
      style={{
        borderRadius: '12px',
        border: `1px solid ${isSelected ? 'var(--gacks-cyan,#22d3ee)' : isPinned ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.08)'}`,
        background: isSelected ? 'rgba(34,211,238,0.05)' : isEnabled ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.01)',
        padding: '16px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative',
        opacity: isEnabled ? 1 : 0.6,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '1.1rem', color: providerColor }}>{providerIcon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--gacks-text,#e2e8f0)' }}>{model.displayName}</div>
            <div style={{ fontSize: '0.7rem', color: providerColor, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {model.provider} {model.custom && '· CUSTOM'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: !isEnabled ? '#64748b' : testResult?.status === 'ERROR' ? '#ef4444' : online ? '#22c55e' : '#eab308',
              display: 'inline-block',
              flexShrink: 0,
            }}
            title={!isEnabled ? 'Disabled' : online ? 'Available' : 'Degraded/Offline'}
          />
          {model.isLocal && (
            <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '10px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontWeight: 700, border: '1px solid rgba(34,197,94,0.2)' }}>
              LOCAL
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <p style={{ fontSize: '0.75rem', color: 'var(--gacks-text-muted,#94a3b8)', margin: '0 0 12px', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {model.description}
      </p>

      {/* Capabilities */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
        {model.capabilities.slice(0, 5).map((cap) => (
          <span key={cap} style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--gacks-text-muted,#94a3b8)' }}>
            {cap.replace(/_/g,' ')}
          </span>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '0.7rem', marginBottom: '12px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--gacks-text-muted,#94a3b8)' }}>Context</div>
          <div style={{ fontWeight: 700, color: 'var(--gacks-text,#e2e8f0)' }}>{(model.contextWindow / 1000).toFixed(0)}K</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--gacks-text-muted,#94a3b8)' }}>Cost/M</div>
          <div style={{ fontWeight: 700, color: model.costPerMillionTokens ? 'var(--gacks-text,#e2e8f0)' : '#22c55e' }}>
            {model.costPerMillionTokens ? `$${model.costPerMillionTokens}` : 'Free'}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--gacks-text-muted,#94a3b8)' }}>Priority</div>
          <div style={{ fontWeight: 700, color: 'var(--gacks-text,#e2e8f0)' }}>{model.priority ?? 5}</div>
        </div>
      </div>

      {/* Test Result Feedback if available */}
      {testResult && (
        <div style={{
          marginBottom: '10px',
          padding: '6px 10px',
          borderRadius: '6px',
          background: testResult.status === 'CONNECTED' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${testResult.status === 'CONNECTED' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          fontSize: '0.72rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ color: testResult.status === 'CONNECTED' ? '#22c55e' : '#f87171', fontWeight: 600 }}>
            {testResult.status === 'CONNECTED' ? `✓ Connected (${testResult.latencyMs}ms)` : `✗ ${testResult.status}: ${testResult.error?.slice(0, 30)}`}
          </span>
        </div>
      )}

      {/* Action Buttons: [Use], [Test], [Configure] */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
        <button
          onClick={(e) => { e.stopPropagation(); onPin() }}
          style={{
            flex: 2,
            padding: '6px 8px',
            borderRadius: '6px',
            background: isPinned ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${isPinned ? 'rgba(34,211,238,0.5)' : 'rgba(255,255,255,0.1)'}`,
            color: isPinned ? 'var(--gacks-cyan,#22d3ee)' : 'var(--gacks-text-muted,#94a3b8)',
            cursor: 'pointer',
            fontSize: '0.72rem',
            fontWeight: 700,
          }}
        >
          {isPinned ? '★ Default' : 'Use'}
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onTest() }}
          disabled={isTesting}
          style={{
            flex: 1.2,
            padding: '6px 8px',
            borderRadius: '6px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--gacks-text,#e2e8f0)',
            cursor: 'pointer',
            fontSize: '0.72rem',
            fontWeight: 600,
          }}
        >
          {isTesting ? '…' : '⚡ Test'}
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onConfigure() }}
          style={{
            flex: 1,
            padding: '6px 8px',
            borderRadius: '6px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--gacks-text,#e2e8f0)',
            cursor: 'pointer',
            fontSize: '0.72rem',
            fontWeight: 600,
          }}
        >
          ⚙
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onToggleEnabled(!isEnabled) }}
          style={{
            padding: '6px 8px',
            borderRadius: '6px',
            background: isEnabled ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${isEnabled ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: isEnabled ? '#22c55e' : '#f87171',
            cursor: 'pointer',
            fontSize: '0.72rem',
            fontWeight: 700,
          }}
          title={isEnabled ? 'Click to disable' : 'Click to enable'}
        >
          {isEnabled ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  )
}

function StatusCard({ label, reachable, count, models }: { label: string; reachable: boolean; count: number; models: string[] }) {
  return (
    <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${reachable ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: reachable ? '#22c55e' : '#ef4444', display: 'inline-block' }} />
        <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{label}</span>
        <span style={{ color: 'var(--gacks-text-muted,#94a3b8)', fontSize: '0.75rem' }}>{reachable ? 'Online' : 'Offline'}</span>
      </div>
      {reachable && (
        <>
          <div style={{ fontSize: '0.75rem', color: 'var(--gacks-text-muted,#94a3b8)', marginBottom: '6px' }}>{count} new model(s) registered</div>
          {models.slice(0,5).map((m) => <div key={m} style={{ fontSize: '0.7rem', color: '#22c55e', padding: '2px 0' }}>• {m}</div>)}
        </>
      )}
    </div>
  )
}

function Metric({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--gacks-text-muted,#94a3b8)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: small ? '0.75rem' : '1rem', color: 'var(--gacks-text,#e2e8f0)', wordBreak: 'break-word' }}>{value}</div>
    </div>
  )
}

function PreferenceRow({ label, description, value, options, onChange }: {
  label: string; description: string; value: string;
  options: [string, string][];
  onChange: (v: string) => void
}) {
  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: '4px', fontSize: '0.875rem' }}>{label}</div>
      <div style={{ color: 'var(--gacks-text-muted,#94a3b8)', fontSize: '0.75rem', marginBottom: '8px' }}>{description}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--gacks-text,#e2e8f0)', fontSize: '0.875rem', width: '100%' }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
}

function TelemetryTab() {
  const [data, setData] = useState<{ telemetry: Array<{ id: string; provider: string; model: string; latencyMs: number; success: boolean; isLocal?: boolean; error?: string }>; routerSummary: Record<string, unknown> } | null>(null)

  useEffect(() => {
    apiClient.getModelTelemetry(50).then((res) => { if (res.ok) setData(res.data ?? null) })
  }, [])

  if (!data) return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--gacks-text-muted,#94a3b8)' }}>Loading telemetry…</div>

  const summary = data.routerSummary as { totalCalls?: number; totalFailures?: number; totalTokens?: number; totalCostUsd?: number }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        <Metric label='Total Calls' value={String(summary.totalCalls ?? 0)} />
        <Metric label='Failures' value={String(summary.totalFailures ?? 0)} />
        <Metric label='Total Tokens' value={String(summary.totalTokens ?? 0)} />
        <Metric label='Est. Cost' value={`$${(summary.totalCostUsd ?? 0).toFixed(4)}`} />
      </div>
      <div style={cardStyle}>
        <h3 style={sectionTitle}>Recent Calls</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {data.telemetry.slice(0,20).map((t) => (
            <div key={t.id} style={{ display: 'flex', gap: '10px', padding: '8px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', fontSize: '0.75rem', alignItems: 'center' }}>
              <span style={{ color: t.success ? '#22c55e' : '#f87171', fontWeight: 700 }}>{t.success ? '✓' : '✗'}</span>
              <span style={{ color: 'var(--gacks-cyan,#22d3ee)', fontWeight: 600, minWidth: '80px' }}>{t.provider}</span>
              <span style={{ color: 'var(--gacks-text-muted,#94a3b8)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.model}</span>
              <span style={{ color: 'var(--gacks-text-muted,#94a3b8)', minWidth: '60px', textAlign: 'right' }}>{t.latencyMs}ms</span>
              {t.isLocal && <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '8px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>LOCAL</span>}
            </div>
          ))}
          {data.telemetry.length === 0 && <div style={{ color: 'var(--gacks-text-muted,#94a3b8)', padding: '20px', textAlign: 'center' }}>No telemetry recorded yet. Send a message to GACKS to see activity.</div>}
        </div>
      </div>
    </div>
  )
}

// Shared styles
const cardStyle: React.CSSProperties = {
  padding: '20px',
  borderRadius: '12px',
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.08)',
}

const sectionTitle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 700,
  color: 'var(--gacks-cyan,#22d3ee)',
  margin: '0 0 16px',
}

const primaryBtn: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: '8px',
  background: 'linear-gradient(135deg, var(--gacks-cyan,#22d3ee), #3b82f6)',
  border: 'none',
  color: '#0f172a',
  fontWeight: 700,
  fontSize: '0.875rem',
  cursor: 'pointer',
}

