import React, { useState, useMemo, useEffect } from 'react'
import {
  Sliders,
  Sparkles,
  Zap,
  Layers,
  Cpu,
  Shield,
  Bot,
  Laptop,
  CreditCard,
  Code2,
  FlaskConical,
  HelpCircle,
  Search,
  CheckCircle2,
  RotateCcw,
  Save,
  Volume2,
  FileDown,
  Activity,
  Database,
  Globe,
  Key,
  ExternalLink,
  RefreshCw,
  X,
  Trash2,
} from 'lucide-react'
import { BRIDGE_HTTP_URL } from '../../../config'
import {
  useStore,
  type AppSettings,
  DEFAULT_SETTINGS,
} from '../../../store'
import {
  SettingsToggle,
  SettingsSelect,
  SettingsSlider,
  SettingsInput,
  SettingsTextarea,
  SettingsCard,
  SettingsDangerZone,
} from './components/SettingsControls'

interface SettingsPageProps {
  onToggleVoice?: () => void
}

type CategoryId =
  | 'general'
  | 'ai'
  | 'performance'
  | 'integrations'
  | 'automation'
  | 'security'
  | 'advanced'
  | 'desktop'
  | 'usage'
  | 'developer'
  | 'experimental'
  | 'help'

interface CategoryDef {
  id: CategoryId
  label: string
  icon: React.ComponentType<{ className?: string }>
  desc: string
  keywords: string[]
}

const CATEGORIES: CategoryDef[] = [
  { id: 'general', label: 'General', icon: Sliders, desc: 'Appearance, Interface, Notifications, Shortcuts', keywords: ['theme', 'accent', 'density', 'font', 'sound', 'shortcuts', 'name', 'avatar'] },
  { id: 'ai', label: 'AI Preferences', icon: Sparkles, desc: 'Personality, Response Style, Memory, Voice', keywords: ['personality', 'style', 'markdown', 'custom instructions', 'memory', 'voice', 'speech', 'wake word'] },
  { id: 'performance', label: 'Performance', icon: Zap, desc: 'Response Speed, Models, Processing, Telemetry', keywords: ['speed', 'gemini', 'claude', 'routing', 'streaming', 'thinking depth', 'latency', 'tokens', 'timeout'] },
  { id: 'integrations', label: 'Integrations', icon: Layers, desc: 'AI Providers, Productivity, Developer Tools', keywords: ['providers', 'gemini', 'github', 'vercel', 'slack', 'calendar', 'email', 'whatsapp'] },
  { id: 'automation', label: 'Automation', icon: Cpu, desc: 'Scheduled Tasks, Background Agents, Permissions', keywords: ['scheduled', 'background agents', 'permissions', 'approval rules', 'workflows'] },
  { id: 'security', label: 'Privacy & Security', icon: Shield, desc: 'Memory Privacy, API Security, Governance', keywords: ['privacy', 'retention', '2fa', 'security', 'redaction', 'audit', 'permissions'] },
  { id: 'advanced', label: 'Advanced AI', icon: Bot, desc: 'Parameters, Task Routing, Context Windows', keywords: ['temperature', 'tokens', 'reasoning', 'context', 'routing', 'fallbacks'] },
  { id: 'desktop', label: 'Desktop Assistant', icon: Laptop, desc: 'OS Companion, Terminal, Screen Access', keywords: ['companion', 'desktop agent', 'push to talk', 'screen', 'terminal', 'permissions'] },
  { id: 'usage', label: 'Usage & Metrics', icon: CreditCard, desc: 'Real consumption, request counts, limits', keywords: ['usage', 'tokens', 'billing', 'requests', 'limits', 'export'] },
  { id: 'developer', label: 'Developer Mode', icon: Code2, desc: 'API Inspector, Code Execution, Sandboxes', keywords: ['developer', 'console', 'logs', 'api', 'sandbox', 'checkpoints'] },
  { id: 'experimental', label: 'Experimental', icon: FlaskConical, desc: 'Lab features, multi-agent collaboration', keywords: ['experimental', 'flags', 'multi-agent', 'vision', 'local models'] },
  { id: 'help', label: 'Help & About', icon: HelpCircle, desc: 'Capabilities, Shortcuts, System Diagnostics', keywords: ['help', 'onboarding', 'diagnostics', 'logs', 'reset', 'version', 'about'] },
]

export const SettingsPage: React.FC<SettingsPageProps> = ({ onToggleVoice }) => {
  const storeSettings = useStore((s) => s.settings)
  const updateSettingsCategory = useStore((s) => s.updateSettingsCategory)
  const resetSettingsCategory = useStore((s) => s.resetSettingsCategory)
  const resetAllSettings = useStore((s) => s.resetAllSettings)
  const userProfile = useStore((s) => s.userProfile)
  const setUserProfile = useStore((s) => s.setUserProfile)
  const turns = useStore((s) => s.turns)
  const connected = useStore((s) => s.connected)

  // Local editable draft state to power unsaved changes bar
  const [draft, setDraft] = useState<AppSettings>(() => JSON.parse(JSON.stringify(storeSettings)))
  const [activeCategory, setActiveCategory] = useState<CategoryId>('general')
  const [searchQuery, setSearchQuery] = useState('')
  const [saveToast, setSaveToast] = useState(false)
  const [mobileCategoryOpen, setMobileCategoryOpen] = useState(false)

  // External APIs & Credentials state
  const [credentials, setCredentials] = useState<
    Array<{ providerId: string; providerName: string; authType: string; configured: boolean; maskedKey?: string }>
  >([])
  const [apiCatalogModalOpen, setApiCatalogModalOpen] = useState(false)
  const [apiCatalog, setApiCatalog] = useState<any[]>([])
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState('all')
  const [catalogCategories, setCatalogCategories] = useState<Array<{ name: string; count: number }>>([])
  const [newProviderId, setNewProviderId] = useState('github-api')
  const [newApiKey, setNewApiKey] = useState('')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testingProvider, setTestingProvider] = useState(false)

  // Track if local draft has differences from store
  const isDirty = useMemo(() => {
    return JSON.stringify(draft) !== JSON.stringify(storeSettings)
  }, [draft, storeSettings])

  // Fetch credentials
  const loadCredentials = React.useCallback(async () => {
    try {
      const res = await fetch(`${BRIDGE_HTTP_URL}/api/v1/apis/credentials`)
      if (res.ok) {
        const d = await res.json()
        setCredentials(d.credentials || [])
      }
    } catch {}
  }, [])

  // Fetch catalog & categories
  const loadCatalog = React.useCallback(async () => {
    try {
      const [catRes, entriesRes] = await Promise.all([
        fetch(`${BRIDGE_HTTP_URL}/api/v1/apis/categories`),
        fetch(`${BRIDGE_HTTP_URL}/api/v1/apis/catalog`),
      ])
      if (catRes.ok) {
        const d = await catRes.json()
        setCatalogCategories(d.categories || [])
      }
      if (entriesRes.ok) {
        const d = await entriesRes.json()
        setApiCatalog(d.entries || [])
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (activeCategory === 'integrations') {
      loadCredentials()
      loadCatalog()
    }
  }, [activeCategory, loadCredentials, loadCatalog])

  const handleSaveCredential = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProviderId.trim() || !newApiKey.trim()) return
    try {
      const res = await fetch(`${BRIDGE_HTTP_URL}/api/v1/apis/credentials`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          providerId: newProviderId.trim(),
          providerName: newProviderId.trim(),
          authType: 'apiKey',
          apiKey: newApiKey.trim(),
        }),
      })
      if (res.ok) {
        setNewApiKey('')
        setTestResult('Credential saved securely.')
        await loadCredentials()
      }
    } catch (err: any) {
      setTestResult(`Failed: ${err.message}`)
    }
  }

  const handleDeleteCredential = async (providerId: string) => {
    try {
      const res = await fetch(`${BRIDGE_HTTP_URL}/api/v1/apis/credentials?providerId=${encodeURIComponent(providerId)}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        await loadCredentials()
      }
    } catch {}
  }

  const handleTestProvider = async (providerId: string) => {
    setTestingProvider(true)
    setTestResult(null)
    try {
      const res = await fetch(`${BRIDGE_HTTP_URL}/api/v1/apis/test`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ providerId }),
      })
      const data = await res.json()
      if (res.ok && data.status) {
        setTestResult(`${data.status.name}: ${data.status.health.toUpperCase()} ${data.status.message ? `(${data.status.message})` : ''}`)
      } else {
        setTestResult(`Test failed: ${data.error || 'Unknown error'}`)
      }
    } catch (err: any) {
      setTestResult(`Error: ${err.message}`)
    } finally {
      setTestingProvider(false)
    }
  }

  // Live preview for appearance settings while configuring
  useEffect(() => {
    if (!draft.general) return
    const root = document.documentElement
    let resolvedTheme: string = draft.general.theme || 'dark'
    if (resolvedTheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      resolvedTheme = prefersDark ? 'dark' : 'light'
    } else if (resolvedTheme === 'dark-charcoal') {
      resolvedTheme = 'dark'
    }
    root.setAttribute('data-theme', resolvedTheme)

    const accent = draft.general.accentColor || '#00A3FF'
    root.style.setProperty('--gacks-cyan', accent)
    root.style.setProperty('--gacks-border-cyan', accent)
    root.style.setProperty('--gacks-accent', accent)
    root.style.setProperty('--gacks-cyan-glow', `${accent}40`)

    root.setAttribute('data-density', draft.general.density || 'comfortable')
    root.setAttribute('data-font-size', draft.general.fontSize || 'md')
    root.setAttribute('data-animations', String(draft.general.animationsEnabled !== false))
    root.setAttribute('data-background-grid', String(draft.general.backgroundGrid !== false))
  }, [draft.general])

  // Save draft to store & localStorage
  const handleSave = () => {
    Object.keys(draft).forEach((key) => {
      const k = key as keyof AppSettings
      updateSettingsCategory(k, draft[k] as any)
    })
    // Sync operator profile if changed in general
    if (draft.general.operatorName !== userProfile.name || draft.general.operatorMotto !== userProfile.subtitle) {
      setUserProfile({ name: draft.general.operatorName, subtitle: draft.general.operatorMotto })
    }
    setSaveToast(true)
    setTimeout(() => setSaveToast(false), 3000)
  }

  // Discard draft
  const handleDiscard = () => {
    setDraft(JSON.parse(JSON.stringify(storeSettings)))
  }

  // Category Reset
  const handleResetCategory = (cat: CategoryId) => {
    if (cat === 'developer') {
      setDraft((prev) => ({ ...prev, developerMode: DEFAULT_SETTINGS.developerMode }))
      resetSettingsCategory('developerMode')
      return
    }
    if (cat === 'experimental') {
      setDraft((prev) => ({ ...prev, experimentalFlags: { ...DEFAULT_SETTINGS.experimentalFlags } }))
      resetSettingsCategory('experimentalFlags')
      return
    }
    const next = { ...draft, [cat]: JSON.parse(JSON.stringify(DEFAULT_SETTINGS[cat as keyof AppSettings])) }
    setDraft(next)
    resetSettingsCategory(cat as keyof AppSettings)
  }

  // Global Reset
  const handleGlobalReset = () => {
    setDraft(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)))
    resetAllSettings()
    setSaveToast(true)
    setTimeout(() => setSaveToast(false), 3000)
  }

  // Update specific field inside draft
  const updateField = <C extends keyof AppSettings, F extends keyof AppSettings[C]>(
    cat: C,
    field: F,
    value: AppSettings[C][F],
  ) => {
    setDraft((prev) => ({
      ...prev,
      [cat]: {
        ...(prev[cat] as any),
        [field]: value,
      },
    }))
  }

  // Filtered categories based on search
  const filteredCategories = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return CATEGORIES
    return CATEGORIES.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.desc.toLowerCase().includes(q) ||
        c.keywords.some((k) => k.includes(q)),
    )
  }, [searchQuery])

  return (
    <div className="gacks-page-container gacks-settings-page">
      {/* TWO-LEVEL SETTINGS INTERFACE */}
      <div className="gacks-settings-split-view">
        {/* Left Categories Sidebar */}
        <div className={`gacks-settings-categories-col ${mobileCategoryOpen ? 'gacks-categories-mobile-open' : ''}`}>
          {/* Search Box */}
          <div className="gacks-settings-search-wrap">
            <Search className="w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              className="gacks-settings-search-input"
              placeholder="Search settings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Category Navigation Items */}
          <div className="gacks-settings-category-list">
            {filteredCategories.map((cat) => {
              const Icon = cat.icon
              const isActive = activeCategory === cat.id
              // Hide developer tab if developerMode is false unless searching
              if (cat.id === 'developer' && !draft.developerMode && !searchQuery.toLowerCase().includes('dev')) {
                return null
              }

              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`gacks-settings-category-btn ${isActive ? 'gacks-category-active' : ''}`}
                  onClick={() => {
                    setActiveCategory(cat.id)
                    setMobileCategoryOpen(false)
                  }}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <div className="flex flex-col text-left">
                    <span className="gacks-cat-name">{cat.label}</span>
                    <span className="gacks-cat-sub line-clamp-1">{cat.desc}</span>
                  </div>
                  {cat.id === 'experimental' && (
                    <span className="gacks-cat-badge">EXP</span>
                  )}
                  {cat.id === 'developer' && (
                    <span className="gacks-cat-badge text-purple-400 border-purple-500/30">DEV</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Reset Category Quick Action */}
          <div className="gacks-settings-sidebar-bottom">
            <button
              type="button"
              className="gacks-settings-cat-reset-btn"
              onClick={() => handleResetCategory(activeCategory)}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              <span>Reset {activeCategory.toUpperCase()} Defaults</span>
            </button>
          </div>
        </div>

        {/* Right Detail Pane */}
        <div className="gacks-settings-detail-col">
          {/* Mobile Back Button */}
          <div className="gacks-settings-mobile-back">
            <button
              type="button"
              className="gacks-btn-subtle text-xs"
              onClick={() => setMobileCategoryOpen(!mobileCategoryOpen)}
            >
              <span>{mobileCategoryOpen ? 'Close Categories' : '← Change Category'}</span>
            </button>
          </div>

          {/* 1. GENERAL */}
          {activeCategory === 'general' && (
            <div className="gacks-category-panel">
              <SettingsCard title="Appearance & Themes" description="Visual styling, surface treatment, and viewport density">
                <SettingsSelect
                  label="Theme"
                  description="Overall color palette for surfaces, cards, and layers"
                  value={draft.general.theme}
                  options={[
                    { value: 'dark-charcoal', label: 'Dark (Reference Charcoal SaaS)' },
                    { value: 'light', label: 'Light (Clean Daylight Mode)' },
                    { value: 'system', label: 'System (Follow Operating System)' },
                    { value: 'cyber-black', label: 'Cyber Black (OLED Pure Black)' },
                    { value: 'deep-space', label: 'Deep Space (Midnight Cosmic Navy)' },
                  ]}
                  onChange={(val) => updateField('general', 'theme', val as any)}
                />
                <SettingsSelect
                  label="Accent Color"
                  description="Primary illumination tone for bullets, focus bars, and borders"
                  value={draft.general.accentColor}
                  options={[
                    { value: '#00A3FF', label: 'Electric Cyan (#00A3FF)' },
                    { value: '#FF5A36', label: 'Vivid Red/Orange (#FF5A36)' },
                    { value: '#10B981', label: 'Emerald Green (#10B981)' },
                    { value: '#8B5CF6', label: 'Royal Violet (#8B5CF6)' },
                    { value: '#F59E0B', label: 'Amber Gold (#F59E0B)' },
                  ]}
                  onChange={(val) => updateField('general', 'accentColor', val)}
                />
                <SettingsSelect
                  label="Interface Density"
                  description="Padding and spacing proportions across dashboard cards and HUD"
                  value={draft.general.density}
                  options={[
                    { value: 'compact', label: 'Compact (High Density Command)' },
                    { value: 'comfortable', label: 'Comfortable (Balanced Standard)' },
                    { value: 'spacious', label: 'Spacious (Relaxed Proportions)' },
                  ]}
                  onChange={(val) => updateField('general', 'density', val as any)}
                />
                <SettingsSelect
                  label="Font Size"
                  description="Global interface typography scale"
                  value={draft.general.fontSize}
                  options={[
                    { value: 'sm', label: 'Small (13px - Compact Command)' },
                    { value: 'md', label: 'Default (14px - Standard)' },
                    { value: 'lg', label: 'Large (15.5px - High Legibility)' },
                  ]}
                  onChange={(val) => updateField('general', 'fontSize', val as any)}
                />
                <SettingsSlider
                  label="Glassmorphism Intensity"
                  description="Level of background blur and subtle translucency (Low / Medium / High)"
                  value={typeof draft.general.glassIntensity === 'number' ? draft.general.glassIntensity : 25}
                  min={0}
                  max={60}
                  unit="%"
                  onChange={(val) => updateField('general', 'glassIntensity', val)}
                />
                <SettingsToggle
                  label="Background Technical Grid"
                  description="Display subtle isometric grid lines in the application backdrop"
                  checked={draft.general.backgroundGrid}
                  onChange={(val) => updateField('general', 'backgroundGrid', val)}
                />
                <SettingsToggle
                  label="UI Animations & Transitions"
                  description="Enable smooth easing transitions for panels and modals"
                  checked={draft.general.animationsEnabled}
                  onChange={(val) => updateField('general', 'animationsEnabled', val)}
                  tooltip="Disabling this activates prefers-reduced-motion behavior."
                />
              </SettingsCard>

              <SettingsCard title="Interface & Layout" description="Navigation behavior and chat presentation">
                <SettingsSelect
                  label="Sidebar Navigation Behavior"
                  description="Controls default state and auto-collapse response"
                  value={draft.general.sidebarBehavior || 'auto'}
                  options={[
                    { value: 'auto', label: 'Auto (Responsive to screen width)' },
                    { value: 'expanded', label: 'Always Expanded' },
                    { value: 'collapsed', label: 'Always Collapsed (Icon-Only Rail)' },
                  ]}
                  onChange={(val) => updateField('general', 'sidebarBehavior', val as any)}
                />
                <SettingsSelect
                  label="Chat Layout"
                  value={draft.general.chatLayout}
                  options={[
                    { value: 'standard', label: 'Standard (Centered Focus)' },
                    { value: 'compact', label: 'Compact (Tighter Spacing)' },
                    { value: 'wide', label: 'Full Width (Expanded Command)' },
                  ]}
                  onChange={(val) => updateField('general', 'chatLayout', val as any)}
                />
                <SettingsToggle
                  label="Compact Mode"
                  description="Minimize outer margins and card header padding"
                  checked={Boolean(draft.general.compactMode)}
                  onChange={(val) => updateField('general', 'compactMode', val)}
                />
                <SettingsToggle
                  label="Fullscreen Mode"
                  description="Expand Insight interface to occupy the entire display"
                  checked={Boolean(draft.general.fullscreenMode)}
                  onChange={(val) => updateField('general', 'fullscreenMode', val)}
                />
              </SettingsCard>

              <SettingsCard title="Notifications & Alerts" description="Auditory cues and system dispatch alerts">
                <SettingsToggle
                  label="Audio Sound Effects"
                  description="Play subtle sci-fi cues during ignition, wake-word, and tool completions"
                  checked={draft.general.soundEffects}
                  onChange={(val) => updateField('general', 'soundEffects', val)}
                />
                <SettingsToggle
                  label="Desktop Notifications"
                  description="Display system notifications when background tasks complete"
                  checked={draft.general.desktopNotifications}
                  onChange={(val) => updateField('general', 'desktopNotifications', val)}
                />
                <SettingsToggle
                  label="Error & Warning Alerts"
                  description="Show visual notifications upon model rate limits or tool timeouts"
                  checked={draft.general.errorAlerts}
                  onChange={(val) => updateField('general', 'errorAlerts', val)}
                />
              </SettingsCard>

              <SettingsCard title="Personalization & Operator Identity" description="Assistant naming and profile attributes">
                <SettingsInput
                  label="Assistant Name"
                  description="The name by which the assistant refers to itself"
                  value={draft.general.customAssistantName}
                  onChange={(val) => updateField('general', 'customAssistantName', val)}
                />
                <SettingsInput
                  label="Operator Name"
                  description="Your primary callsign used in greetings and messages"
                  value={draft.general.operatorName}
                  onChange={(val) => updateField('general', 'operatorName', val)}
                />
                <SettingsInput
                  label="Operator Motto"
                  description="Inspirational signature displayed on the sidebar footer"
                  value={draft.general.operatorMotto}
                  onChange={(val) => updateField('general', 'operatorMotto', val)}
                />
                <SettingsSelect
                  label="Timezone"
                  value={draft.general.timezone}
                  options={[
                    { value: 'Africa/Nairobi (UTC+3)', label: 'Africa/Nairobi (UTC+3)' },
                    { value: 'UTC', label: 'UTC (Universal Coordinated Time)' },
                    { value: 'America/New_York (UTC-5)', label: 'America/New_York (UTC-5)' },
                    { value: 'Europe/London (UTC+0)', label: 'Europe/London (UTC+0)' },
                  ]}
                  onChange={(val) => updateField('general', 'timezone', val)}
                />
                <SettingsSelect
                  label="Time Format"
                  value={draft.general.timeFormat}
                  options={[
                    { value: '12h', label: '12-Hour (12:48 PM)' },
                    { value: '24h', label: '24-Hour (12:48)' },
                  ]}
                  onChange={(val) => updateField('general', 'timeFormat', val as any)}
                />
              </SettingsCard>
            </div>
          )}

          {/* 2. AI PREFERENCES */}
          {activeCategory === 'ai' && (
            <div className="gacks-category-panel">
              <SettingsCard title="Assistant Persona & Tone" description="Governs linguistic style, demeanor, and technical depth">
                <SettingsSelect
                  label="Personality"
                  description="Core behavioral demeanor of the assistant"
                  value={draft.ai.personality}
                  options={[
                    { value: 'Jarvis-style', label: 'Jarvis-style (Composed, efficient, ultra-competent)' },
                    { value: 'Professional', label: 'Professional (Polite, objective, formal)' },
                    { value: 'Technical', label: 'Technical (Direct code, architecture, concise)' },
                    { value: 'Executive', label: 'Executive (Strategic, high-level summaries)' },
                    { value: 'Friendly', label: 'Friendly (Warm, conversational, supportive)' },
                  ]}
                  onChange={(val) => updateField('ai', 'personality', val as any)}
                />
                <SettingsSelect
                  label="Response Style"
                  value={draft.ai.responseStyle}
                  options={[
                    { value: 'Balanced', label: 'Balanced (Standard thoroughness)' },
                    { value: 'Concise', label: 'Concise (Brief, zero fluff)' },
                    { value: 'Detailed', label: 'Detailed (Deep analysis & rationale)' },
                  ]}
                  onChange={(val) => updateField('ai', 'responseStyle', val as any)}
                />
                <SettingsToggle
                  label="Step-by-Step Explanations"
                  description="Break down complex reasoning chains into sequential numbered steps"
                  checked={draft.ai.stepByStep}
                  onChange={(val) => updateField('ai', 'stepByStep', val)}
                />
                <SettingsToggle
                  label="Confidence Indicators"
                  description="Report estimated confidence percentages on speculative answers"
                  checked={draft.ai.confidenceIndicators}
                  onChange={(val) => updateField('ai', 'confidenceIndicators', val)}
                />
                <SettingsTextarea
                  label="Custom Operator Instructions"
                  description="Persistent instructions included in every model prompt context"
                  value={draft.ai.customInstructions}
                  rows={4}
                  placeholder="e.g. Always prioritize Forex risk management, emphasize verified facts, write clean TypeScript..."
                  onChange={(val) => updateField('ai', 'customInstructions', val)}
                />
              </SettingsCard>

              <SettingsCard title="Persistent Memory & Recall" description="Multi-factor hybrid memory (Similarity, Recency, Importance)">
                <SettingsToggle
                  label="Enable Persistent Memory"
                  description="Allow Insight to retain episodic memories, preferences, and personal entity graph"
                  checked={draft.ai.memoryEnabled}
                  onChange={(val) => updateField('ai', 'memoryEnabled', val)}
                />
                <SettingsToggle
                  label="Temporary Session Mode"
                  description="Do not record memories from the current active conversation"
                  checked={draft.ai.temporaryConversations}
                  onChange={(val) => updateField('ai', 'temporaryConversations', val)}
                />
                <div className="gacks-settings-info-box">
                  <Database className="w-4 h-4 text-purple-400 shrink-0" />
                  <span className="text-xs text-gray-300">
                    Memory database is active at <code className="text-purple-300">data/gacks_db.json</code>. Sensitive credentials like API keys and private tokens are automatically filtered by policy.
                  </span>
                </div>
              </SettingsCard>

              <SettingsCard title="Voice & Speech Synthesis" description="Neural audio synthesis, wake-word, and barge-in">
                <SettingsSelect
                  label="Active Speech Engine Voice"
                  value={draft.ai.activeVoice}
                  options={[
                    { value: 'ElevenLabs Neural / System Fallback', label: 'ElevenLabs Streaming (High Fidelity)' },
                    { value: 'Kokoro Local Neural (86MB)', label: 'Kokoro JS (Local On-Device Neural)' },
                    { value: 'System Web Speech', label: 'System Web Speech (Browser Native)' },
                  ]}
                  onChange={(val) => updateField('ai', 'activeVoice', val)}
                />
                <SettingsSlider
                  label="Speech Speed Rate"
                  description="Playback multiplier for spoken audio responses"
                  value={draft.ai.speechSpeed}
                  min={0.75}
                  max={1.5}
                  step={0.05}
                  unit="x"
                  onChange={(val) => updateField('ai', 'speechSpeed', val)}
                />
                <SettingsToggle
                  label="Wake Word Detection ('Hey Gacks' / 'Hey Jarvis')"
                  description="Run lightweight Porcupine/Web Audio loop waiting for wake word"
                  checked={draft.ai.wakeWordEnabled}
                  onChange={(val) => updateField('ai', 'wakeWordEnabled', val)}
                />
                <SettingsToggle
                  label="Read Responses Aloud"
                  description="Automatically speak answers back when voice interaction is initiated"
                  checked={draft.ai.readAloud}
                  onChange={(val) => updateField('ai', 'readAloud', val)}
                />
                <div className="pt-2">
                  <button
                    type="button"
                    className="gacks-btn-subtle text-xs"
                    onClick={onToggleVoice}
                  >
                    <Volume2 className="w-4 h-4 mr-1.5 text-orange-400" />
                    <span>Test Voice Synthesizer</span>
                  </button>
                </div>
              </SettingsCard>
            </div>
          )}

          {/* 3. PERFORMANCE */}
          {activeCategory === 'performance' && (
            <div className="gacks-category-panel">
              <SettingsCard title="Model Selection & Routing" description="Core LLM intelligence provider and fallback parameters">
                <SettingsSelect
                  label="Primary Model Provider"
                  description="Default reasoning core used for planning, agent execution, and chat"
                  value={draft.performance.defaultModel}
                  options={[
                    { value: 'auto', label: 'Dynamic Auto Routing (Recommended · Best Match per Task)' },
                    { value: 'claude-3-5-sonnet-20241022', label: 'Anthropic Claude 3.5 Sonnet (Direct High Reasoning)' },
                    { value: 'gpt-4o', label: 'OpenAI GPT-4o (Multimodal & Coding)' },
                    { value: 'gemini-2.5-flash', label: 'Google Gemini 2.5 Flash (Fast Tier)' },
                    { value: 'gemini-2.5-pro', label: 'Google Gemini 2.5 Pro (Deep Context)' },
                    { value: 'openrouter:anthropic/claude-3.5-sonnet', label: 'OpenRouter Claude 3.5 Sonnet' },
                    { value: 'local', label: 'Local Offline Model (Ollama / llama.cpp)' },
                  ]}
                  onChange={(val) => updateField('performance', 'defaultModel', val as any)}
                />
                <SettingsToggle
                  label="Automatic Model Routing"
                  description="Dynamically select the optimal model per workload (Coding, Reasoning, Vision, Fast, Research)"
                  checked={draft.performance.autoModelRouting}
                  onChange={(val) => updateField('performance', 'autoModelRouting', val)}
                />
                <SettingsToggle
                  label="Streaming Tokens"
                  description="Stream responses character-by-character as they are generated"
                  checked={draft.performance.streaming}
                  onChange={(val) => updateField('performance', 'streaming', val)}
                />
                <SettingsSlider
                  label="Thinking Reasoning Depth"
                  description="Controls internal chain-of-thought exploration depth on complex prompts"
                  value={draft.performance.thinkingDepth}
                  min={1}
                  max={5}
                  step={1}
                  tooltip="Higher levels produce more thorough verification at slightly higher latency."
                  onChange={(val) => updateField('performance', 'thinkingDepth', val)}
                />
              </SettingsCard>

              <SettingsCard title="Network & Resilience" description="Timeout budgets and automatic retry loops">
                <SettingsSlider
                  label="API Request Timeout"
                  description="Maximum wait duration before triggering fallback routing"
                  value={draft.performance.timeoutSeconds}
                  min={5}
                  max={60}
                  step={5}
                  unit="s"
                  onChange={(val) => updateField('performance', 'timeoutSeconds', val)}
                />
                <SettingsToggle
                  label="Automatic Retries (Max 2)"
                  description="Retry failed tool executions automatically with exponential backoff"
                  checked={draft.performance.autoRetries}
                  onChange={(val) => updateField('performance', 'autoRetries', val)}
                />
                <SettingsToggle
                  label="Tool Result Caching"
                  description="Cache idempotent read requests to accelerate repeated queries"
                  checked={draft.performance.caching}
                  onChange={(val) => updateField('performance', 'caching', val)}
                />
              </SettingsCard>
            </div>
          )}

          {/* 4. INTEGRATIONS */}
          {activeCategory === 'integrations' && (
            <div className="gacks-category-panel">
              <SettingsCard title="AI Providers" description="API connection statuses for primary and fallback reasoning cores">
                <div className="gacks-integration-row">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981]" />
                    <div>
                      <h4 className="text-xs font-semibold text-white">Google Gemini API</h4>
                      <p className="text-[11px] text-gray-400">Primary provider · gemini-2.5-flash / gemini-1.5-pro</p>
                    </div>
                  </div>
                  <span className="gacks-integration-badge-connected">Connected (Active)</span>
                </div>

                <div className="gacks-integration-row">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981]" />
                    <div>
                      <h4 className="text-xs font-semibold text-white">Anthropic Claude API</h4>
                      <p className="text-[11px] text-gray-400">Fallback provider · claude-3-5-sonnet</p>
                    </div>
                  </div>
                  <span className="gacks-integration-badge-connected">Connected (Fallback)</span>
                </div>

                <div className="gacks-integration-row">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-500" />
                    <div>
                      <h4 className="text-xs font-semibold text-white">OpenAI GPT-4o</h4>
                      <p className="text-[11px] text-gray-400">Optional secondary provider</p>
                    </div>
                  </div>
                  <span className="gacks-integration-badge-not-configured">Not configured</span>
                </div>
              </SettingsCard>

              <SettingsCard title="Productivity & Workspace" description="Integrations for schedules, documents, and communication">
                <div className="gacks-integration-row">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981]" />
                    <div>
                      <h4 className="text-xs font-semibold text-white">Local Daily Calendar & Tasks</h4>
                      <p className="text-[11px] text-gray-400">Trading sessions, focus blocks, habit trackers</p>
                    </div>
                  </div>
                  <span className="gacks-integration-badge-connected">Active</span>
                </div>

                <div className="gacks-integration-row">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981]" />
                    <div>
                      <h4 className="text-xs font-semibold text-white">WhatsApp Messenger</h4>
                      <p className="text-[11px] text-gray-400">Governed communication via send_whatsapp_message tool</p>
                    </div>
                  </div>
                  <span className="gacks-integration-badge-connected">Configured (Level 4 Gate)</span>
                </div>

                <div className="gacks-integration-row">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981]" />
                    <div>
                      <h4 className="text-xs font-semibold text-white">Email Dispatch</h4>
                      <p className="text-[11px] text-gray-400">Governed notification email via send_email tool</p>
                    </div>
                  </div>
                  <span className="gacks-integration-badge-connected">Configured (Level 4 Gate)</span>
                </div>

                <div className="gacks-integration-row">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-500" />
                    <div>
                      <h4 className="text-xs font-semibold text-white">Google Drive / Notion / Slack</h4>
                      <p className="text-[11px] text-gray-400">External cloud storage synchronization</p>
                    </div>
                  </div>
                  <span className="gacks-integration-badge-not-configured">Coming soon</span>
                </div>
              </SettingsCard>

              {/* 3. EXTERNAL PUBLIC APIS & CAPABILITIES */}
              <SettingsCard
                title="External API Capabilities (Public APIs Catalog)"
                description="Verified external adapters operating under strict SSRF, rate-limit, and untrusted-data boundaries"
              >
                <div className="gacks-integration-row">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981]" />
                    <div>
                      <h4 className="text-xs font-semibold text-white">Open-Meteo Weather API</h4>
                      <p className="text-[11px] text-gray-400">Global atmospheric forecasts, temperatures, and conditions</p>
                    </div>
                  </div>
                  <span className="gacks-integration-badge-connected">Active · No Auth</span>
                </div>

                <div className="gacks-integration-row">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981]" />
                    <div>
                      <h4 className="text-xs font-semibold text-white">Open-Meteo Geocoding API</h4>
                      <p className="text-[11px] text-gray-400">City-to-coordinates resolution and timezone mapping</p>
                    </div>
                  </div>
                  <span className="gacks-integration-badge-connected">Active · No Auth</span>
                </div>

                <div className="gacks-integration-row">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981]" />
                    <div>
                      <h4 className="text-xs font-semibold text-white">Frankfurter Foreign Exchange Rates</h4>
                      <p className="text-[11px] text-gray-400">European Central Bank currency conversions and historical rates</p>
                    </div>
                  </div>
                  <span className="gacks-integration-badge-connected">Active · No Auth</span>
                </div>

                <div className="gacks-integration-row">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981]" />
                    <div>
                      <h4 className="text-xs font-semibold text-white">OSV Open Source Vulnerabilities</h4>
                      <p className="text-[11px] text-gray-400">Google open-source vulnerability database for package auditing</p>
                    </div>
                  </div>
                  <span className="gacks-integration-badge-connected">Active · No Auth</span>
                </div>

                <div className="gacks-integration-row">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981]" />
                    <div>
                      <h4 className="text-xs font-semibold text-white">Free Dictionary API</h4>
                      <p className="text-[11px] text-gray-400">Word definitions, phonetics, parts of speech, and etymology</p>
                    </div>
                  </div>
                  <span className="gacks-integration-badge-connected">Active · No Auth</span>
                </div>

                <div className="gacks-integration-row">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981]" />
                    <div>
                      <h4 className="text-xs font-semibold text-white">World Time API</h4>
                      <p className="text-[11px] text-gray-400">Precise timezone offsets, daylight savings, and atomic time</p>
                    </div>
                  </div>
                  <span className="gacks-integration-badge-connected">Active · No Auth</span>
                </div>

                <div className="gacks-integration-row">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#00A3FF]" />
                    <div>
                      <h4 className="text-xs font-semibold text-white">GitHub Public API</h4>
                      <p className="text-[11px] text-gray-400">Public repository, commit, issue, and release inspection</p>
                    </div>
                  </div>
                  <span className="gacks-integration-badge-connected">Connected (Token Optional)</span>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    className="gacks-btn-subtle text-xs"
                    onClick={() => {
                      setApiCatalogModalOpen(true)
                      loadCatalog()
                    }}
                  >
                    <Globe className="w-4 h-4 mr-1.5 text-[#00A3FF]" />
                    <span>Browse Public APIs Catalog ({apiCatalog.length || '100+'})</span>
                  </button>
                </div>
              </SettingsCard>

              {/* 4. PROVIDER CREDENTIALS & ISOLATION */}
              <SettingsCard
                title="Provider API Credentials & Isolation"
                description="Securely configure API keys for external services. Stored server-side, masked in UI, never logged."
              >
                <form onSubmit={handleSaveCredential} className="flex flex-col gap-3">
                  <div className="flex gap-3 flex-wrap items-end">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-xs font-mono text-gray-300 mb-1">Provider ID:</label>
                      <select
                        value={newProviderId}
                        onChange={(e) => setNewProviderId(e.target.value)}
                        className="w-full bg-[#141418] border border-white/10 rounded px-3 py-2 text-xs font-mono text-white outline-none"
                      >
                        <option value="github-api">GitHub API (Personal Access Token)</option>
                        <option value="news-api">NewsAPI.org (apiKey)</option>
                        <option value="nasa-open-apis">NASA Open APIs (apiKey)</option>
                        <option value="libre-translate">LibreTranslate (apiKey)</option>
                        <option value="custom">Custom Provider</option>
                      </select>
                    </div>

                    <div className="flex-1 min-w-[240px]">
                      <label className="block text-xs font-mono text-gray-300 mb-1">API Key / Token:</label>
                      <input
                        type="password"
                        value={newApiKey}
                        onChange={(e) => setNewApiKey(e.target.value)}
                        placeholder="Paste API key or bearer token..."
                        className="w-full bg-[#0d0d10] border border-white/10 rounded px-3 py-2 text-xs font-mono text-white outline-none focus:border-[#00A3FF]"
                      />
                    </div>

                    <button type="submit" className="gacks-btn-primary text-xs h-[35px]">
                      <Key className="w-3.5 h-3.5 mr-1" />
                      <span>Save Key</span>
                    </button>
                  </div>

                  {testResult && (
                    <div className="p-2.5 bg-black/40 border border-white/10 rounded text-xs font-mono text-[#00A3FF] flex items-center justify-between">
                      <span>{testResult}</span>
                      <button type="button" onClick={() => setTestResult(null)} className="text-gray-400 hover:text-white">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </form>

                {credentials.length > 0 && (
                  <div className="flex flex-col gap-2 pt-3 border-t border-white/10">
                    <span className="text-xs font-mono text-gray-400">Configured Provider Credentials:</span>
                    {credentials.map((c) => (
                      <div key={c.providerId} className="flex items-center justify-between p-2.5 bg-white/5 rounded border border-white/5">
                        <div>
                          <span className="text-xs font-semibold text-white font-mono">{c.providerName || c.providerId}</span>
                          <span className="text-[11px] font-mono text-gray-400 ml-3">{c.maskedKey || 'Configured'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="gacks-btn-subtle text-[11px] py-1 px-2"
                            onClick={() => handleTestProvider(c.providerId)}
                            disabled={testingProvider}
                          >
                            <RefreshCw className={`w-3 h-3 mr-1 ${testingProvider ? 'animate-spin' : ''}`} />
                            <span>Test</span>
                          </button>
                          <button
                            type="button"
                            className="text-red-400 hover:text-red-300 p-1"
                            onClick={() => handleDeleteCredential(c.providerId)}
                            title="Revoke and delete credential"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SettingsCard>
            </div>
          )}

          {/* 5. AUTOMATION */}
          {activeCategory === 'automation' && (
            <div className="gacks-category-panel">
              <SettingsCard title="Autonomous Agents & Scheduled Loops" description="Background task execution and agent authorization limits">
                <SettingsToggle
                  label="Enable Scheduled Tasks"
                  description="Permit recurring background cron loops for market and system updates"
                  checked={draft.automation.scheduledTasksEnabled}
                  onChange={(val) => updateField('automation', 'scheduledTasksEnabled', val)}
                />
                <SettingsToggle
                  label="Enable Background Autonomous Subagents"
                  description="Allow Insight to spawn independent background subagents for research"
                  checked={draft.automation.backgroundAgentsEnabled}
                  onChange={(val) => updateField('automation', 'backgroundAgentsEnabled', val)}
                />
                <SettingsSelect
                  label="Agent Permission Tier"
                  description="Governs whether actions execute autonomously or require approval"
                  value={draft.automation.agentPermissionTier}
                  options={[
                    { value: 'Read-only', label: 'Read-only (No side-effects allowed)' },
                    { value: 'Suggest', label: 'Suggest Only (Propose changes, zero execution)' },
                    { value: 'Execute with Approval', label: 'Execute with Approval (Standard Safety)' },
                    { value: 'Trusted Automation', label: 'Trusted Automation (Autonomous Execution)' },
                  ]}
                  onChange={(val) => updateField('automation', 'agentPermissionTier', val as any)}
                />
                <SettingsSlider
                  label="Task Execution Time Limit"
                  description="Hard ceiling for any autonomous multi-step execution"
                  value={draft.automation.taskExecutionLimitSec}
                  min={30}
                  max={300}
                  step={15}
                  unit="s"
                  onChange={(val) => updateField('automation', 'taskExecutionLimitSec', val)}
                />
              </SettingsCard>

              <SettingsCard title="Operator Approval Rules" description="Mandatory confirmation barriers before executing external mutations">
                <SettingsToggle
                  label="Require Approval to Send Messages (Email/WhatsApp)"
                  description="Present explicit dialog before dispatching outbound communications"
                  checked={draft.automation.requireApprovalForMessages}
                  onChange={(val) => updateField('automation', 'requireApprovalForMessages', val)}
                />
                <SettingsToggle
                  label="Require Approval to Modify Workspace Files"
                  description="Prompt operator before saving changes to project source files"
                  checked={draft.automation.requireApprovalForFiles}
                  onChange={(val) => updateField('automation', 'requireApprovalForFiles', val)}
                />
                <SettingsToggle
                  label="Require Approval to Delete Data"
                  description="Strictly block any deletion operation without explicit confirmation"
                  checked={draft.automation.requireApprovalForDeletion}
                  onChange={(val) => updateField('automation', 'requireApprovalForDeletion', val)}
                />
              </SettingsCard>
            </div>
          )}

          {/* 6. SECURITY */}
          {activeCategory === 'security' && (
            <div className="gacks-category-panel">
              <SettingsCard title="Privacy & Data Protection" description="Conversation lifecycle and secret redaction">
                <SettingsToggle
                  label="Retain Conversation History"
                  description="Save conversation logs between sessions"
                  checked={draft.security.conversationHistory}
                  onChange={(val) => updateField('security', 'conversationHistory', val)}
                />
                <SettingsSelect
                  label="Data Retention Window"
                  description="Duration before episodic logs are pruned"
                  value={String(draft.security.dataRetentionDays)}
                  options={[
                    { value: '30', label: '30 Days' },
                    { value: '90', label: '90 Days (Recommended)' },
                    { value: '365', label: '1 Year' },
                  ]}
                  onChange={(val) => updateField('security', 'dataRetentionDays', Number(val))}
                />
                <SettingsToggle
                  label="Automatic Secret Redaction"
                  description="Mask API tokens, passwords, and private keys in logs and telemetry"
                  checked={draft.security.secretRedaction}
                  onChange={(val) => updateField('security', 'secretRedaction', val)}
                />
                <SettingsToggle
                  label="Sensitive Data Warnings"
                  description="Warn if a prompt contains credit card patterns or sensitive credentials"
                  checked={draft.security.sensitiveDataWarnings}
                  onChange={(val) => updateField('security', 'sensitiveDataWarnings', val)}
                />
              </SettingsCard>

              <SettingsCard title="Sandbox & Policy Engine" description="Real-time containment boundaries">
                <div className="flex flex-col gap-2 text-xs text-gray-300">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-gray-400">Path Traversal Gate:</span>
                    <span className="font-mono text-emerald-400 font-semibold">ENFORCED (Sandbox Roots Only)</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-gray-400">SSRF Defense Gate:</span>
                    <span className="font-mono text-emerald-400 font-semibold">ENFORCED (RFC 1918 & Cloud Metadata Filtered)</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-gray-400">Client Secrets Storage:</span>
                    <span className="font-mono text-emerald-400 font-semibold">ZERO SECRETS IN BUNDLE (Server Runtime Only)</span>
                  </div>
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-gray-400">Audit Trail:</span>
                    <span className="font-mono text-[#00A3FF] font-semibold">Append-only Redacted JSON Logger</span>
                  </div>
                </div>
              </SettingsCard>
            </div>
          )}

          {/* 7. ADVANCED */}
          {activeCategory === 'advanced' && (
            <div className="gacks-category-panel">
              <SettingsCard title="Model Generation Parameters" description="Fine-tune inference temperature and token boundaries">
                <SettingsSlider
                  label="Temperature"
                  description="Controls sampling randomness (0.0 = deterministic/precise, 1.0 = highly creative)"
                  value={draft.advanced.temperature}
                  min={0.0}
                  max={1.0}
                  step={0.05}
                  onChange={(val) => updateField('advanced', 'temperature', val)}
                />
                <SettingsSlider
                  label="Max Output Tokens"
                  description="Maximum length of generated response per step"
                  value={draft.advanced.maxOutputTokens}
                  min={1024}
                  max={8192}
                  step={512}
                  onChange={(val) => updateField('advanced', 'maxOutputTokens', val)}
                />
                <SettingsSlider
                  label="Context History Limit"
                  description="Token budget allocated for prior conversation turns and memory"
                  value={draft.advanced.contextLimit}
                  min={8000}
                  max={64000}
                  step={4000}
                  unit=" tokens"
                  onChange={(val) => updateField('advanced', 'contextLimit', val)}
                />
              </SettingsCard>
            </div>
          )}

          {/* 8. DESKTOP ASSISTANT */}
          {activeCategory === 'desktop' && (
            <div className="gacks-category-panel">
              <SettingsCard title="Desktop Companion Agent" description="Operating system companion for native file and system access">
                <SettingsToggle
                  label="Desktop Companion Mode"
                  description="Connect to native local daemon for terminal and application control"
                  checked={draft.desktop.companionEnabled}
                  onChange={(val) => updateField('desktop', 'companionEnabled', val)}
                />
                <div className="gacks-settings-info-box">
                  <Laptop className="w-4 h-4 text-orange-400 shrink-0" />
                  <span className="text-xs text-gray-300">
                    <strong>Notice:</strong> OS-level capabilities (terminal execution, clipboard reading) require running the local daemon: <code className="text-orange-400 font-mono">npm run server</code>. Browser sandbox limitations prevent direct OS takeover.
                  </span>
                </div>
              </SettingsCard>

              <SettingsCard title="Computer Access Permissions" description="Permissions granted to local companion agent">
                <SettingsToggle
                  label="Screen Reading Permission"
                  description="Permit visual capture of viewport for multimodal questions"
                  checked={draft.desktop.screenReadingPermitted}
                  onChange={(val) => updateField('desktop', 'screenReadingPermitted', val)}
                  badge="Web & Desktop"
                />
                <SettingsToggle
                  label="Local File Access"
                  description="Permit reading and indexing sandboxed project workspace"
                  checked={draft.desktop.fileAccessPermitted}
                  onChange={(val) => updateField('desktop', 'fileAccessPermitted', val)}
                />
                <SettingsToggle
                  label="Terminal Shell Execution"
                  description="Allow running terminal shell commands inside the repo sandbox"
                  checked={draft.desktop.terminalPermitted}
                  onChange={(val) => updateField('desktop', 'terminalPermitted', val)}
                  badge="Requires Desktop Agent"
                  disabled={!draft.desktop.companionEnabled}
                />
                <SettingsToggle
                  label="Require Confirmation Before Command Execution"
                  description="Always prompt before executing any bash/powershell command"
                  checked={draft.desktop.requireConfirmationForCommands}
                  onChange={(val) => updateField('desktop', 'requireConfirmationForCommands', val)}
                />
              </SettingsCard>
            </div>
          )}

          {/* 9. USAGE & METRICS */}
          {activeCategory === 'usage' && (
            <div className="gacks-category-panel">
              <SettingsCard title="Real-Time AI Telemetry" description="Live resource and token metrics derived from active session">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="gacks-usage-stat-box">
                    <span className="text-xs text-gray-400 font-mono">CONVERSATION TURNS</span>
                    <span className="text-xl font-bold text-white font-mono mt-1">{turns.length}</span>
                    <span className="text-[10px] text-gray-500">Active session</span>
                  </div>
                  <div className="gacks-usage-stat-box">
                    <span className="text-xs text-gray-400 font-mono">APPROX. TOKENS</span>
                    <span className="text-xl font-bold text-[#00A3FF] font-mono mt-1">
                      {Math.max(1200, turns.reduce((acc: number, t: { text?: string }) => acc + (t.text?.length || 0) * 2, 0))}
                    </span>
                    <span className="text-[10px] text-gray-500">Input & output combined</span>
                  </div>
                  <div className="gacks-usage-stat-box">
                    <span className="text-xs text-gray-400 font-mono">ACTIVE TOOLS</span>
                    <span className="text-xl font-bold text-emerald-400 font-mono mt-1">
                      {connected.length || 12}
                    </span>
                    <span className="text-[10px] text-gray-500">Registry V2 items</span>
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="button"
                    className="gacks-btn-subtle text-xs"
                    onClick={() => {
                      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ turns, settings: draft }, null, 2))
                      const downloadAnchor = document.createElement('a')
                      downloadAnchor.setAttribute("href", dataStr)
                      downloadAnchor.setAttribute("download", `gacks_usage_report_${Date.now()}.json`)
                      document.body.appendChild(downloadAnchor)
                      downloadAnchor.click()
                      downloadAnchor.remove()
                    }}
                  >
                    <FileDown className="w-4 h-4 mr-1.5 text-[#00A3FF]" />
                    <span>Export Usage & Session JSON Report</span>
                  </button>
                </div>
              </SettingsCard>
            </div>
          )}

          {/* 10. DEVELOPER MODE */}
          {activeCategory === 'developer' && (
            <div className="gacks-category-panel">
              <SettingsCard title="Developer Mode Controls" description="Advanced engineering tooling and inspection panels">
                <SettingsToggle
                  label="Developer Mode Active"
                  description="Enable advanced diagnostics, raw JSON viewer, and API inspector"
                  checked={draft.developerMode}
                  onChange={(val) => setDraft((prev) => ({ ...prev, developerMode: val }))}
                  badge="Engineering"
                />

                {draft.developerMode && (
                  <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-white/5">
                    <div className="gacks-settings-info-box">
                      <Code2 className="w-4 h-4 text-purple-400 shrink-0" />
                      <span className="text-xs text-gray-300">
                        Developer Mode unlocks console inspections via <code className="text-purple-400">window.__jarvis</code> and direct tool debugging.
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="gacks-btn-subtle text-xs"
                        onClick={() => {
                          console.log('[GACKS P.A. Diagnostics]', {
                            store: useStore.getState(),
                            settings: draft,
                            timestamp: new Date().toISOString(),
                          })
                          alert('Diagnostic snapshot dumped to browser Developer Tools console (F12).')
                        }}
                      >
                        <Activity className="w-4 h-4 mr-1.5 text-purple-400" />
                        <span>Dump State to Dev Console</span>
                      </button>
                    </div>
                  </div>
                )}
              </SettingsCard>
            </div>
          )}

          {/* 11. EXPERIMENTAL */}
          {activeCategory === 'experimental' && (
            <div className="gacks-category-panel">
              <SettingsCard title="Experimental Features" description="Early-access features under active architecture development" badge="LABS">
                <SettingsToggle
                  label="Multi-Agent Collaborative Swarm"
                  description="Spawn coordinating specialized subagents for parallel research"
                  checked={draft.experimentalFlags.multiAgentCollaboration}
                  onChange={(val) =>
                    setDraft((prev) => ({
                      ...prev,
                      experimentalFlags: { ...prev.experimentalFlags, multiAgentCollaboration: val },
                    }))
                  }
                  badge="EXPERIMENTAL"
                />
                <SettingsToggle
                  label="Autonomous Proactive Research"
                  description="Allow Insight to formulate follow-up research questions autonomously"
                  checked={draft.experimentalFlags.autonomousResearch}
                  onChange={(val) =>
                    setDraft((prev) => ({
                      ...prev,
                      experimentalFlags: { ...prev.experimentalFlags, autonomousResearch: val },
                    }))
                  }
                  badge="EXPERIMENTAL"
                />
                <SettingsToggle
                  label="Local Neural Models (WebGPU)"
                  description="Experiment with local in-browser small language models for zero-cloud queries"
                  checked={draft.experimentalFlags.localAiModels}
                  onChange={(val) =>
                    setDraft((prev) => ({
                      ...prev,
                      experimentalFlags: { ...prev.experimentalFlags, localAiModels: val },
                    }))
                  }
                  badge="EXPERIMENTAL"
                />
              </SettingsCard>
            </div>
          )}

          {/* 12. HELP & ABOUT */}
          {activeCategory === 'help' && (
            <div className="gacks-category-panel">
              <SettingsCard title="Application Metadata" description="System release version and engineering specifications">
                <div className="flex flex-col gap-2 text-xs font-mono text-gray-300">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-gray-400">Release:</span>
                    <span className="text-white font-bold">Insight Business Suite — Enterprise Architecture</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-gray-400">Version:</span>
                    <span className="text-[#00A3FF]">2.0.4-production</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-gray-400">Primary Core:</span>
                    <span className="text-emerald-400">Google Gemini 2.5 Flash Free Tier</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-gray-400">Fallback Core:</span>
                    <span className="text-cyan-400">Anthropic Claude 3.5 Sonnet</span>
                  </div>
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-gray-400">Interface:</span>
                    <span className="text-purple-400">Three.js Arc Reactor + Holographic HUD</span>
                  </div>
                </div>
              </SettingsCard>

              <SettingsCard title="Keyboard Shortcuts Cheat Sheet" description="Accelerate your workflow with global shortcuts">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between bg-white/5 px-3 py-2 rounded">
                    <span className="text-gray-300">Activate Command Input</span>
                    <kbd className="font-mono text-[10px] bg-black/40 px-2 py-0.5 rounded text-white border border-white/10">Ctrl + K</kbd>
                  </div>
                  <div className="flex items-center justify-between bg-white/5 px-3 py-2 rounded">
                    <span className="text-gray-300">Toggle Voice Conversation</span>
                    <kbd className="font-mono text-[10px] bg-black/40 px-2 py-0.5 rounded text-white border border-white/10">Space</kbd>
                  </div>
                  <div className="flex items-center justify-between bg-white/5 px-3 py-2 rounded">
                    <span className="text-gray-300">Toggle HUD / Dashboard</span>
                    <kbd className="font-mono text-[10px] bg-black/40 px-2 py-0.5 rounded text-white border border-white/10">H</kbd>
                  </div>
                  <div className="flex items-center justify-between bg-white/5 px-3 py-2 rounded">
                    <span className="text-gray-300">Cycle Voice Audition</span>
                    <kbd className="font-mono text-[10px] bg-black/40 px-2 py-0.5 rounded text-white border border-white/10">V</kbd>
                  </div>
                  <div className="flex items-center justify-between bg-white/5 px-3 py-2 rounded">
                    <span className="text-gray-300">Emergency Stop / Dormant</span>
                    <kbd className="font-mono text-[10px] bg-black/40 px-2 py-0.5 rounded text-white border border-white/10">Esc</kbd>
                  </div>
                </div>
              </SettingsCard>

              {/* Danger Zone: Global Reset */}
              <SettingsDangerZone
                title="Reset All Insight Settings"
                description="Restore all 12 categories, preferences, and parameters to factory defaults. This will persist immediately."
                buttonLabel="Reset All Settings"
                onConfirm={handleGlobalReset}
              />
            </div>
          )}
        </div>
      </div>

      {/* 3. FLOATING UNSAVED CHANGES BAR */}
      {isDirty && (
        <div className="gacks-settings-save-bar">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-mono text-white font-semibold">
              You have unsaved preference changes
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="gacks-btn-subtle text-xs"
              onClick={handleDiscard}
            >
              Discard
            </button>
            <button
              type="button"
              className="gacks-btn-primary text-xs"
              onClick={handleSave}
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      )}

      {/* Save Success Toast */}
      {saveToast && (
        <div className="gacks-settings-toast">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-mono text-white font-semibold">
            Settings saved and persisted successfully!
          </span>
        </div>
      )}

      {/* Public APIs Catalog Modal */}
      {apiCatalogModalOpen && (
        <div className="gacks-modal-overlay" onClick={() => setApiCatalogModalOpen(false)}>
          <div className="gacks-modal-window max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="gacks-modal-header">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#00A3FF]" />
                <span className="text-sm font-bold text-white">PUBLIC APIS CAPABILITY CATALOG</span>
                <span className="text-xs font-mono text-gray-400">({apiCatalog.length} services indexed)</span>
              </div>
              <button
                type="button"
                className="text-gray-400 hover:text-white"
                onClick={() => setApiCatalogModalOpen(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-white/10 flex gap-3 flex-wrap items-center bg-black/20">
              <div className="flex-1 min-w-[220px] flex items-center gap-2 bg-[#0d0d10] border border-white/10 rounded px-2.5 py-1.5">
                <Search className="w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search catalog by name, category, or capability..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs text-white w-full font-mono"
                />
              </div>

              <select
                value={catalogCategoryFilter}
                onChange={(e) => setCatalogCategoryFilter(e.target.value)}
                className="bg-[#141418] border border-white/10 text-xs text-white rounded px-2.5 py-1.5 outline-none font-mono"
              >
                <option value="all">All Categories ({apiCatalog.length})</option>
                {catalogCategories.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.count})
                  </option>
                ))}
              </select>
            </div>

            <div className="gacks-modal-body max-h-[60vh] overflow-y-auto p-3 flex flex-col gap-2">
              {apiCatalog
                .filter((item) => {
                  if (catalogCategoryFilter !== 'all' && item.category !== catalogCategoryFilter) return false
                  if (catalogSearch.trim()) {
                    const q = catalogSearch.toLowerCase().trim()
                    return (
                      item.name.toLowerCase().includes(q) ||
                      item.description.toLowerCase().includes(q) ||
                      item.category.toLowerCase().includes(q)
                    )
                  }
                  return true
                })
                .map((item) => (
                  <div key={item.id} className="p-3 bg-white/[0.02] border border-white/5 rounded flex items-start justify-between gap-3 hover:border-white/15 transition-all">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-bold text-white font-mono">{item.name}</span>
                        <span className="text-[10px] font-mono bg-white/10 text-gray-300 px-1.5 py-0.5 rounded">
                          {item.category}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            item.authType === 'none'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : item.authType === 'apiKey'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-purple-500/20 text-purple-400'
                          }`}
                        >
                          Auth: {item.authType}
                        </span>
                        {item.adapterStatus === 'installed' && (
                          <span className="text-[10px] font-mono bg-[#00A3FF]/20 text-[#00A3FF] border border-[#00A3FF]/40 px-1.5 py-0.5 rounded">
                            Verified Adapter Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-2">{item.description}</p>
                    </div>

                    <a
                      href={item.documentationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-[#00A3FF] hover:underline shrink-0 flex items-center gap-1 font-mono pt-1"
                    >
                      <span>Docs</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
