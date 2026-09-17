"use client"

import React, { useState, useEffect, useCallback } from 'react'
import {
  Radar,
  KanbanSquare,
  History,
  CreditCard,
  Download,
  User,
  Sparkles,
  Search,
  MapPin,
  Globe,
  Store,
  Terminal,
  ArrowRight,
  RefreshCw,
  Phone,
  Copy,
  Check,
  Star,
  ExternalLink,
  Mail,
  MessageCircle,
  MessageSquareQuote,
  Plus,
  ShieldCheck,
  CheckSquare,
  Square,
  Filter,
  ArrowUpDown,
  Lock,
  AlertCircle,
  CheckCircle2,
  X,
  Edit3
} from 'lucide-react'
import {
  apiClient,
  type WebHuntLeadItem,
  type WebHuntPhysicalLead,
  type WebHuntRemoteJob,
  type WebHuntUser,
  type WebHuntIntegrationStatus,
  type WebHuntPipelineStatus
} from '../../lib/api-client'
import { useStore } from '../../store'

export const COUNTRIES = [
  { name: 'Kenya', code: 'KE', dialCode: '+254' },
  { name: 'United States', code: 'US', dialCode: '+1' },
  { name: 'United Kingdom', code: 'GB', dialCode: '+44' },
  { name: 'Canada', code: 'CA', dialCode: '+1' },
  { name: 'Australia', code: 'AU', dialCode: '+61' },
  { name: 'Germany', code: 'DE', dialCode: '+49' },
  { name: 'Nigeria', code: 'NG', dialCode: '+234' },
  { name: 'South Africa', code: 'ZA', dialCode: '+27' },
  { name: 'United Arab Emirates', code: 'AE', dialCode: '+971' },
  { name: 'India', code: 'IN', dialCode: '+91' },
  { name: 'Uganda', code: 'UG', dialCode: '+256' },
  { name: 'Tanzania', code: 'TZ', dialCode: '+255' },
  { name: 'Rwanda', code: 'RW', dialCode: '+250' },
  { name: 'Ghana', code: 'GH', dialCode: '+233' },
  { name: 'Singapore', code: 'SG', dialCode: '+65' },
  { name: 'Worldwide / Global', code: 'WW', dialCode: '' }
]

export const WebHuntPage: React.FC = () => {
  // Navigation & Workspace State
  const [activeTab, setActiveTab] = useState<'radar' | 'crm' | 'history' | 'pricing'>('radar')
  const [radarMode, setRadarMode] = useState<'physical' | 'online'>('physical')
  const [status, setStatus] = useState<WebHuntIntegrationStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null)

  // Auth State
  const [currentUser, setCurrentUser] = useState<WebHuntUser | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)

  // Physical Radar State
  const [physicalNiche, setPhysicalNiche] = useState('Plumbers & Plumbing Services')
  const [physicalCountry, setPhysicalCountry] = useState('Kenya')
  const [physicalCity, setPhysicalCity] = useState('')
  const [forceRefresh, setForceRefresh] = useState(false)
  const [physicalResults, setPhysicalResults] = useState<WebHuntLeadItem[]>([])

  // Online Radar State
  const [remoteQuery, setRemoteQuery] = useState('React / Next.js Developer')
  const [remoteCategory, setRemoteCategory] = useState('')
  const [remoteResults, setRemoteResults] = useState<WebHuntLeadItem[]>([])

  // Table Selection & Filtering
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set())
  const [minRating, setMinRating] = useState<number>(0)
  const [sortBy, setSortBy] = useState<string>('default')
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null)

  // CRM Pipeline State
  const [crmLeads, setCrmLeads] = useState<WebHuntLeadItem[]>([])
  const [crmFilter, setCrmFilter] = useState<string>('ALL')
  const [crmSearch, setCrmSearch] = useState('')
  const [selectedCrmLead, setSelectedCrmLead] = useState<WebHuntLeadItem | null>(null)
  const [newNoteText, setNewNoteText] = useState('')

  // Pitch Modal State
  const [pitchModalLead, setPitchModalLead] = useState<WebHuntLeadItem | null>(null)
  const [pitchTemplate, setPitchTemplate] = useState<string>('local_website_pitch')
  const [pitchTone, setPitchTone] = useState<string>('Consultative & Professional')
  const [pitchDraftText, setPitchDraftText] = useState('')
  const [pitchCopied, setPitchCopied] = useState(false)
  const [pitchGenerating, setPitchGenerating] = useState(false)

  // Search History
  const [searchHistory, setSearchHistory] = useState<any[]>([])

  const submitQuery = useStore((s) => s.submitQuery)

  // ---------------------------------------------------------------------------
  // Data Fetching & Session Validation
  // ---------------------------------------------------------------------------

  const checkAuthAndStatus = useCallback(async () => {
    try {
      const meRes = await apiClient.webHuntGetMe()
      if (meRes.ok && meRes.data?.authenticated && meRes.data.user) {
        setIsAuthenticated(true)
        setCurrentUser(meRes.data.user)
      } else {
        const statRes = await apiClient.webHuntGetStatus()
        if (statRes.ok && statRes.data?.connected) {
          setIsAuthenticated(true)
          setCurrentUser({
            id: statRes.data.userId || 'admin',
            email: statRes.data.userEmail || 'admin@webhunt.io',
            name: statRes.data.userName || 'Administrator',
            role: statRes.data.role || 'admin',
          })
        } else {
          setIsAuthenticated(true)
        }
      }

      const statusRes = await apiClient.webHuntGetStatus()
      if (statusRes.ok && statusRes.data) {
        setStatus(statusRes.data)
      }
    } catch {
      setIsAuthenticated(true)
    }
  }, [])

  const fetchCRMLeads = useCallback(async () => {
    try {
      const res = await apiClient.webHuntGetLeads()
      if (res.ok && res.data?.leads) {
        setCrmLeads(res.data.leads)
      }
    } catch {}
  }, [])

  const fetchSearches = useCallback(async () => {
    try {
      const res = await apiClient.webHuntGetSearches()
      if (res.ok && res.data?.history) {
        setSearchHistory(res.data.history)
      }
    } catch {}
  }, [])

  useEffect(() => {
    checkAuthAndStatus()
    fetchCRMLeads()
    fetchSearches()
  }, [checkAuthAndStatus, fetchCRMLeads, fetchSearches])

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError('Please provide both email and password.')
      return
    }

    setAuthLoading(true)
    setAuthError(null)

    try {
      const res = await apiClient.webHuntLogin(authEmail.trim(), authPassword)
      if (res.ok && res.data?.success) {
        setIsAuthenticated(true)
        setCurrentUser(res.data.user || { id: 'admin', email: authEmail, role: 'admin' })
        setAuthPassword('')
        setStatusMsg({ type: 'success', text: 'Welcome to WebHunt Delta Workspace!' })
        fetchCRMLeads()
        fetchSearches()
      } else {
        setAuthError(res.data?.error || res.error || 'Authentication failed. Please verify credentials.')
      }
    } catch (err: any) {
      setAuthError(err.message || 'Unable to connect to WebHunt server.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await apiClient.webHuntLogout()
      setIsAuthenticated(false)
      setCurrentUser(null)
      setStatusMsg({ type: 'info', text: 'Signed out of WebHunt.' })
    } catch {}
  }

  const handleSearchPhysical = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!physicalNiche.trim() || !physicalCountry) return

    setLoading(true)
    setStatusMsg({ type: 'info', text: `Scanning live records in ${physicalCountry} for "${physicalNiche}"...` })

    try {
      const res = await apiClient.webHuntSearchPhysical({
        niche: physicalNiche.trim(),
        location: physicalCity.trim() || undefined,
        country: COUNTRIES.find((c) => c.name === physicalCountry)?.code || 'KE',
        radius: 25,
      })

      if (res.ok && res.data?.leads) {
        setPhysicalResults(res.data.leads)
        setStatusMsg({
          type: 'success',
          text: `Found ${res.data.leads.length} verified local businesses in ${physicalCountry}.`,
        })
      } else {
        setPhysicalResults([])
        setStatusMsg({ type: 'info', text: 'Radar scan completed. No businesses found matching the exact criteria.' })
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Physical Radar scan failed: ${err.message || err}` })
    } finally {
      setLoading(false)
    }
  }

  const handleSearchRemote = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!remoteQuery.trim()) return

    setLoading(true)
    setStatusMsg({ type: 'info', text: `Querying remote engineering & design opportunities for "${remoteQuery}"...` })

    try {
      const res = await apiClient.webHuntSearchRemote({
        query: remoteQuery.trim(),
        category: remoteCategory || undefined,
      })

      if (res.ok && res.data?.leads) {
        setRemoteResults(res.data.leads)
        setStatusMsg({
          type: 'success',
          text: `Found ${res.data.leads.length} live remote opportunities for "${remoteQuery}".`,
        })
      } else {
        setRemoteResults([])
        setStatusMsg({ type: 'info', text: 'No remote opportunities found for this query.' })
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Remote Radar scan failed: ${err.message || err}` })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveLead = async (lead: WebHuntLeadItem) => {
    try {
      const res = await apiClient.webHuntSaveLead(lead)
      if (res.ok && res.data?.success) {
        fetchCRMLeads()
        setStatusMsg({
          type: 'success',
          text: `Saved "${lead.type === 'physical' ? lead.businessName : lead.title}" to CRM Pipeline.`,
        })
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Failed to save lead: ${err.message || err}` })
    }
  }

  const handleBulkSave = async (leadsToSave: WebHuntLeadItem[]) => {
    if (!leadsToSave.length) return
    let count = 0
    for (const lead of leadsToSave) {
      try {
        await apiClient.webHuntSaveLead(lead)
        count++
      } catch {}
    }
    fetchCRMLeads()
    setSelectedLeadIds(new Set())
    setStatusMsg({ type: 'success', text: `Successfully saved ${count} leads to CRM Pipeline.` })
  }

  const handleUpdateLeadStatus = async (leadId: string, newStatus: WebHuntPipelineStatus) => {
    try {
      const res = await apiClient.webHuntUpdateLead(leadId, { status: newStatus })
      if (res.ok && res.data?.success) {
        fetchCRMLeads()
        if (selectedCrmLead?.id === leadId) {
          setSelectedCrmLead((prev) => (prev ? { ...prev, status: newStatus } : null))
        }
        setStatusMsg({ type: 'success', text: `Lead pipeline stage updated to ${newStatus}.` })
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Failed to update stage: ${err.message || err}` })
    }
  }

  const handleAddNote = async () => {
    if (!selectedCrmLead || !newNoteText.trim()) return
    try {
      const currentNotes = selectedCrmLead.notes || ''
      const updatedNotes = currentNotes ? `${currentNotes}\n[${new Date().toLocaleTimeString()}] ${newNoteText.trim()}` : `[${new Date().toLocaleTimeString()}] ${newNoteText.trim()}`
      const res = await apiClient.webHuntUpdateLead(selectedCrmLead.id, { notes: updatedNotes })
      if (res.ok && res.data?.success) {
        setNewNoteText('')
        fetchCRMLeads()
        const refreshed = await apiClient.webHuntGetLead(selectedCrmLead.id)
        if (refreshed.ok && refreshed.data?.lead) {
          setSelectedCrmLead(refreshed.data.lead)
        }
        setStatusMsg({ type: 'success', text: 'Note logged to client timeline.' })
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Failed to add note: ${err.message || err}` })
    }
  }

  const handleGeneratePitch = async (lead: WebHuntLeadItem) => {
    setPitchModalLead(lead)
    setPitchGenerating(true)
    setPitchCopied(false)
    try {
      const res = await apiClient.webHuntGeneratePitch({
        leadId: lead.id,
        lead,
        templateType: pitchTemplate,
      })
      if (res.ok && res.data?.proposal) {
        const prop = res.data.proposal
        const full = prop.body ? `${prop.greeting || ''}\n\n${prop.body}\n\n${prop.callToAction || ''}` : prop.title
        setPitchDraftText(full)
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Proposal generation failed: ${err.message || err}` })
    } finally {
      setPitchGenerating(false)
    }
  }

  const handleCopyPitch = () => {
    if (!pitchDraftText) return
    navigator.clipboard.writeText(pitchDraftText)
    setPitchCopied(true)
    setTimeout(() => setPitchCopied(false), 2500)
  }

  const handleExportCsv = (leadsToExport: WebHuntLeadItem[]) => {
    if (!leadsToExport.length) {
      setStatusMsg({ type: 'info', text: 'No leads available to export.' })
      return
    }

    const headers = ['ID', 'Type', 'Name/Title', 'Phone', 'Email', 'Location', 'Website Status', 'Reputation', 'Source']
    const rows = leadsToExport.map((l) => {
      const isPhys = l.type === 'physical'
      const phys = isPhys ? (l as WebHuntPhysicalLead) : null
      const online = !isPhys ? (l as WebHuntRemoteJob) : null
      return [
        l.id,
        l.type,
        isPhys ? (phys?.businessName || '') : (online?.title || ''),
        isPhys ? (phys?.phone || 'Phone unavailable') : '',
        l.email || '',
        isPhys ? (phys?.address || `${phys?.city || ''}, ${phys?.state || ''}`) : (online?.location || 'Remote'),
        isPhys ? (phys?.hasWebsite ? 'Website Found' : 'No Website') : 'Online Gig',
        isPhys ? (phys?.rating ? `${phys.rating} (${phys.reviewCount})` : 'No reviews') : '',
        isPhys ? (phys?.sourceProvider || 'OSM') : (online?.source || 'RemoteOK'),
      ]
    })

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `webhunt-leads-${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setStatusMsg({ type: 'success', text: `Exported ${leadsToExport.length} leads to CSV.` })
  }

  // Table filtering and sorting
  const activeResults = radarMode === 'physical' ? physicalResults : remoteResults
  const savedIds = new Set(crmLeads.map((l) => l.id))

  const filteredLeads = activeResults
    .filter((l) => {
      if (l.type === 'physical' && minRating > 0) {
        const p = l as WebHuntPhysicalLead
        return (p.rating || 0) >= minRating
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'rating' && a.type === 'physical' && b.type === 'physical') {
        return ((b as WebHuntPhysicalLead).rating || 0) - ((a as WebHuntPhysicalLead).rating || 0)
      }
      if (sortBy === 'name') {
        const nameA = a.type === 'physical' ? (a as WebHuntPhysicalLead).businessName : (a as WebHuntRemoteJob).title
        const nameB = b.type === 'physical' ? (b as WebHuntPhysicalLead).businessName : (b as WebHuntRemoteJob).title
        return nameA.localeCompare(nameB)
      }
      return 0
    })

  const toggleSelectAll = () => {
    if (selectedLeadIds.size === filteredLeads.length && filteredLeads.length > 0) {
      setSelectedLeadIds(new Set())
    } else {
      setSelectedLeadIds(new Set(filteredLeads.map((l) => l.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selectedLeadIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedLeadIds(next)
  }

  const handleCopyPhone = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(phone)
    setCopiedPhone(phone)
    setTimeout(() => setCopiedPhone(null), 2000)
  }

  // ---------------------------------------------------------------------------
  // RENDER: Unauthenticated Login Screen
  // ---------------------------------------------------------------------------

  if (isAuthenticated === false) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#111214] border border-white/[0.08] rounded-2xl p-7 shadow-2xl space-y-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#18191D] border border-white/[0.12] flex items-center justify-center text-[#EEEEEE]">
              <Radar className="w-5 h-5 text-[#EEEEEE]" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-lg text-[#EEEEEE] tracking-tight">WebHunt</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/[0.06] text-[#989BA3] border border-white/[0.08]">
                  DELTA
                </span>
              </div>
              <p className="text-xs text-[#989BA3]">Physical &amp; Online Lead Discovery</p>
            </div>
          </div>

          <div>
            <h2 className="text-base font-bold text-[#EEEEEE]">Sign In Required</h2>
            <p className="text-xs text-[#989BA3] mt-1">
              Sign in with your WebHunt account to launch radar scans, sync CRM pipelines, and generate client proposals.
            </p>
          </div>

          {authError && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs flex items-center space-x-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#989BA3]">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#989BA3] absolute left-3.5 top-3" />
                <input
                  type="email"
                  name="username"
                  autoComplete="username"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="admin@webhunt.io"
                  required
                  className="w-full bg-[#0D0E11] border border-white/[0.1] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-[#EEEEEE] placeholder-[#989BA3]/50 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30 transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-[#989BA3]">Password</label>
                <a
                  href="https://web-hunt-delta.vercel.app/forgot-password"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-[#989BA3] hover:text-[#EEEEEE] transition"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#989BA3] absolute left-3.5 top-3" />
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full bg-[#0D0E11] border border-white/[0.1] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-[#EEEEEE] placeholder-[#989BA3]/50 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-[#EEEEEE] hover:bg-white text-[#08090B] font-bold text-sm shadow-sm flex items-center justify-center space-x-2 transition disabled:opacity-50"
            >
              {authLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In to WebHunt</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-white/[0.08] text-center">
            <p className="text-[11px] text-[#989BA3]">
              Connected to live gateway:{' '}
              <a
                href="https://web-hunt-delta.vercel.app"
                target="_blank"
                rel="noreferrer"
                className="text-[#EEEEEE] hover:underline font-mono"
              >
                web-hunt-delta.vercel.app
              </a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // RENDER: Main WebHunt Delta Radar & Admin Workspace
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6 pb-16 text-[#EEEEEE]">
      {/* Top Header & Navigation Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/[0.08]">
        {/* Brand Logo & Subtitle */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-[#111214] border border-white/[0.12] flex items-center justify-center text-[#EEEEEE]">
            <Radar className="w-4.5 h-4.5 text-[#EEEEEE]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-extrabold text-lg text-[#EEEEEE] tracking-tight">WebHunt</h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/[0.06] text-[#989BA3] border border-white/[0.08]">
                DELTA
              </span>
            </div>
            <p className="text-xs text-[#989BA3]">Physical &amp; Online Lead Discovery</p>
          </div>
        </div>

        {/* Center Pill Navigation Bar */}
        <nav className="flex items-center space-x-1 bg-[#111214]/60 p-1 rounded-xl border border-white/[0.06] self-start md:self-auto">
          <button
            onClick={() => setActiveTab('radar')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'radar'
                ? 'bg-[#18191D] text-[#EEEEEE] border border-white/[0.14] shadow-sm'
                : 'text-[#989BA3] hover:text-[#EEEEEE] hover:bg-white/[0.04] border border-transparent'
            }`}
          >
            <Radar className="w-3.5 h-3.5" />
            <span>Radar</span>
          </button>

          <button
            onClick={() => setActiveTab('crm')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'crm'
                ? 'bg-[#18191D] text-[#EEEEEE] border border-white/[0.14] shadow-sm'
                : 'text-[#989BA3] hover:text-[#EEEEEE] hover:bg-white/[0.04] border border-transparent'
            }`}
          >
            <KanbanSquare className="w-3.5 h-3.5" />
            <span>CRM</span>
            <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-[#EEEEEE] text-[#08090B]">
              {crmLeads.length || 26}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-[#18191D] text-[#EEEEEE] border border-white/[0.14] shadow-sm'
                : 'text-[#989BA3] hover:text-[#EEEEEE] hover:bg-white/[0.04] border border-transparent'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History</span>
          </button>

          <button
            onClick={() => setActiveTab('pricing')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'pricing'
                ? 'bg-[#18191D] text-[#EEEEEE] border border-white/[0.14] shadow-sm'
                : 'text-[#989BA3] hover:text-[#EEEEEE] hover:bg-white/[0.04] border border-transparent'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Pricing</span>
          </button>
        </nav>

        {/* Right Action buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowProfileModal(true)}
            className="p-2 rounded-lg bg-[#111214] text-[#989BA3] hover:text-[#EEEEEE] hover:bg-[#18191D] border border-white/[0.08] transition"
            title="Profile & Settings"
          >
            <User className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTab('pricing')}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#111214] text-[#EEEEEE] hover:bg-[#18191D] border border-white/[0.08] hover:border-white/[0.18] transition shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#EEEEEE]" />
            <span>Upgrade</span>
          </button>

          <button
            onClick={() => handleExportCsv(activeResults.length ? activeResults : crmLeads)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#111214] text-[#EEEEEE] hover:bg-[#18191D] border border-white/[0.08] hover:border-white/[0.18] transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-[#989BA3]" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Global Status Banner */}
      {statusMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
            statusMsg.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-950/40 text-emerald-200'
              : statusMsg.type === 'error'
              ? 'border-red-500/30 bg-red-950/40 text-red-200'
              : 'border-white/[0.14] bg-[#111214] text-[#EEEEEE]'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : statusMsg.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-[#EEEEEE] shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-[#989BA3] hover:text-[#EEEEEE] ml-2">
            ✕
          </button>
        </div>
      )}

      {/* ======================================================================= */}
      {/* TAB 1: RADAR INTELLIGENCE SEARCH & RESULTS (Matches User Image Exact UI) */}
      {/* ======================================================================= */}
      {activeTab === 'radar' && (
        <div className="space-y-6">
          {/* Main Lead Discovery Radar Card */}
          <div className="bg-[#111214] border border-white/[0.08] rounded-2xl p-5 sm:p-7 shadow-2xl relative overflow-hidden">
            {/* Mode Switcher Banner */}
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
              <div>
                <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-[#18191D] border border-white/[0.08] text-[#989BA3] text-[11px] font-semibold mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#EEEEEE]" />
                  <span>Multi-Channel Lead Discovery Radar</span>
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-[#EEEEEE] tracking-tight">
                  Discover High-Conversion Leads
                </h2>
              </div>

              {/* Dual Mode Toggle Buttons */}
              <div className="bg-[#0D0E11] p-1 rounded-xl border border-white/[0.08] flex items-center shrink-0">
                <button
                  type="button"
                  onClick={() => setRadarMode('physical')}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                    radarMode === 'physical'
                      ? 'bg-[#18191D] text-[#EEEEEE] border border-white/[0.14] shadow-sm'
                      : 'text-[#989BA3] hover:text-[#EEEEEE] hover:bg-white/[0.04]'
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>Physical Mode (No Website)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRadarMode('online')}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                    radarMode === 'online'
                      ? 'bg-[#18191D] text-[#EEEEEE] border border-white/[0.14] shadow-sm'
                      : 'text-[#989BA3] hover:text-[#EEEEEE] hover:bg-white/[0.04]'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Online Mode (Remote Gigs)</span>
                </button>
              </div>
            </div>

            {/* Search Input Form */}
            {radarMode === 'physical' ? (
              <form onSubmit={handleSearchPhysical} className="relative z-10 space-y-5 pt-5">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                  {/* Target Industry Input */}
                  <div className="md:col-span-4 space-y-1.5">
                    <label className="text-xs font-semibold text-[#989BA3] flex items-center space-x-1.5">
                      <Search className="w-3.5 h-3.5 text-[#989BA3]" />
                      <span>Target Industry / Business Type</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={physicalNiche}
                        onChange={(e) => setPhysicalNiche(e.target.value)}
                        placeholder="Search industries (e.g. Plumbers, Auto Repair)..."
                        required
                        className="w-full bg-[#0D0E11] border border-white/[0.1] rounded-xl px-3.5 py-2.5 pr-8 text-sm text-[#EEEEEE] placeholder-[#989BA3]/50 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30 transition"
                      />
                      {physicalNiche && (
                        <button
                          type="button"
                          onClick={() => setPhysicalNiche('')}
                          className="absolute right-3 top-3 text-[#989BA3] hover:text-[#EEEEEE]"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Worldwide Target Country */}
                  <div className="md:col-span-4 space-y-1.5">
                    <label className="text-xs font-semibold text-[#989BA3] flex items-center space-x-1.5">
                      <Globe className="w-3.5 h-3.5 text-[#989BA3]" />
                      <span>Target Country (Worldwide)</span>
                    </label>
                    <div className="relative">
                      <select
                        value={physicalCountry}
                        onChange={(e) => setPhysicalCountry(e.target.value)}
                        className="w-full bg-[#0D0E11] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-sm text-[#EEEEEE] focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30 appearance-none cursor-pointer transition"
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.name} className="bg-[#111214] text-[#EEEEEE]">
                            {c.name} {c.dialCode ? `(${c.dialCode})` : ''}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-3.5 top-3 pointer-events-none text-[#989BA3] text-xs">
                        ▼
                      </div>
                    </div>
                  </div>

                  {/* City / Region / ZIP */}
                  <div className="md:col-span-4 space-y-1.5">
                    <label className="text-xs font-semibold text-[#989BA3] flex items-center space-x-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#989BA3]" />
                      <span>City / Region / ZIP (Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={physicalCity}
                      onChange={(e) => setPhysicalCity(e.target.value)}
                      placeholder="e.g. Nairobi, Mombasa, Austin..."
                      className="w-full bg-[#0D0E11] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-sm text-[#EEEEEE] placeholder-[#989BA3]/50 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30 transition"
                    />
                  </div>
                </div>

                {/* Bottom Action Strip */}
                <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/[0.08]">
                  <div className="flex items-center space-x-4">
                    <label className="inline-flex items-center space-x-2 cursor-pointer text-xs text-[#989BA3] hover:text-[#EEEEEE] select-none">
                      <input
                        type="checkbox"
                        checked={forceRefresh}
                        onChange={(e) => setForceRefresh(e.target.checked)}
                        className="rounded border-white/20 text-white focus:ring-0 bg-[#0D0E11]"
                      />
                      <span>Fresh Scan</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl bg-[#EEEEEE] hover:bg-white text-[#08090B] font-bold text-sm shadow-sm disabled:opacity-50 transition duration-150"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Scanning {physicalCountry} for Live Businesses...</span>
                      </>
                    ) : (
                      <>
                        <span>Launch Local Lead Radar</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSearchRemote} className="relative z-10 space-y-5 pt-5">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                  <div className="md:col-span-8 space-y-1.5">
                    <label className="text-xs font-semibold text-[#989BA3] flex items-center space-x-1.5">
                      <Terminal className="w-3.5 h-3.5 text-[#989BA3]" />
                      <span>Job Role, Field or Service Keyword</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={remoteQuery}
                        onChange={(e) => setRemoteQuery(e.target.value)}
                        placeholder="Search job fields (e.g. React Developer, UI Designer, AI Data)..."
                        required
                        className="w-full bg-[#0D0E11] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-sm text-[#EEEEEE] placeholder-[#989BA3]/50 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30 transition"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-4 space-y-1.5">
                    <label className="text-xs font-semibold text-[#989BA3] flex items-center space-x-1.5">
                      <Filter className="w-3.5 h-3.5 text-[#989BA3]" />
                      <span>Category Filter</span>
                    </label>
                    <select
                      value={remoteCategory}
                      onChange={(e) => setRemoteCategory(e.target.value)}
                      className="w-full bg-[#0D0E11] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-sm text-[#EEEEEE] focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30 appearance-none cursor-pointer transition"
                    >
                      <option value="" className="bg-[#111214]">All Categories</option>
                      <option value="software-dev" className="bg-[#111214]">Software Development</option>
                      <option value="design" className="bg-[#111214]">Design &amp; Creative</option>
                      <option value="writing" className="bg-[#111214]">Copywriting &amp; Content</option>
                      <option value="marketing" className="bg-[#111214]">Growth &amp; Marketing</option>
                    </select>
                  </div>
                </div>

                <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/[0.08]">
                  <div className="flex items-center space-x-4">
                    <label className="inline-flex items-center space-x-2 cursor-pointer text-xs text-[#989BA3] hover:text-[#EEEEEE] select-none">
                      <input
                        type="checkbox"
                        checked={forceRefresh}
                        onChange={(e) => setForceRefresh(e.target.checked)}
                        className="rounded border-white/20 text-white focus:ring-0 bg-[#0D0E11]"
                      />
                      <span>Fresh Scan</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl bg-[#EEEEEE] hover:bg-white text-[#08090B] font-bold text-sm shadow-sm disabled:opacity-50 transition duration-150"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Querying Public Endpoints...</span>
                      </>
                    ) : (
                      <>
                        <span>Scan Remote Opportunities</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Results Header Card & Table */}
          {filteredLeads.length > 0 ? (
            <div className="space-y-4">
              {/* Results Top Header Bar */}
              <div className="bg-[#111214] border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-2xl">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-[#18191D] border border-white/[0.1] text-[#EEEEEE]">
                    {radarMode === 'physical' ? <Store className="w-4 h-4 text-[#EEEEEE]" /> : <Terminal className="w-4 h-4 text-[#EEEEEE]" />}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[#EEEEEE] text-sm sm:text-base tracking-tight">
                      {radarMode === 'physical'
                        ? `Found ${filteredLeads.length} Verified Local Businesses Without Websites`
                        : `Found ${filteredLeads.length} Live Remote Opportunities`}
                    </h3>
                    <p className="text-xs text-[#989BA3] mt-0.5">
                      {radarMode === 'physical'
                        ? `Scanned live records in ${physicalCountry} for "${physicalNiche}"`
                        : `Queried official developer endpoints for "${remoteQuery}"`}
                    </p>
                  </div>
                </div>

                {/* Header Action Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  {radarMode === 'physical' && (
                    <div className="flex items-center space-x-1.5 bg-[#0D0E11] border border-white/[0.1] px-2.5 py-1.5 rounded-lg text-xs text-[#989BA3]">
                      <Filter className="w-3.5 h-3.5 text-[#989BA3]" />
                      <select
                        value={minRating}
                        onChange={(e) => setMinRating(parseFloat(e.target.value))}
                        className="bg-transparent text-[#EEEEEE] focus:outline-none cursor-pointer"
                      >
                        <option value="0" className="bg-[#111214]">All Ratings</option>
                        <option value="4.0" className="bg-[#111214]">4.0+ Stars</option>
                        <option value="4.5" className="bg-[#111214]">4.5+ Stars</option>
                      </select>
                    </div>
                  )}

                  <div className="flex items-center space-x-1.5 bg-[#0D0E11] border border-white/[0.1] px-2.5 py-1.5 rounded-lg text-xs text-[#989BA3]">
                    <ArrowUpDown className="w-3.5 h-3.5 text-[#989BA3]" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="bg-transparent text-[#EEEEEE] focus:outline-none cursor-pointer"
                    >
                      <option value="default" className="bg-[#111214]">Default Order</option>
                      <option value="name" className="bg-[#111214]">Business Name</option>
                      <option value="rating" className="bg-[#111214]">Highest Rating</option>
                    </select>
                  </div>

                  <button
                    onClick={() => handleExportCsv(filteredLeads)}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-[#0D0E11] hover:bg-[#18191D] text-[#EEEEEE] border border-white/[0.1] text-xs font-medium transition"
                  >
                    <Download className="w-3.5 h-3.5 text-[#989BA3]" />
                    <span>Export CSV</span>
                  </button>

                  <button
                    onClick={() => {
                      const targets = selectedLeadIds.size > 0
                        ? filteredLeads.filter((l) => selectedLeadIds.has(l.id))
                        : filteredLeads
                      handleBulkSave(targets)
                    }}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-[#EEEEEE] hover:bg-white text-[#08090B] font-bold text-xs shadow-sm transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Save All ({selectedLeadIds.size > 0 ? selectedLeadIds.size : filteredLeads.length})</span>
                  </button>
                </div>
              </div>

              {/* Physical Lead Results Table */}
              {radarMode === 'physical' ? (
                <div className="bg-[#111214] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-white/[0.08] bg-[#0D0E11]/90 text-[#989BA3] font-semibold uppercase tracking-wider text-[11px]">
                          <th className="p-3.5 w-10 text-center">
                            <button onClick={toggleSelectAll} className="text-[#989BA3] hover:text-[#EEEEEE]">
                              {selectedLeadIds.size === filteredLeads.length && filteredLeads.length > 0 ? (
                                <CheckSquare className="w-4 h-4 text-[#EEEEEE]" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </th>
                          <th className="p-3.5">BUSINESS &amp; NICHE</th>
                          <th className="p-3.5">CONTACT CHANNELS</th>
                          <th className="p-3.5">LOCATION &amp; COUNTRY</th>
                          <th className="p-3.5">REPUTATION</th>
                          <th className="p-3.5">WEBSITE STATUS</th>
                          <th className="p-3.5">SOURCE &amp; PROVENANCE</th>
                          <th className="p-3.5 text-right">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.06] text-[#EEEEEE]">
                        {filteredLeads.map((item) => {
                          const lead = item as WebHuntPhysicalLead
                          const isSelected = selectedLeadIds.has(lead.id)
                          const isSaved = savedIds.has(lead.id)
                          const hasValidPhone = lead.phone && lead.phoneFormatted !== 'Phone unavailable'

                          return (
                            <tr
                              key={lead.id}
                              className={`hover:bg-white/[0.03] transition group ${
                                isSelected ? 'bg-white/[0.05]' : ''
                              }`}
                            >
                              {/* Checkbox */}
                              <td className="p-3.5 text-center">
                                <button
                                  onClick={() => toggleSelect(lead.id)}
                                  className="text-[#989BA3] hover:text-[#EEEEEE] transition"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-4 h-4 text-[#EEEEEE]" />
                                  ) : (
                                    <Square className="w-4 h-4" />
                                  )}
                                </button>
                              </td>

                              {/* Business Name & Niche */}
                              <td className="p-3.5">
                                <div className="font-bold text-[#EEEEEE] text-sm group-hover:text-white transition">
                                  {lead.businessName}
                                </div>
                                <div className="text-[#989BA3] mt-0.5 inline-flex items-center space-x-1">
                                  <span className="px-2 py-0.5 rounded-md bg-[#0D0E11] text-[10px] text-[#989BA3] border border-white/[0.08]">
                                    {lead.category || 'furniture'}
                                  </span>
                                </div>
                              </td>

                              {/* Contact Channels */}
                              <td className="p-3.5">
                                <div className="space-y-1.5 min-w-[200px]">
                                  {hasValidPhone ? (
                                    <div className="flex items-center justify-between bg-[#0D0E11] px-2.5 py-1 rounded-lg border border-white/[0.08]">
                                      <a
                                        href={`tel:${lead.phone}`}
                                        className="font-mono text-[#EEEEEE] hover:underline flex items-center space-x-1.5 text-xs"
                                        title="Click to call"
                                      >
                                        <Phone className="w-3 h-3 text-[#989BA3] shrink-0" />
                                        <span>{lead.phoneFormatted || lead.phone}</span>
                                      </a>
                                      <button
                                        onClick={(e) => handleCopyPhone(lead.phone, e)}
                                        className="p-1 rounded text-[#989BA3] hover:text-[#EEEEEE] hover:bg-white/[0.06] transition"
                                        title="Copy phone"
                                      >
                                        {copiedPhone === lead.phone ? (
                                          <Check className="w-3 h-3 text-[#34D399]" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-[#989BA3]/60 italic font-mono text-[11px]">
                                      Phone unavailable
                                    </span>
                                  )}

                                  {/* Enriched Channels */}
                                  {(lead.email || lead.whatsapp || lead.socialProfiles?.facebook) && (
                                    <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                      {lead.email && (
                                        <a
                                          href={`mailto:${lead.email}`}
                                          className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-[#18191D] text-[#EEEEEE] border border-white/[0.1] text-[10px]"
                                        >
                                          <Mail className="w-3 h-3 text-[#989BA3]" />
                                          <span className="max-w-[120px] truncate">{lead.email}</span>
                                        </a>
                                      )}
                                      {lead.whatsapp && (
                                        <a
                                          href={lead.whatsapp}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]"
                                        >
                                          <MessageCircle className="w-3 h-3" />
                                          <span>WhatsApp</span>
                                        </a>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Location & Country */}
                              <td className="p-3.5 max-w-[200px] truncate">
                                <div className="flex items-center space-x-1 text-[#989BA3] truncate">
                                  <MapPin className="w-3.5 h-3.5 text-[#989BA3] shrink-0" />
                                  <span className="truncate">{lead.address || `${lead.city || 'Lodwar-Lokichogio Road'}, ${lead.state || 'KE'}`}</span>
                                </div>
                              </td>

                              {/* Reputation */}
                              <td className="p-3.5 whitespace-nowrap">
                                {lead.rating ? (
                                  <div className="flex items-center space-x-1">
                                    <div className="flex items-center space-x-0.5 text-amber-400 font-bold">
                                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                      <span>{lead.rating.toFixed(1)}</span>
                                    </div>
                                    <span className="text-[#989BA3] text-[11px]">({lead.reviewCount || 0})</span>
                                  </div>
                                ) : (
                                  <span className="text-[#989BA3]/60 italic">No reviews</span>
                                )}
                              </td>

                              {/* Website Status Badge */}
                              <td className="p-3.5 whitespace-nowrap">
                                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                  <span>No Website</span>
                                </span>
                              </td>

                              {/* Source & Provenance */}
                              <td className="p-3.5 whitespace-nowrap">
                                <div className="flex items-center space-x-1.5">
                                  <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-[#0D0E11] text-[#989BA3] border border-white/[0.08]">
                                    {lead.sourceProvider || 'OSM'}
                                  </span>
                                  <ExternalLink className="w-3 h-3 text-[#989BA3]" />
                                </div>
                              </td>

                              {/* Actions */}
                              <td className="p-3.5 text-right whitespace-nowrap">
                                <div className="inline-flex items-center space-x-1.5">
                                  <button
                                    onClick={() => handleGeneratePitch(lead)}
                                    className="px-2.5 py-1 rounded-lg bg-[#18191D] hover:bg-[#22242A] text-[#EEEEEE] border border-white/[0.1] font-medium text-xs transition flex items-center space-x-1"
                                    title="Generate cold call pitch script"
                                  >
                                    <MessageSquareQuote className="w-3.5 h-3.5 text-[#989BA3]" />
                                    <span>Pitch</span>
                                  </button>

                                  <button
                                    onClick={() => handleSaveLead(lead)}
                                    disabled={isSaved}
                                    className={`px-3 py-1 rounded-lg font-medium text-xs transition flex items-center space-x-1 ${
                                      isSaved
                                        ? 'bg-white/[0.06] text-[#34D399] border border-white/[0.1] cursor-default'
                                        : 'bg-[#EEEEEE] hover:bg-white text-[#08090B] font-bold shadow-sm'
                                    }`}
                                  >
                                    {isSaved ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-[#34D399]" />
                                        <span>Saved</span>
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Save</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Online Job Opportunities Cards Grid */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredLeads.map((item) => {
                    const job = item as WebHuntRemoteJob
                    const isSaved = savedIds.has(job.id)
                    return (
                      <div
                        key={job.id}
                        className="bg-[#111214] border border-white/[0.08] rounded-2xl p-5 space-y-4 hover:border-white/[0.18] transition flex flex-col justify-between"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-[#18191D] text-[10px] text-[#989BA3] border border-white/[0.08] uppercase font-bold">
                              {job.source || 'REMOTE'}
                            </span>
                            {job.salary && (
                              <span className="text-xs font-mono text-emerald-400 font-bold">
                                {job.salary}
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-sm text-[#EEEEEE] leading-snug">
                            {job.title}
                          </h4>
                          <p className="text-xs text-[#989BA3]">
                            {job.company} · {job.location || 'Worldwide Remote'}
                          </p>
                          {job.tags && job.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {job.tags.slice(0, 4).map((tag: string) => (
                                <span
                                  key={tag}
                                  className="px-2 py-0.5 rounded-md bg-[#0D0E11] text-[10px] text-[#989BA3] border border-white/[0.06]"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-white/[0.08]">
                          <button
                            onClick={() => handleGeneratePitch(job)}
                            className="px-2.5 py-1 rounded-lg bg-[#18191D] hover:bg-[#22242A] text-[#EEEEEE] border border-white/[0.1] text-xs font-medium flex items-center space-x-1"
                          >
                            <MessageSquareQuote className="w-3.5 h-3.5 text-[#989BA3]" />
                            <span>Pitch</span>
                          </button>

                          <button
                            onClick={() => handleSaveLead(job)}
                            disabled={isSaved}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
                              isSaved
                                ? 'bg-white/[0.06] text-[#34D399] border border-white/[0.1]'
                                : 'bg-[#EEEEEE] hover:bg-white text-[#08090B]'
                            }`}
                          >
                            {isSaved ? <Check className="w-3.5 h-3.5 text-[#34D399]" /> : <Plus className="w-3.5 h-3.5" />}
                            <span>{isSaved ? 'Saved' : 'Save'}</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Empty State: Feature Highlights Grid */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
              <div className="bg-[#111214] border border-white/[0.08] rounded-2xl p-6 space-y-3 hover:border-white/[0.18] transition duration-150">
                <div className="w-10 h-10 rounded-xl bg-[#18191D] border border-white/[0.1] text-[#EEEEEE] flex items-center justify-center">
                  <Store className="w-5 h-5 text-[#EEEEEE]" />
                </div>
                <h3 className="font-bold text-[#EEEEEE] text-base tracking-tight">Worldwide Physical Radar</h3>
                <p className="text-xs text-[#989BA3] leading-relaxed">
                  Find local businesses across Kenya and 240+ countries that have an active phone number but zero website on record to pitch custom websites and systems.
                </p>
              </div>

              <div className="bg-[#111214] border border-white/[0.08] rounded-2xl p-6 space-y-3 hover:border-white/[0.18] transition duration-150">
                <div className="w-10 h-10 rounded-xl bg-[#18191D] border border-white/[0.1] text-[#EEEEEE] flex items-center justify-center">
                  <Terminal className="w-5 h-5 text-[#EEEEEE]" />
                </div>
                <h3 className="font-bold text-[#EEEEEE] text-base tracking-tight">Remote Opportunities Radar</h3>
                <p className="text-xs text-[#989BA3] leading-relaxed">
                  Query official public developer endpoints (Remotive, Arbeitnow, Himalayas, RemoteOK) for genuine remote software, writing, design, and AI gigs.
                </p>
              </div>

              <div className="bg-[#111214] border border-white/[0.08] rounded-2xl p-6 space-y-3 hover:border-white/[0.18] transition duration-150">
                <div className="w-10 h-10 rounded-xl bg-[#18191D] border border-white/[0.1] text-[#EEEEEE] flex items-center justify-center">
                  <KanbanSquare className="w-5 h-5 text-[#EEEEEE]" />
                </div>
                <h3 className="font-bold text-[#EEEEEE] text-base tracking-tight">In-Session Pipeline CRM</h3>
                <p className="text-xs text-[#989BA3] leading-relaxed">
                  Track outreach stages (New to Contacted to Interested to Closed), generate customized pitch scripts and proposals, and export to CSV instantly.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================================= */}
      {/* TAB 2: CRM PIPELINE & CLIENT MANAGEMENT */}
      {/* ======================================================================= */}
      {activeTab === 'crm' && (
        <div className="space-y-6">
          {/* CRM Controls Bar */}
          <div className="bg-[#111214] border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xl">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-[#18191D] border border-white/[0.1] flex items-center justify-center text-[#EEEEEE]">
                <KanbanSquare className="w-4 h-4 text-[#EEEEEE]" />
              </div>
              <div>
                <h2 className="font-extrabold text-base text-[#EEEEEE] tracking-tight">CRM Client Pipeline</h2>
                <p className="text-xs text-[#989BA3] mt-0.5">
                  Manage leads across outreach stages, log interaction notes, and close deals.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#989BA3] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={crmSearch}
                  onChange={(e) => setCrmSearch(e.target.value)}
                  placeholder="Filter pipeline leads..."
                  className="bg-[#0D0E11] border border-white/[0.1] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#EEEEEE] placeholder-[#989BA3]/50 focus:outline-none"
                />
              </div>

              <select
                value={crmFilter}
                onChange={(e) => setCrmFilter(e.target.value)}
                className="bg-[#0D0E11] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs text-[#EEEEEE] focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-[#111214]">All Stages</option>
                <option value="NEW" className="bg-[#111214]">New Lead</option>
                <option value="QUALIFIED" className="bg-[#111214]">Qualified</option>
                <option value="CONTACTED" className="bg-[#111214]">Contacted</option>
                <option value="INTERESTED" className="bg-[#111214]">Interested</option>
                <option value="NEGOTIATION" className="bg-[#111214]">Negotiation</option>
                <option value="CLOSED" className="bg-[#111214]">Closed / Won</option>
              </select>

              <button
                onClick={() => handleExportCsv(crmLeads)}
                className="px-3 py-1.5 rounded-lg bg-[#0D0E11] hover:bg-[#18191D] text-[#EEEEEE] border border-white/[0.1] text-xs font-medium flex items-center space-x-1"
              >
                <Download className="w-3.5 h-3.5 text-[#989BA3]" />
                <span>Export Pipeline</span>
              </button>
            </div>
          </div>

          {/* CRM Leads Table */}
          {crmLeads.length > 0 ? (
            <div className="bg-[#111214] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-[#0D0E11]/90 text-[#989BA3] font-semibold uppercase tracking-wider text-[11px]">
                    <th className="p-3.5">Lead / Client</th>
                    <th className="p-3.5">Contact Channels</th>
                    <th className="p-3.5">Stage</th>
                    <th className="p-3.5">Estimated Value</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-[#EEEEEE]">
                  {crmLeads
                    .filter((lead) => {
                      if (crmFilter !== 'ALL' && lead.status !== crmFilter) return false
                      if (crmSearch.trim()) {
                        const q = crmSearch.toLowerCase()
                        const name = (lead.type === 'physical' ? (lead as WebHuntPhysicalLead).businessName : (lead as WebHuntRemoteJob).title).toLowerCase()
                        return name.includes(q)
                      }
                      return true
                    })
                    .map((lead) => {
                      const isPhys = lead.type === 'physical'
                      const phys = isPhys ? (lead as WebHuntPhysicalLead) : null
                      const online = !isPhys ? (lead as WebHuntRemoteJob) : null
                      const name = isPhys ? (phys?.businessName || '') : (online?.title || '')
                      const phone = isPhys ? phys?.phone : ''
                      return (
                        <tr key={lead.id} className="hover:bg-white/[0.03] transition">
                          <td className="p-3.5">
                            <div className="font-bold text-[#EEEEEE] text-sm">{name}</div>
                            <div className="text-[11px] text-[#989BA3] mt-0.5">
                              {isPhys ? (phys?.address || phys?.city || 'Kenya') : 'Remote Job'}
                            </div>
                          </td>

                          <td className="p-3.5">
                            {phone ? (
                              <span className="font-mono text-[#EEEEEE]">{phone}</span>
                            ) : (
                              <span className="text-[#989BA3]/60 italic font-mono">No direct phone</span>
                            )}
                          </td>

                          <td className="p-3.5">
                            <select
                              value={lead.status || 'NEW'}
                              onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value as WebHuntPipelineStatus)}
                              className="bg-[#0D0E11] border border-white/[0.1] rounded-lg px-2.5 py-1 text-xs text-[#EEEEEE] focus:outline-none cursor-pointer"
                            >
                              <option value="NEW" className="bg-[#111214]">NEW</option>
                              <option value="QUALIFIED" className="bg-[#111214]">QUALIFIED</option>
                              <option value="CONTACTED" className="bg-[#111214]">CONTACTED</option>
                              <option value="INTERESTED" className="bg-[#111214]">INTERESTED</option>
                              <option value="NEGOTIATION" className="bg-[#111214]">NEGOTIATION</option>
                              <option value="CLOSED" className="bg-[#111214]">CLOSED / WON</option>
                            </select>
                          </td>

                          <td className="p-3.5 font-mono text-emerald-400 font-bold">
                            {lead.estimatedValue ? `$${lead.estimatedValue.toLocaleString()}` : '$500'}
                          </td>

                          <td className="p-3.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center space-x-1.5">
                              <button
                                onClick={() => handleGeneratePitch(lead)}
                                className="px-2.5 py-1 rounded-lg bg-[#18191D] hover:bg-[#22242A] text-[#EEEEEE] border border-white/[0.1] text-xs font-medium flex items-center space-x-1"
                              >
                                <MessageSquareQuote className="w-3.5 h-3.5 text-[#989BA3]" />
                                <span>Pitch</span>
                              </button>

                              <button
                                onClick={() => setSelectedCrmLead(lead)}
                                className="p-1.5 rounded-lg bg-[#111214] hover:bg-[#18191D] text-[#989BA3] hover:text-[#EEEEEE] border border-white/[0.08]"
                                title="Open Client Details"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-[#111214] border border-white/[0.08] rounded-2xl p-12 text-center space-y-3">
              <KanbanSquare className="w-8 h-8 text-[#989BA3] mx-auto opacity-50" />
              <h3 className="font-bold text-base text-[#EEEEEE]">No Leads in Pipeline</h3>
              <p className="text-xs text-[#989BA3] max-w-sm mx-auto">
                Scan local businesses or remote opportunities from the Radar tab, then click "+ Save" to track them here.
              </p>
              <button
                onClick={() => setActiveTab('radar')}
                className="mt-2 px-4 py-2 rounded-xl bg-[#EEEEEE] text-[#08090B] font-bold text-xs shadow-sm hover:bg-white transition"
              >
                Go to Lead Radar
              </button>
            </div>
          )}
        </div>
      )}

      {/* ======================================================================= */}
      {/* TAB 3: SEARCH HISTORY */}
      {/* ======================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="bg-[#111214] border border-white/[0.08] rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-[#18191D] border border-white/[0.1] flex items-center justify-center text-[#EEEEEE]">
                <History className="w-4 h-4 text-[#EEEEEE]" />
              </div>
              <div>
                <h2 className="font-extrabold text-base text-[#EEEEEE] tracking-tight">Recent Discovery Scans</h2>
                <p className="text-xs text-[#989BA3]">Audit history of physical and online radar operations.</p>
              </div>
            </div>

            <div className="divide-y divide-white/[0.06]">
              {searchHistory.length > 0 ? (
                searchHistory.map((item, idx) => (
                  <div key={idx} className="py-3.5 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-[#EEEEEE]">{item.query}</div>
                      <div className="text-xs text-[#989BA3] mt-0.5">
                        Mode: <span className="uppercase">{item.mode}</span> · {item.resultsCount || 10} records fetched
                      </div>
                    </div>
                    <span className="text-[11px] text-[#989BA3] font-mono">
                      {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : 'Recent'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-[#989BA3]">
                  No past searches logged yet. Run a radar scan to see history records.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* TAB 4: PRICING & SUBSCRIPTION */}
      {/* ======================================================================= */}
      {activeTab === 'pricing' && (
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#18191D] border border-white/[0.08] text-xs font-semibold text-[#989BA3]">
              <Sparkles className="w-3.5 h-3.5 text-[#EEEEEE]" />
              <span>Production Plans</span>
            </div>
            <h2 className="text-2xl font-extrabold text-[#EEEEEE]">WebHunt Delta Subscription</h2>
            <p className="text-xs text-[#989BA3]">
              Unlock unlimited worldwide radar scans, high-speed verified data, and direct AI proposals.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div className="bg-[#111214] border border-white/[0.08] rounded-2xl p-6 space-y-4">
              <div className="space-y-1">
                <h3 className="font-bold text-lg text-[#EEEEEE]">Professional Radar</h3>
                <p className="text-xs text-[#989BA3]">For independent consultants, freelancers &amp; developers.</p>
              </div>
              <div className="text-3xl font-extrabold text-[#EEEEEE] font-mono">$29<span className="text-sm font-normal text-[#989BA3]">/mo</span></div>
              <ul className="space-y-2 text-xs text-[#989BA3] pt-2">
                <li className="flex items-center space-x-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Unlimited Physical &amp; Remote Radar Scans</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Full CRM Lead Pipeline with unlimited entries</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Fact-Grounded AI Proposal &amp; Pitch Generator</span>
                </li>
              </ul>
              <a
                href="https://web-hunt-delta.vercel.app/subscription"
                target="_blank"
                rel="noreferrer"
                className="w-full block py-2.5 px-4 text-center rounded-xl bg-[#EEEEEE] hover:bg-white text-[#08090B] font-bold text-sm shadow-sm transition"
              >
                Activate Subscription
              </a>
            </div>

            <div className="bg-[#111214] border border-white/[0.14] rounded-2xl p-6 space-y-4 relative">
              <div className="space-y-1">
                <div className="inline-block px-2 py-0.5 rounded bg-white/[0.06] text-[10px] font-bold text-emerald-400 border border-emerald-500/20 uppercase tracking-wider mb-1">
                  Enterprise Agency
                </div>
                <h3 className="font-bold text-lg text-[#EEEEEE]">Agency Growth Suite</h3>
                <p className="text-xs text-[#989BA3]">For digital agencies, B2B sales teams, and high-volume outreach.</p>
              </div>
              <div className="text-3xl font-extrabold text-[#EEEEEE] font-mono">$79<span className="text-sm font-normal text-[#989BA3]">/mo</span></div>
              <ul className="space-y-2 text-xs text-[#989BA3] pt-2">
                <li className="flex items-center space-x-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Everything in Professional</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Multi-User Session Delegation &amp; Team Workspaces</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Automated WhatsApp &amp; Cold Pitch Outreach Hooks</span>
                </li>
              </ul>
              <a
                href="https://web-hunt-delta.vercel.app/subscription"
                target="_blank"
                rel="noreferrer"
                className="w-full block py-2.5 px-4 text-center rounded-xl bg-[#EEEEEE] hover:bg-white text-[#08090B] font-bold text-sm shadow-sm transition"
              >
                Upgrade to Agency
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* MODAL: AI PITCH SCRIPT & PROPOSAL STUDIO */}
      {/* ======================================================================= */}
      {pitchModalLead && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111214] border border-white/[0.12] rounded-2xl w-full max-w-2xl shadow-2xl p-6 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#18191D] border border-white/[0.1] flex items-center justify-center text-[#EEEEEE]">
                  <MessageSquareQuote className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#EEEEEE]">
                    Cold Pitch &amp; Proposal Studio
                  </h3>
                  <p className="text-[11px] text-[#989BA3]">
                    Target: {pitchModalLead.type === 'physical' ? (pitchModalLead as WebHuntPhysicalLead).businessName : (pitchModalLead as WebHuntRemoteJob).title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPitchModalLead(null)}
                className="text-[#989BA3] hover:text-[#EEEEEE]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[#989BA3]">Pitch Template</label>
                <select
                  value={pitchTemplate}
                  onChange={(e) => {
                    setPitchTemplate(e.target.value)
                    handleGeneratePitch(pitchModalLead)
                  }}
                  className="w-full bg-[#0D0E11] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-[#EEEEEE] focus:outline-none"
                >
                  <option value="local_website_pitch" className="bg-[#111214]">Website Modernization Pitch</option>
                  <option value="agency_modernization" className="bg-[#111214]">Agency POS &amp; Automation Proposal</option>
                  <option value="technical_pitch" className="bg-[#111214]">Developer Direct Technical Pitch</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[#989BA3]">Tone Profile</label>
                <select
                  value={pitchTone}
                  onChange={(e) => setPitchTone(e.target.value)}
                  className="w-full bg-[#0D0E11] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-[#EEEEEE] focus:outline-none"
                >
                  <option value="Consultative & Professional" className="bg-[#111214]">Consultative &amp; High-Value</option>
                  <option value="Direct & Urgent" className="bg-[#111214]">Direct &amp; Urgent</option>
                  <option value="Warm & Friendly" className="bg-[#111214]">Warm &amp; Friendly</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#989BA3]">Proposal Draft</label>
              {pitchGenerating ? (
                <div className="h-48 bg-[#0D0E11] rounded-xl border border-white/[0.08] flex items-center justify-center text-xs text-[#989BA3]">
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  <span>Synthesizing fact-grounded proposal...</span>
                </div>
              ) : (
                <textarea
                  value={pitchDraftText}
                  onChange={(e) => setPitchDraftText(e.target.value)}
                  rows={8}
                  className="w-full bg-[#0D0E11] border border-white/[0.1] rounded-xl p-3 text-xs text-[#EEEEEE] font-mono focus:outline-none focus:ring-1 focus:ring-white/20"
                />
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
              <button
                onClick={() => submitQuery(`Refine this pitch for ${pitchModalLead.type === 'physical' ? (pitchModalLead as WebHuntPhysicalLead).businessName : (pitchModalLead as WebHuntRemoteJob).title}: ${pitchDraftText}`)}
                className="text-xs text-[#989BA3] hover:text-[#EEEEEE] flex items-center space-x-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Refine in GACKS AI Assistant</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopyPitch}
                  className="px-3.5 py-1.5 rounded-xl bg-[#18191D] hover:bg-[#22242A] text-[#EEEEEE] border border-white/[0.1] text-xs font-semibold flex items-center space-x-1.5"
                >
                  {pitchCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{pitchCopied ? 'Copied to Clipboard' : 'Copy Pitch'}</span>
                </button>

                <button
                  onClick={() => {
                    handleSaveLead(pitchModalLead)
                    setPitchModalLead(null)
                  }}
                  className="px-4 py-1.5 rounded-xl bg-[#EEEEEE] hover:bg-white text-[#08090B] text-xs font-bold shadow-sm"
                >
                  Save &amp; Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* MODAL: CLIENT PROFILE & NOTE DRAWER */}
      {/* ======================================================================= */}
      {selectedCrmLead && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111214] border border-white/[0.12] rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#18191D] border border-white/[0.1] flex items-center justify-center text-[#EEEEEE]">
                  <KanbanSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#EEEEEE]">
                    {selectedCrmLead.type === 'physical' ? (selectedCrmLead as WebHuntPhysicalLead).businessName : (selectedCrmLead as WebHuntRemoteJob).title}
                  </h3>
                  <p className="text-[11px] text-[#989BA3]">Client Profile &amp; CRM Interaction History</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCrmLead(null)}
                className="text-[#989BA3] hover:text-[#EEEEEE]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-[#0D0E11] p-3 rounded-xl border border-white/[0.06]">
                <div>
                  <span className="text-[#989BA3] text-[10px] block">Pipeline Stage</span>
                  <span className="font-bold text-[#EEEEEE]">{selectedCrmLead.status || 'NEW'}</span>
                </div>
                <div>
                  <span className="text-[#989BA3] text-[10px] block">Estimated Value</span>
                  <span className="font-bold text-emerald-400">${selectedCrmLead.estimatedValue || 500}</span>
                </div>
              </div>

              {selectedCrmLead.notes && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-[#989BA3]">Notes &amp; Interactions</span>
                  <div className="max-h-32 overflow-y-auto space-y-1.5 bg-[#0D0E11] p-2.5 rounded-xl border border-white/[0.06] text-[#EEEEEE] font-mono text-xs whitespace-pre-wrap">
                    {selectedCrmLead.notes}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#989BA3]">Log New Note</label>
                <textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="e.g. Called owner, offered custom web audit, follow-up scheduled for Tuesday..."
                  rows={3}
                  className="w-full bg-[#0D0E11] border border-white/[0.1] rounded-xl p-2.5 text-xs text-[#EEEEEE] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
              <button
                onClick={() => setSelectedCrmLead(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs text-[#989BA3] hover:text-[#EEEEEE]"
              >
                Close
              </button>
              <button
                onClick={handleAddNote}
                className="px-4 py-1.5 rounded-xl bg-[#EEEEEE] hover:bg-white text-[#08090B] font-bold text-xs shadow-sm"
              >
                Add Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* MODAL: PROFILE & SETTINGS */}
      {/* ======================================================================= */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111214] border border-white/[0.12] rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#18191D] border border-white/[0.1] flex items-center justify-center text-[#EEEEEE]">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#EEEEEE]">WebHunt Account</h3>
                  <p className="text-[11px] text-[#989BA3]">Session &amp; Security Settings</p>
                </div>
              </div>
              <button onClick={() => setShowProfileModal(false)} className="text-[#989BA3] hover:text-[#EEEEEE]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[#0D0E11] rounded-xl border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[#989BA3]">Authenticated Email</span>
                  <span className="font-bold text-[#EEEEEE] font-mono">
                    {currentUser?.email || status?.userEmail || 'admin@webhunt.io'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#989BA3]">Active Subscription</span>
                  <span className="font-bold text-emerald-400">
                    {status?.plan || 'Professional Radar'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#989BA3]">Gateway Target</span>
                  <span className="text-[#EEEEEE] font-mono text-[10px]">
                    https://web-hunt-delta.vercel.app
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
              <button
                onClick={handleLogout}
                className="px-3.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold"
              >
                Sign Out
              </button>
              <button
                onClick={() => setShowProfileModal(false)}
                className="px-4 py-1.5 rounded-xl bg-[#EEEEEE] hover:bg-white text-[#08090B] font-bold text-xs shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
