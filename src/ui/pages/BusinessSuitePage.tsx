import React, { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp,
  CheckCircle,
  ShieldCheck,
  Users,
  DollarSign,
  BarChart3,
  RefreshCw,
  MessageSquare,
  Sparkles,
  Menu,
  X,
  ExternalLink,
  AlertTriangle,
  Layers,
  Sliders,
  Activity,
  LayoutDashboard,
  CheckSquare,
  Folder,
  Calendar,
  Globe,
  Cpu,
  Settings,
  Lock,
  Bot,
} from 'lucide-react'
import { useStore, type NavRoute } from '../../store'
import { apiClient } from '../../lib/api-client'
import insightLogo from '../../assets/insight-logo.jpeg'

interface MorningBriefingData {
  executiveGreeting: string
  date: string
  revenuePacing: { mrrUsd: number; targetUsd: number; pacingPercent: number }
  urgentCustomerAlerts: Array<{ customerName: string; issue: string; ltvUsd: number }>
  pendingExecutiveApprovals: Array<{ id: string; action: string; impact: string; costUsd?: number }>
  overdueTasks: Array<{ id: string; text: string }>
  todaysPriorities: string[]
  marketSummary: string
  briefingText: string
}

interface ApprovalItem {
  id: string
  action: string
  reason: string
  provider: string
  target: string
  potentialImpact: string
  costUsd?: number
  status: string
  createdAt: number
}

interface CustomerItem {
  id: string
  name: string
  email?: string
  phone?: string
  channel?: string
  status: string
  sentiment?: string
  ltvUsd: number
  tags: string[]
  notes: string[]
}

interface ForexAuditData {
  pair: string
  direction: 'LONG' | 'SHORT'
  entryPrice: number
  stopLoss: number
  takeProfit: number
  riskPercent: number
  riskRewardRatio: number
  positionSizeLots: number
  marketContext: string
  strengths: string[]
  riskFlags: string[]
  invalidationLevel: number
  safetyDisclaimer: string
}

interface MetaCampaignInsight {
  campaignId: string
  campaignName: string
  status: string
  impressions: number
  clicks: number
  ctrPercent: number
  spendUsd: number
  cpcUsd: number
  conversions: number
  roas: number
}

interface MetaAdAccount {
  id: string
  name: string
  currency: string
  status: string
}

type SuiteTab = 'briefing' | 'approvals' | 'crm' | 'forex' | 'marketing' | 'meta_ads' | 'automations'

export const BusinessSuitePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SuiteTab>('briefing')
  const [menuOpen, setMenuOpen] = useState(false)
  const [showSuiteLogo, setShowSuiteLogo] = useState<boolean>(() => {
    try {
      return localStorage.getItem('gacks_suite_logo_visible') !== 'false'
    } catch {
      return true
    }
  })

  const toggleSuiteLogo = (visible: boolean) => {
    setShowSuiteLogo(visible)
    try {
      localStorage.setItem('gacks_suite_logo_visible', visible ? 'true' : 'false')
    } catch {}
  }
  const [briefing, setBriefing] = useState<MorningBriefingData | null>(null)
  const [approvals, setApprovals] = useState<ApprovalItem[]>([])
  const [customers, setCustomers] = useState<CustomerItem[]>([])
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  // Meta Ads Manager state
  const [metaConnected, setMetaConnected] = useState<boolean | null>(null)
  const [metaLoading, setMetaLoading] = useState(false)
  const [metaAccounts, setMetaAccounts] = useState<MetaAdAccount[]>([])
  const [metaCampaign, setMetaCampaign] = useState<MetaCampaignInsight | null>(null)
  const [metaError, setMetaError] = useState<string | null>(null)

  // Forex form state
  const [forexPair, setForexPair] = useState('XAUUSD')
  const [forexDirection, setForexDirection] = useState<'LONG' | 'SHORT'>('LONG')
  const [forexEntry, setForexEntry] = useState(2650.0)
  const [forexStop, setForexStop] = useState(2640.0)
  const [forexTp, setForexTp] = useState(2680.0)
  const [forexRisk, setForexRisk] = useState(1.0)
  const [forexResult, setForexResult] = useState<ForexAuditData | null>(null)

  const submitQuery = useStore((s) => s.submitQuery)
  const setActiveNav = useStore((s) => s.setActiveNav)

  // Close menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menuOpen) {
        setMenuOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [menuOpen])

  // Fetch Meta Ads status & insights
  const fetchMetaStatus = useCallback(async () => {
    setMetaLoading(true)
    setMetaError(null)
    try {
      // 1. Check if Meta credential is configured
      const credRes = await apiClient.getCredentials()
      let hasMetaCred = false
      if (credRes.ok && credRes.data) {
        const credList = Array.isArray(credRes.data.credentials) ? credRes.data.credentials : []
        hasMetaCred = credList.some(
          (c: any) => c.providerId === 'meta-business' || c.providerId === 'meta'
        )
      }

      setMetaConnected(hasMetaCred)

      if (hasMetaCred) {
        // Fetch accounts and insights through Meta adapter
        const [accRes, insRes] = await Promise.all([
          apiClient.executeAdapter('meta-business', 'list_ad_accounts', {}),
          apiClient.executeAdapter('meta-business', 'get_campaign_insights', {}),
        ])

        if (accRes.ok && accRes.data?.result?.accounts) {
          setMetaAccounts(accRes.data.result.accounts)
        }

        if (insRes.ok && insRes.data?.result) {
          setMetaCampaign(insRes.data.result)
        }
      } else {
        setMetaAccounts([])
        setMetaCampaign(null)
      }
    } catch (err: any) {
      setMetaError(err.message || 'Failed to reach Meta Business gateway')
      setMetaConnected(false)
    } finally {
      setMetaLoading(false)
    }
  }, [])

  const fetchAllData = useCallback(async () => {
    setLoading(true)
    try {
      const [briefingRes, approvalsRes, crmRes] = await Promise.all([
        apiClient.getBriefing(),
        apiClient.getApprovals(),
        apiClient.getCrm(),
      ])
      if (briefingRes.ok && briefingRes.data) setBriefing(briefingRes.data)
      if (approvalsRes.ok && approvalsRes.data) {
        setApprovals(approvalsRes.data.approvals || [])
      }
      if (crmRes.ok && crmRes.data) {
        setCustomers(crmRes.data.customers || [])
      }
    } catch {
      // Fallback offline mock values
      setBriefing({
        executiveGreeting: 'Executive Briefing · Today',
        date: new Date().toLocaleDateString(),
        revenuePacing: { mrrUsd: 34500, targetUsd: 50000, pacingPercent: 69.0 },
        urgentCustomerAlerts: [
          { customerName: 'Nairobi Global Imports', issue: 'Customer awaiting executive response', ltvUsd: 8200 },
        ],
        pendingExecutiveApprovals: [],
        overdueTasks: [],
        todaysPriorities: [
          'Resolve inquiries for Nairobi Global Imports.',
          'Review Meta ad campaign draft for Q3.',
          'Execute mid-day Forex market structure audit on XAUUSD.',
        ],
        marketSummary: 'Gold (XAUUSD) testing key structural liquidity resistance.',
        briefingText: 'Good morning. Pacing stands at 69% towards quarterly revenue goals.',
      })
    } finally {
      setLoading(false)
    }
    fetchMetaStatus()
  }, [fetchMetaStatus])

  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  const handleResolveApproval = async (id: string, decision: 'approved' | 'rejected') => {
    try {
      const res = await apiClient.resolveApproval(id, decision, 'operator')
      if (res.ok) {
        setStatusMsg(`Approval ${id} marked as ${decision.toUpperCase()}.`)
        setApprovals((prev) => prev.filter((a) => a.id !== id))
      }
    } catch (e: any) {
      setStatusMsg(`Error resolving approval: ${e.message}`)
    }
  }

  const handleRunForexAudit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await apiClient.auditForex({
        pair: forexPair,
        direction: forexDirection,
        entryPrice: Number(forexEntry),
        stopLoss: Number(forexStop),
        takeProfit: Number(forexTp),
        riskPercent: Number(forexRisk),
      })
      if (res.ok && res.data) {
        setForexResult(res.data.report)
      }
    } catch (err: any) {
      setStatusMsg(`Forex audit error: ${err.message}`)
    }
  }

  const suiteNavItems: { id: SuiteTab; label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; badge?: number }[] = [
    { id: 'briefing', label: 'Executive Briefing', icon: TrendingUp },
    { id: 'approvals', label: 'Approval Center', icon: ShieldCheck, badge: approvals.length },
    { id: 'crm', label: 'CRM & Customer Care', icon: Users, badge: customers.length },
    { id: 'meta_ads', label: 'Meta Ads Manager', icon: Layers },
    { id: 'marketing', label: 'Marketing & Campaigns', icon: DollarSign },
    { id: 'forex', label: 'Forex Analysis Auditor', icon: BarChart3 },
    { id: 'automations', label: 'Automations & Rules', icon: Sliders },
  ]

  const workspaceShortcuts: { id: NavRoute; label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }[] = [
    { id: 'dashboard', label: 'Main Dashboard', icon: LayoutDashboard },
    { id: 'chat', label: 'AI Chat Command', icon: MessageSquare },
    { id: 'tasks', label: 'Tasks & Sprints', icon: CheckSquare },
    { id: 'files', label: 'Files & Storage', icon: Folder },
    { id: 'calendar', label: 'Schedule & Calendar', icon: Calendar },
    { id: 'websearch', label: 'Web Intelligence', icon: Globe },
    { id: 'system', label: 'System Diagnostics', icon: Cpu },
    { id: 'settings', label: 'Settings & Credentials', icon: Settings },
  ]

  return (
    <div className="bs-container">
      {/* 1. Header & Executive Command Center Greeting */}
      <header className="bs-header">
        <div className="bs-brand">
          {showSuiteLogo ? (
            <div className="bs-brand-logo-wrap">
              <img
                src={insightLogo}
                alt="Insight Business Suite"
                className="bs-brand-logo-img"
              />
              <button
                type="button"
                onClick={() => toggleSuiteLogo(false)}
                className="bs-brand-logo-remove"
                title="Remove suite logo"
                aria-label="Remove suite logo"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => toggleSuiteLogo(true)}
              className="bs-brand-restore-btn"
              title="Restore suite logo"
              aria-label="Restore suite logo"
            >
              <span>+ Logo</span>
            </button>
          )}
          <div className="bs-brand-headings">
            <div className="bs-title-row">
              <h1 className="bs-title">Insight Business Suite</h1>
              <span className="bs-pro-badge">PRO</span>
            </div>
            <p className="bs-subtitle">
              Executive Command Center · Business Growth, CRM, Marketing & Market Operations
            </p>
          </div>
        </div>

        <div className="bs-toolbar">
          {/* Suite Menu Button */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="bs-btn-menu"
            aria-label="Open Suite Menu"
            aria-expanded={menuOpen}
          >
            <Menu className="w-4 h-4 text-cyan-400" />
            <span>Suite Menu</span>
            {approvals.length > 0 && (
              <span className="bs-menu-counter">
                {approvals.length}
              </span>
            )}
          </button>

          {/* Sync Button */}
          <button
            type="button"
            onClick={fetchAllData}
            disabled={loading}
            className="bs-btn-sync"
            title="Sync all business data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>

          <div className="bs-status-badge">
            <div className="bs-status-dot" />
            <span>OPERATIONAL</span>
          </div>
        </div>
      </header>

      {statusMsg && (
        <div className="bs-alert-banner">
          <span>{statusMsg}</span>
          <button type="button" onClick={() => setStatusMsg(null)} className="bs-alert-close">✕</button>
        </div>
      )}

      {/* 2. Top Executive KPI Bar */}
      <section className="bs-kpi-grid" aria-label="Executive Key Performance Indicators">
        {/* MRR Pacing */}
        <div
          onClick={() => setActiveTab('briefing')}
          className="bs-kpi-card"
          tabIndex={0}
          role="button"
          onKeyDown={(e) => e.key === 'Enter' && setActiveTab('briefing')}
        >
          <div className="bs-kpi-top">
            <span>MRR Pacing</span>
            <TrendingUp className="w-4 h-4 bs-kpi-icon" />
          </div>
          <div className="bs-kpi-value bs-kpi-value-emerald">
            ${briefing?.revenuePacing.mrrUsd.toLocaleString() || '34,500'}
          </div>
          <div className="bs-kpi-meta">
            <span>Target: ${briefing?.revenuePacing.targetUsd.toLocaleString() || '50,000'}</span>
            <span style={{ color: '#34D399', fontWeight: 600 }}>{briefing?.revenuePacing.pacingPercent || 69}%</span>
          </div>
          <div className="bs-kpi-progress-bar">
            <div
              className="bs-kpi-progress-fill"
              style={{ width: `${briefing?.revenuePacing.pacingPercent || 69}%` }}
            />
          </div>
        </div>

        {/* Active Accounts */}
        <div
          onClick={() => setActiveTab('crm')}
          className="bs-kpi-card"
          tabIndex={0}
          role="button"
          onKeyDown={(e) => e.key === 'Enter' && setActiveTab('crm')}
        >
          <div className="bs-kpi-top">
            <span>Active Clients</span>
            <Users className="w-4 h-4 bs-kpi-icon" />
          </div>
          <div className="bs-kpi-value">
            {customers.length || 8}
          </div>
          <div className="bs-kpi-meta">
            {customers.filter((c) => c.status === 'churn_risk').length > 0 ? (
              <span style={{ color: '#FBBF24' }}>
                {customers.filter((c) => c.status === 'churn_risk').length} at churn risk
              </span>
            ) : (
              <span style={{ color: '#34D399' }}>Pipeline healthy</span>
            )}
          </div>
        </div>

        {/* Pending Approvals */}
        <div
          onClick={() => setActiveTab('approvals')}
          className="bs-kpi-card"
          tabIndex={0}
          role="button"
          onKeyDown={(e) => e.key === 'Enter' && setActiveTab('approvals')}
        >
          <div className="bs-kpi-top">
            <span>Pending Approvals</span>
            <ShieldCheck className="w-4 h-4 bs-kpi-icon" style={{ color: '#F59E0B' }} />
          </div>
          <div className="bs-kpi-value bs-kpi-value-amber">
            {approvals.length}
          </div>
          <div className="bs-kpi-meta">
            {approvals.length === 0 ? 'All actions clear' : 'Human-in-the-Loop review required'}
          </div>
        </div>

        {/* Meta Ads Status */}
        <div
          onClick={() => setActiveTab('meta_ads')}
          className="bs-kpi-card"
          tabIndex={0}
          role="button"
          onKeyDown={(e) => e.key === 'Enter' && setActiveTab('meta_ads')}
        >
          <div className="bs-kpi-top">
            <span>Meta Ads Status</span>
            <Layers className="w-4 h-4 bs-kpi-icon" />
          </div>
          <div className="bs-kpi-value">
            {metaConnected ? (
              <span style={{ color: '#34D399' }}>Connected</span>
            ) : metaConnected === false ? (
              <span style={{ color: 'var(--gacks-text-muted, #A1A1A6)', fontSize: '15px' }}>Not Connected</span>
            ) : (
              <span style={{ color: 'var(--gacks-text-dim, #71717A)', fontSize: '15px' }}>Checking...</span>
            )}
          </div>
          <div className="bs-kpi-meta">
            {metaConnected ? (
              metaCampaign ? `$${metaCampaign.spendUsd} 30d spend` : '1 active ad account'
            ) : (
              'Authentication required'
            )}
          </div>
        </div>
      </section>

      {/* 3. Quick Navigation Strip (Horizontal Switcher) */}
      <nav className="bs-nav-strip" aria-label="Business Suite Modules Navigation">
        {suiteNavItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`bs-nav-tab ${isActive ? 'bs-nav-tab-active' : ''}`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span className={`bs-tab-badge ${isActive ? 'bs-tab-badge-active' : ''}`}>
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* 4. Slide-Over Suite Menu Drawer / Modal */}
      {menuOpen && (
        <div className="bs-drawer-root" role="dialog" aria-modal="true" aria-label="Suite Menu">
          {/* Backdrop */}
          <div
            className="bs-drawer-backdrop"
            onClick={() => setMenuOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="bs-drawer-panel">
            <div>
              {/* Drawer Header */}
              <div className="bs-drawer-header">
                <div className="bs-drawer-title-group">
                  <div className="bs-drawer-logo-wrap">
                    <img
                      src={insightLogo}
                      alt="Insight"
                      className="bs-brand-logo-img"
                    />
                  </div>
                  <div>
                    <h2 className="bs-drawer-title">INSIGHT BUSINESS SUITE</h2>
                    <p className="bs-drawer-sub">Executive Command & Workspace Navigation</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="bs-drawer-close-btn"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Suite Modules */}
              <div className="bs-drawer-section-title">
                Business Suite Modules
              </div>
              <div className="bs-drawer-menu-list">
                {suiteNavItems.map((item) => {
                  const Icon = item.icon
                  const isActive = activeTab === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id)
                        setMenuOpen(false)
                      }}
                      className={`bs-drawer-item ${isActive ? 'bs-drawer-item-active' : ''}`}
                    >
                      <div className="bs-drawer-item-left">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                      {typeof item.badge === 'number' && item.badge > 0 && (
                        <span className="bs-tab-badge">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Workspace Shortcuts */}
              <div className="bs-drawer-section-title" style={{ marginTop: '24px' }}>
                Gacks AI Workspace Navigation
              </div>
              <div className="bs-drawer-menu-list">
                {workspaceShortcuts.map((sc) => {
                  const Icon = sc.icon
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => {
                        setActiveNav(sc.id)
                        setMenuOpen(false)
                      }}
                      className="bs-drawer-item"
                    >
                      <div className="bs-drawer-item-left">
                        <Icon className="w-4 h-4" style={{ color: 'var(--gacks-cyan, #00A3FF)' }} />
                        <span>{sc.label}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="bs-drawer-footer">
              <span>Insight Business Suite v2.4</span>
              <span style={{ color: 'var(--gacks-cyan, #00A3FF)', fontFamily: 'var(--gacks-font-mono)' }}>Esc to close</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: Executive Briefing & Growth */}
      {/* ========================================================================= */}
      {activeTab === 'briefing' && briefing && (
        <div className="bs-two-col-layout">
          {/* Column 1 & 2: Main Briefing, Copilot & Priorities */}
          <div className="bs-stacked-list">
            <div className="bs-card">
              <div className="bs-card-header">
                <h2 className="bs-card-title">
                  <Sparkles className="w-4 h-4" style={{ color: 'var(--gacks-cyan, #00A3FF)' }} />
                  <span>Morning Executive Briefing</span>
                </h2>
                <span className="bs-card-meta">{briefing.date}</span>
              </div>
              <div style={{
                padding: '14px 16px',
                borderRadius: '8px',
                background: 'rgba(16, 16, 18, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                fontSize: '13px',
                lineHeight: 1.6,
                color: '#EDEDEF'
              }}>
                {briefing.briefingText}
              </div>
              <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => submitQuery('Read me my morning briefing out loud.')}
                  className="bs-btn-primary"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Ask Insight to Voice Briefing</span>
                </button>
                <button
                  type="button"
                  onClick={() => submitQuery('Analyze today’s business priorities and draft an execution agenda.')}
                  className="bs-btn-secondary"
                >
                  <Activity className="w-3.5 h-3.5" style={{ color: 'var(--gacks-text-muted)' }} />
                  <span>Generate Agenda</span>
                </button>
              </div>
            </div>

            {/* AI Business Assistant / Copilot Control (Section 10) */}
            <div className="bs-copilot-card">
              <div className="bs-copilot-header">
                <Bot className="w-4 h-4 bs-copilot-icon" />
                <h3 className="bs-copilot-title">Gacks Copilot · Business AI Assistant</h3>
                <span className="bs-copilot-sub">One-click execution</span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#94A3B8', lineHeight: 1.4 }}>
                Direct conversational interface for enterprise research, performance audits, and pipeline synthesis.
              </p>
              <div className="bs-copilot-chips">
                <button
                  type="button"
                  onClick={() => submitQuery('Analyze business performance and revenue pacing metrics.')}
                  className="bs-copilot-chip"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Analyze business performance</span>
                </button>
                <button
                  type="button"
                  onClick={() => submitQuery('Summarize sales activity and customer pipeline status.')}
                  className="bs-copilot-chip"
                >
                  <Users className="w-3 h-3" />
                  <span>Summarize sales activity</span>
                </button>
                <button
                  type="button"
                  onClick={() => submitQuery('Review pending approvals and highlight urgent items.')}
                  className="bs-copilot-chip"
                >
                  <ShieldCheck className="w-3 h-3" />
                  <span>Review pending approvals</span>
                </button>
                <button
                  type="button"
                  onClick={() => submitQuery('Analyze marketing campaign performance and recommend target spend.')}
                  className="bs-copilot-chip"
                >
                  <TrendingUp className="w-3 h-3" />
                  <span>Analyze marketing performance</span>
                </button>
                <button
                  type="button"
                  onClick={() => submitQuery('Generate a full business status report for today.')}
                  className="bs-copilot-chip"
                >
                  <BarChart3 className="w-3 h-3" />
                  <span>Generate business report</span>
                </button>
              </div>
            </div>

            {/* Daily Priorities */}
            <div className="bs-card">
              <div className="bs-card-header">
                <h3 className="bs-card-title">Today’s Highest-Leverage Focus</h3>
                <span className="bs-card-meta">{briefing.todaysPriorities.length} key priorities</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {briefing.todaysPriorities.map((p, i) => (
                  <li
                    key={i}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      background: 'rgba(16, 16, 18, 0.5)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      fontSize: '12px',
                      lineHeight: 1.4,
                    }}
                  >
                    <span style={{ color: 'var(--gacks-cyan, #00A3FF)', fontWeight: 700, fontFamily: 'var(--gacks-font-mono)' }}>{i + 1}.</span>
                    <span style={{ color: '#D4D4D8' }}>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Column 3: Pacing & Market Overview */}
          <div className="bs-stacked-list">
            {/* Revenue Pacing Card */}
            <div className="bs-card">
              <div className="bs-card-header">
                <h3 className="bs-card-title">Monthly Revenue Pacing</h3>
                <span className="bs-card-meta">Live Target</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#34D399', fontFamily: 'var(--gacks-font-mono)' }}>
                ${briefing.revenuePacing.mrrUsd.toLocaleString()}
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--gacks-text-muted, #A1A1A6)' }}>
                Target: ${briefing.revenuePacing.targetUsd.toLocaleString()} ({briefing.revenuePacing.pacingPercent}% achieved)
              </p>
              <div className="bs-kpi-progress-bar" style={{ marginTop: '14px' }}>
                <div
                  className="bs-kpi-progress-fill"
                  style={{ width: `${briefing.revenuePacing.pacingPercent}%` }}
                />
              </div>
            </div>

            {/* Market Context Card */}
            <div className="bs-card">
              <div className="bs-card-header">
                <h3 className="bs-card-title">Market & Macro Context</h3>
                <span className="bs-card-meta">Global Desk</span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#D4D4D8', lineHeight: 1.6 }}>{briefing.marketSummary}</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* VIEW 2: Human-in-the-Loop Approval Center */}
      {/* ========================================================================= */}
      {activeTab === 'approvals' && (
        <div className="bs-stacked-list">
          <div className="bs-card-header">
            <h2 className="bs-card-title">Pending Executive Authorizations</h2>
            <span className="bs-card-meta">
              {approvals.length} action(s) require explicit Human-in-the-Loop approval
            </span>
          </div>

          {approvals.length === 0 ? (
            <div className="bs-card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--gacks-text-muted)' }}>
              <CheckCircle className="w-10 h-10 text-emerald-400" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.85 }} />
              <p style={{ margin: 0, fontSize: '14px', color: '#EDEDEF', fontWeight: 500 }}>All operations clear</p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--gacks-text-dim)' }}>Zero pending actions awaiting executive authorization.</p>
            </div>
          ) : (
            <div className="bs-stacked-list">
              {approvals.map((req) => (
                <div key={req.id} className="bs-approval-card">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`bs-badge-impact ${
                        req.potentialImpact === 'critical'
                          ? 'bs-badge-impact-critical'
                          : req.potentialImpact === 'high'
                          ? 'bs-badge-impact-high'
                          : req.potentialImpact === 'medium'
                          ? 'bs-badge-impact-medium'
                          : 'bs-badge-impact-low'
                      }`}>
                        {req.potentialImpact}
                      </span>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>{req.action}</h4>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#D4D4D8' }}>{req.reason}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '11px', color: 'var(--gacks-text-muted)', marginTop: '2px' }}>
                      <span>Provider: <b style={{ color: '#EDEDEF' }}>{req.provider}</b></span>
                      <span>Target: <b style={{ color: '#EDEDEF' }}>{req.target}</b></span>
                      {req.costUsd ? <span>Est. Cost: <b style={{ color: '#34D399' }}>${req.costUsd}</b></span> : null}
                    </div>
                  </div>

                  <div className="bs-approval-actions">
                    <button
                      type="button"
                      onClick={() => handleResolveApproval(req.id, 'approved')}
                      className="bs-btn-primary"
                    >
                      Approve Action
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResolveApproval(req.id, 'rejected')}
                      className="bs-btn-danger"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: CRM & Customer Care */}
      {/* ========================================================================= */}
      {activeTab === 'crm' && (
        <div className="bs-stacked-list">
          <div className="bs-card-header">
            <h2 className="bs-card-title">Client Accounts & Inbound Pipeline</h2>
            <button
              type="button"
              onClick={() => submitQuery('Analyze our customer list and show urgent followups.')}
              className="bs-btn-secondary"
              style={{ padding: '6px 12px', fontSize: '11px' }}
            >
              Analyze with Insight
            </button>
          </div>

          <div className="bs-table-wrap">
            <table className="bs-table">
              <thead>
                <tr>
                  <th>Client / Company</th>
                  <th>Channel</th>
                  <th>Status</th>
                  <th>Sentiment</th>
                  <th>LTV (USD)</th>
                  <th>Last Note</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600, color: '#ffffff' }}>{c.name}</td>
                    <td style={{ textTransform: 'capitalize', color: 'var(--gacks-cyan, #00A3FF)' }}>{c.channel || 'email'}</td>
                    <td>
                      <span className={`bs-badge-impact ${
                        c.status === 'churn_risk' ? 'bs-badge-impact-critical' : 'bs-badge-impact-low'
                      }`}>
                        {c.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{c.sentiment}</td>
                    <td style={{ fontFamily: 'var(--gacks-font-mono)', fontWeight: 600, color: '#34D399' }}>
                      ${c.ltvUsd.toLocaleString()}
                    </td>
                    <td style={{ color: 'var(--gacks-text-muted)', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.notes[c.notes.length - 1] || 'No notes'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 4: Meta Ads Manager (First-Class Module) */}
      {/* ========================================================================= */}
      {/* VIEW 4: Meta Ads Manager (First-Class Module) */}
      {/* ========================================================================= */}
      {activeTab === 'meta_ads' && (
        <div className="bs-stacked-list">
          <div className="bs-meta-header">
            <div>
              <h2 className="bs-card-title">
                <Layers className="bs-kpi-icon" style={{ width: '20px', height: '20px' }} />
                <span>Meta Ads Manager</span>
              </h2>
              <p className="bs-card-meta" style={{ marginTop: '4px' }}>
                Direct integration with Meta Graph API v21.0 for Facebook & Instagram campaigns
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={fetchMetaStatus}
                disabled={metaLoading}
                className="bs-btn-secondary"
              >
                <RefreshCw style={{ width: '14px', height: '14px' }} className={metaLoading ? 'animate-spin' : ''} />
                <span>Refresh Status</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveNav('settings')}
                className="bs-btn-primary"
              >
                <Settings style={{ width: '14px', height: '14px' }} />
                <span>API Settings</span>
              </button>
            </div>
          </div>

          {/* Authentic Connection State Machine */}
          {metaLoading ? (
            <div className="bs-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <RefreshCw style={{ width: '28px', height: '28px', color: 'var(--gacks-cyan)', margin: '0 auto 12px' }} className="animate-spin" />
              <p style={{ fontSize: '13px', color: 'var(--gacks-text-muted)' }}>Checking Meta Graph API connectivity and credentials...</p>
            </div>
          ) : metaError ? (
            <div className="bs-card" style={{ border: '1px solid rgba(255, 69, 58, 0.4)', background: 'rgba(255, 69, 58, 0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FFA29C', fontWeight: 600, fontSize: '13px' }}>
                <AlertTriangle style={{ width: '16px', height: '16px' }} />
                <span>API Gateway Error</span>
              </div>
              <p style={{ fontSize: '12px', color: '#FFA29C', margin: '8px 0 12px' }}>{metaError}</p>
              <button
                type="button"
                onClick={fetchMetaStatus}
                className="bs-btn-danger"
              >
                Retry Connection
              </button>
            </div>
          ) : !metaConnected ? (
            /* Disconnected / Authentication Required State */
            <div className="bs-locked-box">
              <div className="bs-locked-icon-wrap">
                <Lock style={{ width: '24px', height: '24px' }} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>Meta Business & Ads Suite Not Connected</h3>
                <p style={{ margin: '6px auto 0', maxWidth: '520px', fontSize: '12px', color: 'var(--gacks-text-muted)', lineHeight: 1.5 }}>
                  To manage Facebook Pages, Instagram Professional ad campaigns, and pull real-time audience metrics, connect your Meta Graph API credentials in Settings.
                </p>
              </div>

              <div className="bs-scope-list">
                <h4 style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: '#EDEDEF' }}>Required OAuth Scopes & Permissions:</h4>
                <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--gacks-text-muted)', fontSize: '11px' }}>
                  <li><code>ads_management</code> — Create and manage campaigns</li>
                  <li><code>ads_read</code> — Read campaign performance & insights</li>
                  <li><code>business_management</code> — Manage connected business assets</li>
                </ul>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => setActiveNav('settings')}
                  className="bs-btn-primary"
                >
                  <Settings style={{ width: '14px', height: '14px' }} />
                  <span>Configure Meta Credentials in Settings</span>
                </button>
                <a
                  href="https://developers.facebook.com/apps/"
                  target="_blank"
                  rel="noreferrer"
                  className="bs-btn-secondary"
                  style={{ textDecoration: 'none' }}
                >
                  <span>Meta Developers</span>
                  <ExternalLink style={{ width: '13px', height: '13px' }} />
                </a>
              </div>
            </div>
          ) : (
            /* Connected State: Authentic Campaign Insights & Controls */
            <div className="bs-stacked-list">
              {/* Account Header */}
              <div className="bs-meta-account-bar">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="bs-status-dot" />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#34D399', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Connected</span>
                    <span style={{ color: 'var(--gacks-text-dim)' }}>·</span>
                    <span style={{ fontSize: '12px', color: '#EDEDEF', fontFamily: 'var(--gacks-font-mono)' }}>
                      {metaAccounts[0]?.name || 'Insight BS Main Ad Account'} ({metaAccounts[0]?.id || 'act_1020304050'})
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--gacks-text-muted)' }}>
                    Currency: {metaAccounts[0]?.currency || 'USD'} · Graph API v21.0
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => submitQuery('Draft a high-converting Meta ad copy variation for Insight Business Suite.')}
                    className="bs-btn-primary"
                  >
                    Draft Ad with Insight
                  </button>
                </div>
              </div>

              {/* Live Metrics Grid */}
              {metaCampaign ? (
                <>
                  <div className="bs-kpi-grid">
                    <div className="bs-kpi-card">
                      <div className="bs-kpi-top">
                        <span>Total Spend (30d)</span>
                        <DollarSign className="bs-kpi-icon" style={{ width: '16px', height: '16px' }} />
                      </div>
                      <div className="bs-kpi-value">
                        ${metaCampaign.spendUsd.toLocaleString()}
                      </div>
                      <div className="bs-kpi-meta">
                        <span>Live Meta spend</span>
                      </div>
                    </div>

                    <div className="bs-kpi-card">
                      <div className="bs-kpi-top">
                        <span>Impressions</span>
                        <Users className="bs-kpi-icon" style={{ width: '16px', height: '16px' }} />
                      </div>
                      <div className="bs-kpi-value" style={{ color: 'var(--gacks-cyan)' }}>
                        {metaCampaign.impressions.toLocaleString()}
                      </div>
                      <div className="bs-kpi-meta">
                        <span>{metaCampaign.clicks.toLocaleString()} clicks</span>
                      </div>
                    </div>

                    <div className="bs-kpi-card">
                      <div className="bs-kpi-top">
                        <span>Click-Through Rate</span>
                        <TrendingUp className="bs-kpi-icon" style={{ width: '16px', height: '16px' }} />
                      </div>
                      <div className="bs-kpi-value bs-kpi-value-emerald">
                        {metaCampaign.ctrPercent}%
                      </div>
                      <div className="bs-kpi-meta">
                        <span>CPC: ${metaCampaign.cpcUsd}</span>
                      </div>
                    </div>

                    <div className="bs-kpi-card">
                      <div className="bs-kpi-top">
                        <span>Return on Ad Spend</span>
                        <Layers className="bs-kpi-icon" style={{ width: '16px', height: '16px' }} />
                      </div>
                      <div className="bs-kpi-value bs-kpi-value-emerald">
                        {metaCampaign.roas}x
                      </div>
                      <div className="bs-kpi-meta">
                        <span>{metaCampaign.conversions} conversions</span>
                      </div>
                    </div>
                  </div>

                  {/* Active Campaigns Table */}
                  <div className="bs-table-wrap">
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--gacks-border-dim)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h3 className="bs-card-title">Active Ad Campaigns</h3>
                      <span className="bs-card-meta">1 Active Campaign</span>
                    </div>
                    <table className="bs-table">
                      <thead>
                        <tr>
                          <th>Campaign Name</th>
                          <th>Status</th>
                          <th>Spend</th>
                          <th>CTR</th>
                          <th>Conversions</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ fontWeight: 600, color: '#ffffff' }}>{metaCampaign.campaignName}</td>
                          <td>
                            <span className="bs-badge-impact bs-badge-impact-low" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34D399', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
                              {metaCampaign.status}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'var(--gacks-font-mono)', color: '#ffffff' }}>${metaCampaign.spendUsd}</td>
                          <td style={{ fontFamily: 'var(--gacks-font-mono)', color: '#34D399' }}>{metaCampaign.ctrPercent}%</td>
                          <td style={{ fontFamily: 'var(--gacks-font-mono)', color: '#ffffff' }}>{metaCampaign.conversions}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => submitQuery(`Update budget for campaign ${metaCampaign.campaignId} to $50/day`)}
                              className="bs-btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '11px' }}
                            >
                              Adjust Budget
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="bs-card" style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--gacks-text-muted)' }}>
                  Connected to Meta Ad Account. No active campaigns found.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 5: Marketing & Campaigns */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* VIEW 5: Marketing & Campaigns */}
      {/* ========================================================================= */}
      {activeTab === 'marketing' && (
        <div className="bs-stacked-list">
          <div className="bs-kpi-grid">
            <div className="bs-kpi-card">
              <div className="bs-kpi-top">
                <span>Marketing Pipeline</span>
                <Layers className="bs-kpi-icon" style={{ width: '16px', height: '16px' }} />
              </div>
              <div className="bs-kpi-value" style={{ fontSize: '20px' }}>Multi-Channel</div>
              <div className="bs-kpi-meta">
                <span>Meta, Email, SEO</span>
              </div>
            </div>
            <div className="bs-kpi-card">
              <div className="bs-kpi-top">
                <span>Active Audience Reach</span>
                <Users className="bs-kpi-icon" style={{ width: '16px', height: '16px' }} />
              </div>
              <div className="bs-kpi-value" style={{ color: 'var(--gacks-cyan)' }}>48,200</div>
              <div className="bs-kpi-meta">
                <span>Total 30d impressions</span>
              </div>
            </div>
            <div className="bs-kpi-card">
              <div className="bs-kpi-top">
                <span>Target CAC</span>
                <DollarSign className="bs-kpi-icon" style={{ width: '16px', height: '16px' }} />
              </div>
              <div className="bs-kpi-value bs-kpi-value-emerald">$10.85</div>
              <div className="bs-kpi-meta">
                <span>Within target threshold</span>
              </div>
            </div>
            <div className="bs-kpi-card">
              <div className="bs-kpi-top">
                <span>Ad Guardrail Policy</span>
                <ShieldCheck className="bs-kpi-icon" style={{ width: '16px', height: '16px' }} />
              </div>
              <div className="bs-kpi-value bs-kpi-value-amber">Active</div>
              <div className="bs-kpi-meta">
                <span>Approval Center gating enabled</span>
              </div>
            </div>
          </div>

          <div className="bs-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 className="bs-card-title">
              <Sparkles className="bs-kpi-icon" style={{ width: '18px', height: '18px' }} />
              <span>Draft New Campaign with Insight Marketing Agent</span>
            </h3>
            <p className="bs-card-meta" style={{ lineHeight: 1.5 }}>
              Insight prepares campaign positioning, target audience segments, ad copy variations, and queues financial authorization requests in the Approval Center before any ad spend occurs.
            </p>
            <div>
              <button
                type="button"
                onClick={() => submitQuery('Draft a high-converting Meta Ad campaign for our AI business suite.')}
                className="bs-btn-primary"
              >
                Ask Insight to Draft Campaign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 6: Forex Analysis Auditor */}
      {/* ========================================================================= */}
      {activeTab === 'forex' && (
        <div className="bs-forex-grid">
          <form onSubmit={handleRunForexAudit} className="bs-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 className="bs-card-title">
              <TrendingUp className="bs-kpi-icon" style={{ width: '18px', height: '18px' }} />
              <span>Audit Proposed Trade Plan</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="bs-form-group">
                <label className="bs-label">Currency Pair / Asset</label>
                <input
                  type="text"
                  value={forexPair}
                  onChange={(e) => setForexPair(e.target.value)}
                  className="bs-input"
                />
              </div>

              <div className="bs-direction-toggle">
                <button
                  type="button"
                  onClick={() => setForexDirection('LONG')}
                  className={`bs-direction-btn ${
                    forexDirection === 'LONG' ? 'bs-direction-btn-long-active' : 'bs-direction-btn-inactive'
                  }`}
                >
                  LONG
                </button>
                <button
                  type="button"
                  onClick={() => setForexDirection('SHORT')}
                  className={`bs-direction-btn ${
                    forexDirection === 'SHORT' ? 'bs-direction-btn-short-active' : 'bs-direction-btn-inactive'
                  }`}
                >
                  SHORT
                </button>
              </div>

              <div className="bs-form-group">
                <label className="bs-label">Entry Price</label>
                <input
                  type="number"
                  step="any"
                  value={forexEntry}
                  onChange={(e) => setForexEntry(Number(e.target.value))}
                  className="bs-input"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="bs-form-group">
                  <label className="bs-label">Stop Loss</label>
                  <input
                    type="number"
                    step="any"
                    value={forexStop}
                    onChange={(e) => setForexStop(Number(e.target.value))}
                    className="bs-input"
                  />
                </div>
                <div className="bs-form-group">
                  <label className="bs-label">Take Profit</label>
                  <input
                    type="number"
                    step="any"
                    value={forexTp}
                    onChange={(e) => setForexTp(Number(e.target.value))}
                    className="bs-input"
                  />
                </div>
              </div>

              <div className="bs-form-group">
                <label className="bs-label">Risk % (Max 2%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={forexRisk}
                  onChange={(e) => setForexRisk(Number(e.target.value))}
                  className="bs-input"
                />
              </div>
            </div>

            <button
              type="submit"
              className="bs-btn-primary"
              style={{ width: '100%', marginTop: '4px' }}
            >
              Run Audit Analysis
            </button>
          </form>

          {/* Audit Result Display */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {forexResult ? (
              <div className="bs-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--gacks-border-dim)', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
                      Audit Report: {forexResult.pair} ({forexResult.direction})
                    </h4>
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--gacks-text-muted)' }}>Position Size: {forexResult.positionSizeLots} standard lots</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontFamily: 'var(--gacks-font-mono)', fontWeight: 700, color: '#34D399' }}>
                      R:R = 1:{forexResult.riskRewardRatio}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--gacks-text-muted)' }}>Risk Allocation: {forexResult.riskPercent}%</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h5 style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#34D399' }}>Validated Strengths:</h5>
                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#EDEDEF' }}>
                    {forexResult.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>

                {forexResult.riskFlags.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <h5 style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#FCD34D' }}>Identified Risk Flags:</h5>
                    <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#EDEDEF' }}>
                      {forexResult.riskFlags.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="bs-forex-disclaimer">
                  {forexResult.safetyDisclaimer}
                </div>
              </div>
            ) : (
              <div className="bs-card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--gacks-text-muted)', fontSize: '13px' }}>
                Enter trade parameters to audit risk-to-reward alignment, position sizing, and invalidation rules.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 7: Automations & Workflow Rules */}
      {/* ========================================================================= */}
      {activeTab === 'automations' && (
        <div className="bs-stacked-list">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <h2 className="bs-card-title">
              <Activity className="bs-kpi-icon" style={{ width: '18px', height: '18px' }} />
              <span>Active Business Automations</span>
            </h2>
            <button
              type="button"
              onClick={() => submitQuery('Show me our automated business workflow status.')}
              className="bs-btn-secondary"
              style={{ padding: '6px 12px', fontSize: '11px' }}
            >
              Consult Insight
            </button>
          </div>

          <div className="bs-automations-grid">
            <div className="bs-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>Daily Operations Briefing</h4>
                <span className="bs-badge-impact bs-badge-impact-low" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34D399', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
                  SCHEDULED
                </span>
              </div>
              <p className="bs-card-meta" style={{ lineHeight: 1.5 }}>
                Generates morning executive briefing with MRR pacing and priority tasks at 08:00 UTC daily.
              </p>
            </div>

            <div className="bs-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>Ad Spend Guardrail Gate</h4>
                <span className="bs-badge-impact bs-badge-impact-low" style={{ background: 'rgba(0, 163, 255, 0.2)', color: '#7DD3FC', borderColor: 'rgba(0, 163, 255, 0.4)' }}>
                  GUARDRAIL
                </span>
              </div>
              <p className="bs-card-meta" style={{ lineHeight: 1.5 }}>
                Automatically routes any Meta ad campaign or budget change over $100 to the Human-in-the-Loop Approval Center.
              </p>
            </div>

            <div className="bs-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>Customer Churn Sentinel</h4>
                <span className="bs-badge-impact bs-badge-impact-medium">
                  SENTINEL
                </span>
              </div>
              <p className="bs-card-meta" style={{ lineHeight: 1.5 }}>
                Flags accounts with negative sentiment or overdue communications when LTV exceeds $5,000.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
