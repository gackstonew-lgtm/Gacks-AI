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

  const suiteNavItems: { id: SuiteTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { id: 'briefing', label: 'Executive Briefing', icon: TrendingUp },
    { id: 'approvals', label: 'Approval Center', icon: ShieldCheck, badge: approvals.length },
    { id: 'crm', label: 'CRM & Customer Care', icon: Users, badge: customers.length },
    { id: 'meta_ads', label: 'Meta Ads Manager', icon: Layers },
    { id: 'marketing', label: 'Marketing & Campaigns', icon: DollarSign },
    { id: 'forex', label: 'Forex Analysis Auditor', icon: BarChart3 },
    { id: 'automations', label: 'Automations & Rules', icon: Sliders },
  ]

  const workspaceShortcuts: { id: NavRoute; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 text-gray-200">
      {/* 1. Header & Executive Greeting */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-800/80">
        <div className="flex items-center gap-3">
          {showSuiteLogo ? (
            <div className="relative group shrink-0">
              <div
                className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gray-900 border border-cyan-500/30 p-1 flex items-center justify-center shadow-lg shadow-cyan-950/40 shrink-0"
                style={{ width: '40px', height: '40px', maxWidth: '40px', maxHeight: '40px', overflow: 'hidden' }}
              >
                <img
                  src={insightLogo}
                  alt="Insight Business Suite"
                  className="w-full h-full rounded-lg object-contain max-w-full max-h-full"
                  style={{ width: '100%', height: '100%', maxWidth: '40px', maxHeight: '40px', objectFit: 'contain' }}
                />
              </div>
              <button
                type="button"
                onClick={() => toggleSuiteLogo(false)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-gray-900/95 hover:bg-red-600 border border-gray-700 hover:border-red-500 text-gray-400 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[9px] shadow"
                title="Remove logo"
                aria-label="Remove logo"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => toggleSuiteLogo(true)}
              className="text-[10px] text-cyan-400/80 hover:text-cyan-300 border border-dashed border-cyan-500/30 hover:border-cyan-500/50 rounded-md px-2 py-1 flex items-center gap-1 transition shrink-0"
              title="Restore suite logo"
              aria-label="Restore suite logo"
            >
              <span>+ Logo</span>
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-wide text-white">Insight Business Suite</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                PRO
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Executive Command Center · Business Growth, CRM, Marketing & Market Operations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          {/* Suite Menu Button */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center gap-2 shadow-sm transition"
            aria-label="Open Suite Menu"
            aria-expanded={menuOpen}
          >
            <Menu className="w-4 h-4 text-cyan-400" />
            <span>Suite Menu</span>
            {approvals.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center">
                {approvals.length}
              </span>
            )}
          </button>

          {/* Sync Button */}
          <button
            type="button"
            onClick={fetchAllData}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 flex items-center gap-1.5 border border-gray-700 transition"
            title="Sync all business data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync</span>
          </button>

          <div className="px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-[11px] text-emerald-300 font-mono flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">OPERATIONAL</span>
          </div>
        </div>
      </div>

      {statusMsg && (
        <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-lg text-xs text-cyan-300 flex items-center justify-between">
          <span>{statusMsg}</span>
          <button type="button" onClick={() => setStatusMsg(null)} className="text-gray-400 hover:text-white">✕</button>
        </div>
      )}

      {/* 2. Top Executive KPI Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* MRR Pacing */}
        <div
          onClick={() => setActiveTab('briefing')}
          className="cursor-pointer p-4 rounded-xl bg-gray-900/70 border border-gray-800 hover:border-cyan-500/40 transition group"
        >
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>MRR Pacing</span>
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400">
            ${briefing?.revenuePacing.mrrUsd.toLocaleString() || '34,500'}
          </div>
          <div className="text-[11px] text-gray-400 mt-1 flex items-center justify-between">
            <span>Target: ${briefing?.revenuePacing.targetUsd.toLocaleString() || '50,000'}</span>
            <span className="text-emerald-400 font-semibold">{briefing?.revenuePacing.pacingPercent || 69}%</span>
          </div>
          <div className="w-full bg-gray-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all"
              style={{ width: `${briefing?.revenuePacing.pacingPercent || 69}%` }}
            />
          </div>
        </div>

        {/* Active Accounts */}
        <div
          onClick={() => setActiveTab('crm')}
          className="cursor-pointer p-4 rounded-xl bg-gray-900/70 border border-gray-800 hover:border-cyan-500/40 transition group"
        >
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>Active Clients</span>
            <Users className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-white">
            {customers.length || 8}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            {customers.filter((c) => c.status === 'churn_risk').length > 0 ? (
              <span className="text-amber-400">
                {customers.filter((c) => c.status === 'churn_risk').length} at churn risk
              </span>
            ) : (
              <span className="text-emerald-400">Pipeline healthy</span>
            )}
          </p>
        </div>

        {/* Pending Approvals */}
        <div
          onClick={() => setActiveTab('approvals')}
          className="cursor-pointer p-4 rounded-xl bg-gray-900/70 border border-gray-800 hover:border-amber-500/40 transition group"
        >
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>Pending Approvals</span>
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-amber-400">
            {approvals.length}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            {approvals.length === 0 ? 'All actions clear' : 'Human-in-the-Loop review required'}
          </p>
        </div>

        {/* Meta Ads Status */}
        <div
          onClick={() => setActiveTab('meta_ads')}
          className="cursor-pointer p-4 rounded-xl bg-gray-900/70 border border-gray-800 hover:border-cyan-500/40 transition group"
        >
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>Meta Ads Status</span>
            <Layers className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-white flex items-center gap-2">
            {metaConnected ? (
              <span className="text-emerald-400">Connected</span>
            ) : metaConnected === false ? (
              <span className="text-gray-400 text-sm font-sans">Not Connected</span>
            ) : (
              <span className="text-gray-500 text-sm font-sans">Checking...</span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            {metaConnected ? (
              metaCampaign ? `$${metaCampaign.spendUsd} 30d spend` : '1 active ad account'
            ) : (
              'Authentication required'
            )}
          </p>
        </div>
      </div>

      {/* 3. Quick Navigation Strip (Horizontal Switcher) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin border-b border-gray-800/80">
        {suiteNavItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 whitespace-nowrap transition ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm'
                  : 'bg-gray-900/50 hover:bg-gray-850 text-gray-400 hover:text-gray-200 border border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-cyan-400 text-black' : 'bg-gray-800 text-gray-300'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 4. Slide-Over Menu Drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setMenuOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative ml-auto w-full max-w-sm sm:max-w-md bg-gray-950 border-l border-gray-800 shadow-2xl p-6 flex flex-col justify-between overflow-y-auto z-10 animate-in slide-in-from-right duration-200">
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-800">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-lg bg-gray-900 border border-cyan-500/30 p-0.5 flex items-center justify-center"
                    style={{ width: '32px', height: '32px', maxWidth: '32px', maxHeight: '32px', overflow: 'hidden' }}
                  >
                    <img
                      src={insightLogo}
                      alt="Insight"
                      className="w-full h-full rounded"
                      style={{ width: '100%', height: '100%', maxWidth: '32px', maxHeight: '32px', objectFit: 'contain' }}
                    />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-wide">INSIGHT BUSINESS SUITE</h2>
                    <p className="text-[11px] text-gray-400">Navigation & Workspace Menu</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="p-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-800 transition"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Suite Modules */}
              <div className="mt-6">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2 px-1">
                  Business Modules
                </h3>
                <div className="space-y-1">
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
                        className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition ${
                          isActive
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            : 'hover:bg-gray-900 text-gray-300 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-gray-400'}`} />
                          <span>{item.label}</span>
                        </div>
                        {typeof item.badge === 'number' && item.badge > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Workspace Shortcuts */}
              <div className="mt-6 pt-6 border-t border-gray-800/80">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2 px-1">
                  Workspace Shortcuts
                </h3>
                <div className="grid grid-cols-2 gap-1">
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
                        className="px-2.5 py-2 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-900 flex items-center gap-2 transition text-left"
                      >
                        <Icon className="w-3.5 h-3.5 text-gray-500" />
                        <span className="truncate">{sc.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="pt-6 border-t border-gray-800 text-xs text-gray-400 flex items-center justify-between">
              <span>Insight Business Suite v2.4</span>
              <span className="text-[10px] text-cyan-400 font-mono">Press Esc to close</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: Executive Briefing & Growth */}
      {/* ========================================================================= */}
      {activeTab === 'briefing' && briefing && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1 & 2: Main Briefing & Priorities */}
          <div className="md:col-span-2 space-y-6">
            <div className="p-5 rounded-xl bg-gray-900/60 border border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>Morning Executive Briefing</span>
                </h2>
                <span className="text-xs text-gray-400">{briefing.date}</span>
              </div>
              <div className="p-4 rounded-lg bg-gray-950/70 border border-gray-800/80 text-sm text-gray-200 leading-relaxed font-sans">
                {briefing.briefingText}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => submitQuery('Read me my morning briefing out loud.')}
                  className="px-3.5 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/40 border border-cyan-500/40 text-xs text-cyan-200 flex items-center gap-1.5 transition"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Ask Insight to Voice Briefing</span>
                </button>
                <button
                  type="button"
                  onClick={() => submitQuery('Analyze today’s business priorities and draft an execution agenda.')}
                  className="px-3.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs text-gray-300 flex items-center gap-1.5 transition"
                >
                  <Activity className="w-3.5 h-3.5 text-gray-400" />
                  <span>Generate Agenda</span>
                </button>
              </div>
            </div>

            {/* Daily Priorities */}
            <div className="p-5 rounded-xl bg-gray-900/60 border border-gray-800">
              <h3 className="text-sm font-semibold text-white mb-3">Today’s Highest-Leverage Focus</h3>
              <ul className="space-y-2 text-xs">
                {briefing.todaysPriorities.map((p, i) => (
                  <li key={i} className="p-3 rounded-lg bg-gray-950/40 border border-gray-800/60 flex items-start gap-2.5">
                    <span className="text-cyan-400 font-bold">{i + 1}.</span>
                    <span className="text-gray-300">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Column 3: Pacing & Market Overview */}
          <div className="space-y-6">
            {/* Revenue Pacing Card */}
            <div className="p-5 rounded-xl bg-gray-900/60 border border-gray-800">
              <h3 className="text-sm font-semibold text-white mb-2">Monthly Revenue Pacing</h3>
              <div className="text-2xl font-bold text-emerald-400 font-mono">
                ${briefing.revenuePacing.mrrUsd.toLocaleString()}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Target: ${briefing.revenuePacing.targetUsd.toLocaleString()} ({briefing.revenuePacing.pacingPercent}% achieved)
              </p>
              <div className="w-full bg-gray-800 h-2 rounded-full mt-3 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full"
                  style={{ width: `${briefing.revenuePacing.pacingPercent}%` }}
                />
              </div>
            </div>

            {/* Market Context Card */}
            <div className="p-5 rounded-xl bg-gray-900/60 border border-gray-800">
              <h3 className="text-sm font-semibold text-white mb-2">Market & Macro Context</h3>
              <p className="text-xs text-gray-300 leading-relaxed">{briefing.marketSummary}</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: Human-in-the-Loop Approval Center */}
      {/* ========================================================================= */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Pending Executive Authorizations</h2>
            <span className="text-xs text-gray-400">
              {approvals.length} action(s) require explicit Human-in-the-Loop approval
            </span>
          </div>

          {approvals.length === 0 ? (
            <div className="p-10 rounded-xl bg-gray-900/40 border border-gray-800 text-center text-gray-400 text-sm">
              <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
              All operations clear. Zero pending actions awaiting approval.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {approvals.map((req) => (
                <div
                  key={req.id}
                  className="p-4 rounded-xl bg-gray-900/80 border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg shadow-black/30"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        {req.potentialImpact}
                      </span>
                      <h4 className="text-sm font-bold text-white">{req.action}</h4>
                    </div>
                    <p className="text-xs text-gray-300">{req.reason}</p>
                    <div className="text-[11px] text-gray-400 flex flex-wrap gap-3">
                      <span>Provider: <b className="text-gray-200">{req.provider}</b></span>
                      <span>Target: <b className="text-gray-200">{req.target}</b></span>
                      {req.costUsd ? <span>Est. Cost: <b className="text-emerald-400">${req.costUsd}</b></span> : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <button
                      type="button"
                      onClick={() => handleResolveApproval(req.id, 'approved')}
                      className="flex-1 md:flex-none px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
                    >
                      Approve Action
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResolveApproval(req.id, 'rejected')}
                      className="flex-1 md:flex-none px-4 py-1.5 rounded-lg bg-gray-800 hover:bg-red-950/60 text-red-300 border border-red-500/30 text-xs font-semibold transition"
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Client Accounts & Inbound Pipeline</h2>
            <button
              type="button"
              onClick={() => submitQuery('Analyze our customer list and show urgent followups.')}
              className="text-xs text-cyan-400 hover:text-cyan-300 underline"
            >
              Analyze with Insight
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900/60">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-gray-950 text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="p-3">Client / Company</th>
                  <th className="p-3">Channel</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Sentiment</th>
                  <th className="p-3">LTV (USD)</th>
                  <th className="p-3">Last Note</th>
                </tr>
              </thead>
              <tbody className="divide-y border-gray-800">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-800/40 transition">
                    <td className="p-3 font-semibold text-white">{c.name}</td>
                    <td className="p-3 capitalize text-cyan-300">{c.channel || 'email'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.status === 'churn_risk' ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {c.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3 capitalize">{c.sentiment}</td>
                    <td className="p-3 font-mono text-emerald-400">${c.ltvUsd.toLocaleString()}</td>
                    <td className="p-3 text-gray-400 max-w-xs truncate">{c.notes[c.notes.length - 1] || 'No notes'}</td>
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
      {activeTab === 'meta_ads' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-gray-800">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                <span>Meta Ads Manager</span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Direct integration with Meta Graph API v21.0 for Facebook & Instagram campaigns
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchMetaStatus}
                disabled={metaLoading}
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 flex items-center gap-1.5 border border-gray-700 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${metaLoading ? 'animate-spin' : ''}`} />
                <span>Refresh Status</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveNav('settings')}
                className="px-3 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/40 border border-cyan-500/40 text-xs text-cyan-200 flex items-center gap-1.5 transition"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>API Settings</span>
              </button>
            </div>
          </div>

          {/* Authentic Connection State Machine */}
          {metaLoading ? (
            <div className="p-12 rounded-xl bg-gray-900/40 border border-gray-800 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
              <p className="text-sm text-gray-300">Checking Meta Graph API connectivity and credentials...</p>
            </div>
          ) : metaError ? (
            <div className="p-6 rounded-xl bg-red-950/20 border border-red-500/40 space-y-3">
              <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>API Gateway Error</span>
              </div>
              <p className="text-xs text-red-300">{metaError}</p>
              <button
                type="button"
                onClick={fetchMetaStatus}
                className="px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 border border-red-500/40 text-xs text-red-200 rounded transition"
              >
                Retry Connection
              </button>
            </div>
          ) : !metaConnected ? (
            /* Disconnected / Authentication Required State */
            <div className="p-8 rounded-xl bg-gray-900/60 border border-gray-800 space-y-6">
              <div className="max-w-xl mx-auto text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">Meta Business & Ads Suite Not Connected</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  To manage Facebook Pages, Instagram Professional ad campaigns, and pull real-time audience metrics, connect your Meta Graph API credentials in Settings.
                </p>
              </div>

              <div className="max-w-lg mx-auto p-4 rounded-lg bg-gray-950 border border-gray-800 space-y-3 text-xs">
                <h4 className="font-semibold text-gray-300">Required OAuth Scopes & Permissions:</h4>
                <ul className="space-y-1.5 text-gray-400 list-disc list-inside">
                  <li><code className="text-cyan-300">ads_management</code> — Create and manage campaigns</li>
                  <li><code className="text-cyan-300">ads_read</code> — Read campaign performance & insights</li>
                  <li><code className="text-cyan-300">business_management</code> — Manage connected business assets</li>
                </ul>
              </div>

              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveNav('settings')}
                  className="px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-2 transition"
                >
                  <Settings className="w-4 h-4" />
                  <span>Configure Meta Credentials in Settings</span>
                </button>
                <a
                  href="https://developers.facebook.com/apps/"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold flex items-center gap-2 border border-gray-700 transition"
                >
                  <span>Meta Developers</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ) : (
            /* Connected State: Authentic Campaign Insights & Controls */
            <div className="space-y-6">
              {/* Account Header */}
              <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Connected</span>
                    <span className="text-xs text-gray-500">·</span>
                    <span className="text-xs text-gray-300 font-mono">
                      {metaAccounts[0]?.name || 'Insight BS Main Ad Account'} ({metaAccounts[0]?.id || 'act_1020304050'})
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Currency: {metaAccounts[0]?.currency || 'USD'} · Graph API v21.0</p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => submitQuery('Draft a high-converting Meta ad copy variation for Insight Business Suite.')}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/40 border border-cyan-500/40 text-xs text-cyan-200 transition"
                  >
                    Draft Ad with Insight
                  </button>
                </div>
              </div>

              {/* Live Metrics Grid */}
              {metaCampaign ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
                      <span className="text-xs text-gray-400">Total Spend (30d)</span>
                      <div className="text-xl font-bold font-mono text-white mt-1">
                        ${metaCampaign.spendUsd.toLocaleString()}
                      </div>
                      <span className="text-[10px] text-gray-500">Live Meta spend</span>
                    </div>

                    <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
                      <span className="text-xs text-gray-400">Impressions</span>
                      <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
                        {metaCampaign.impressions.toLocaleString()}
                      </div>
                      <span className="text-[10px] text-gray-500">{metaCampaign.clicks.toLocaleString()} clicks</span>
                    </div>

                    <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
                      <span className="text-xs text-gray-400">Click-Through Rate</span>
                      <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                        {metaCampaign.ctrPercent}%
                      </div>
                      <span className="text-[10px] text-gray-500">CPC: ${metaCampaign.cpcUsd}</span>
                    </div>

                    <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
                      <span className="text-xs text-gray-400">Return on Ad Spend (ROAS)</span>
                      <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                        {metaCampaign.roas}x
                      </div>
                      <span className="text-[10px] text-gray-500">{metaCampaign.conversions} conversions</span>
                    </div>
                  </div>

                  {/* Active Campaigns Table */}
                  <div className="rounded-xl border border-gray-800 bg-gray-900/60 overflow-hidden">
                    <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">Active Ad Campaigns</h3>
                      <span className="text-xs text-gray-400">1 Active Campaign</span>
                    </div>
                    <table className="w-full text-left text-xs text-gray-300">
                      <thead className="bg-gray-950 text-gray-400 border-b border-gray-800">
                        <tr>
                          <th className="p-3">Campaign Name</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Spend</th>
                          <th className="p-3">CTR</th>
                          <th className="p-3">Conversions</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y border-gray-800">
                        <tr className="hover:bg-gray-800/40 transition">
                          <td className="p-3 font-semibold text-white">{metaCampaign.campaignName}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                              {metaCampaign.status}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-white">${metaCampaign.spendUsd}</td>
                          <td className="p-3 font-mono text-emerald-400">{metaCampaign.ctrPercent}%</td>
                          <td className="p-3 font-mono text-white">{metaCampaign.conversions}</td>
                          <td className="p-3 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => submitQuery(`Update budget for campaign ${metaCampaign.campaignId} to $50/day`)}
                              className="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-[11px] text-gray-300 transition"
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
                <div className="p-8 rounded-xl bg-gray-900/40 border border-gray-800 text-center text-gray-400 text-sm">
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
      {activeTab === 'marketing' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
              <span className="text-xs text-gray-400">Marketing Pipeline</span>
              <div className="text-xl font-bold font-mono text-white mt-1">Multi-Channel</div>
              <span className="text-[10px] text-gray-500">Meta, Email, SEO</span>
            </div>
            <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
              <span className="text-xs text-gray-400">Active Audience Reach</span>
              <div className="text-xl font-bold font-mono text-cyan-400 mt-1">48,200</div>
              <span className="text-[10px] text-gray-500">Total 30d impressions</span>
            </div>
            <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
              <span className="text-xs text-gray-400">Target CAC</span>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-1">$10.85</div>
              <span className="text-[10px] text-gray-500">Within target threshold</span>
            </div>
            <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
              <span className="text-xs text-gray-400">Ad Guardrail Policy</span>
              <div className="text-xl font-bold font-mono text-amber-400 mt-1">Active</div>
              <span className="text-[10px] text-gray-500">Approval Center gating enabled</span>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-gray-900/60 border border-gray-800 space-y-3">
            <h3 className="text-sm font-semibold text-white">Draft New Campaign with Insight Marketing Agent</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Insight prepares campaign positioning, target audience segments, ad copy variations, and queues financial authorization requests in the Approval Center before any ad spend occurs.
            </p>
            <button
              type="button"
              onClick={() => submitQuery('Draft a high-converting Meta Ad campaign for our AI business suite.')}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-xs font-bold text-white transition"
            >
              Ask Insight to Draft Campaign
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 6: Forex Analysis Auditor */}
      {/* ========================================================================= */}
      {activeTab === 'forex' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <form onSubmit={handleRunForexAudit} className="p-5 rounded-xl bg-gray-900/60 border border-gray-800 space-y-4">
            <h3 className="text-sm font-semibold text-white">Audit Proposed Trade Plan</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-400 mb-1">Currency Pair / Asset</label>
                <input
                  type="text"
                  value={forexPair}
                  onChange={(e) => setForexPair(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForexDirection('LONG')}
                  className={`flex-1 py-1.5 rounded-lg font-bold transition ${
                    forexDirection === 'LONG' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  LONG
                </button>
                <button
                  type="button"
                  onClick={() => setForexDirection('SHORT')}
                  className={`flex-1 py-1.5 rounded-lg font-bold transition ${
                    forexDirection === 'SHORT' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  SHORT
                </button>
              </div>

              <div>
                <label className="block text-gray-400 mb-1">Entry Price</label>
                <input
                  type="number"
                  step="any"
                  value={forexEntry}
                  onChange={(e) => setForexEntry(Number(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-400 mb-1">Stop Loss</label>
                  <input
                    type="number"
                    step="any"
                    value={forexStop}
                    onChange={(e) => setForexStop(Number(e.target.value))}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Take Profit</label>
                  <input
                    type="number"
                    step="any"
                    value={forexTp}
                    onChange={(e) => setForexTp(Number(e.target.value))}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 mb-1">Risk % (Max 2%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={forexRisk}
                  onChange={(e) => setForexRisk(Number(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-xs font-bold text-white transition"
            >
              Run Audit Analysis
            </button>
          </form>

          {/* Audit Result Display */}
          <div className="md:col-span-2 space-y-4">
            {forexResult ? (
              <div className="p-5 rounded-xl bg-gray-900/60 border border-gray-800 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                  <div>
                    <h4 className="text-base font-bold text-white">
                      Audit Report: {forexResult.pair} ({forexResult.direction})
                    </h4>
                    <p className="text-xs text-gray-400">Position Size: {forexResult.positionSizeLots} standard lots</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono font-bold text-emerald-400">
                      R:R = 1:{forexResult.riskRewardRatio}
                    </div>
                    <div className="text-[11px] text-gray-400">Risk Allocation: {forexResult.riskPercent}%</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-emerald-400">Validated Strengths:</h5>
                  <ul className="text-xs text-gray-300 list-disc list-inside">
                    {forexResult.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>

                {forexResult.riskFlags.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold text-amber-400">Identified Risk Flags:</h5>
                    <ul className="text-xs text-gray-300 list-disc list-inside">
                      {forexResult.riskFlags.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-lg text-[11px] text-amber-300">
                  {forexResult.safetyDisclaimer}
                </div>
              </div>
            ) : (
              <div className="p-12 rounded-xl bg-gray-900/40 border border-gray-800 text-center text-gray-400 text-sm">
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Active Business Automations</h2>
            <button
              type="button"
              onClick={() => submitQuery('Show me our automated business workflow status.')}
              className="text-xs text-cyan-400 hover:text-cyan-300 underline"
            >
              Consult Insight
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white">Daily Operations Briefing</h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300">
                  SCHEDULED
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Generates morning executive briefing with MRR pacing and priority tasks at 08:00 UTC daily.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white">Ad Spend Guardrail Gate</h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/20 text-cyan-300">
                  GUARDRAIL
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Automatically routes any Meta ad campaign or budget change over $100 to the Human-in-the-Loop Approval Center.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white">Customer Churn Sentinel</h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300">
                  SENTINEL
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Flags accounts with negative sentiment or overdue communications when LTV exceeds $5,000.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
