import React, { useState, useEffect } from 'react'
import { Sidebar } from './dashboard/Sidebar'
import { TopBar } from './dashboard/TopBar'
import { HeroPanel } from './dashboard/HeroPanel'
import { SystemStatusCard } from './dashboard/SystemStatusCard'
import { QuickActionsCard } from './dashboard/QuickActionsCard'
import { CalendarCard } from './dashboard/CalendarCard'
import { MarketOverviewCard } from './dashboard/MarketOverviewCard'
import { QuoteAndStatsCards } from './dashboard/QuoteAndStatsCards'
import { ChatPage } from './pages/ChatPage'
import { TasksPage } from './pages/TasksPage'
import { FilesPage } from './pages/FilesPage'
import { CalendarPage } from './pages/CalendarPage'
import { SearchPage } from './pages/SearchPage'
import { SystemPage } from './pages/SystemPage'
import { SettingsPage } from './pages/settings/SettingsPage'
import { BusinessSuitePage } from './pages/BusinessSuitePage'
import { useStore, type NavRoute } from '../store'
import { initRouter, navigate, type SettingsCategory } from '../lib/router'
import { Mic, Volume2 } from 'lucide-react'

interface GacksDashboardProps {
  onToggleVoice?: () => void
}

export const GacksDashboard: React.FC<GacksDashboardProps> = ({
  onToggleVoice,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const activeNav = useStore((s) => s.activeNav)
  const setActiveNav = useStore((s) => s.setActiveNav)
  const setSettingsCategory = useStore((s) => s.setSettingsCategory)
  const phase = useStore((s) => s.phase)
  const caption = useStore((s) => s.caption)

  // Initialize HTML5 History routing and listen for browser back/forward & deep links
  useEffect(() => {
    const unbind = initRouter((route, category) => {
      setActiveNav(route)
      if (category) {
        setSettingsCategory(category)
      }
    })
    return unbind
  }, [setActiveNav, setSettingsCategory])

  const handleNavSelect = (route: NavRoute, category?: SettingsCategory) => {
    navigate(route, category)
    setActiveNav(route)
    if (category) {
      setSettingsCategory(category)
    }
  }

  return (
    <div className="gacks-dashboard-root">
      {/* 1. Left Vertical Navigation Sidebar (Collapsible & Expandable) */}
      <Sidebar
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onSelectNav={handleNavSelect}
      />

      {/* 2. Main Viewport */}
      <main className="gacks-main-viewport">
        {/* Top Command Bar */}
        <TopBar
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenSettings={() => handleNavSelect('settings')}
          onOpenChat={() => handleNavSelect('chat')}
        />

        {/* Viewport Content: Real Page Routing */}
        <div className="gacks-dashboard-content">
          {activeNav === 'dashboard' && (
            <div className="gacks-dashboard-grid-container">
              {/* Row 1: Hero Assistant Panel + System Status */}
              <div className="gacks-grid-top-row">
                <div className="gacks-hero-col">
                  <HeroPanel
                    onTriggerMode={(_mode) => handleNavSelect('chat')}
                    onToggleVoice={onToggleVoice}
                  />
                </div>
                <div className="gacks-system-col">
                  <SystemStatusCard />
                </div>
              </div>

              {/* Row 2: Rebalanced Execution Grid (Quick Actions + Calendar) */}
              <div className="gacks-grid-middle-row">
                <div className="gacks-quickactions-col">
                  <QuickActionsCard onActionClick={(route) => handleNavSelect(route as NavRoute)} />
                </div>
                <div className="gacks-calendar-col">
                  <CalendarCard onViewAll={() => handleNavSelect('calendar')} />
                </div>
              </div>

              {/* Row 3: Live Market Overview + Quote & Stats Cluster */}
              <div className="gacks-grid-bottom-row">
                <div className="gacks-market-col">
                  <MarketOverviewCard />
                </div>
                <div className="gacks-stats-col">
                  <QuoteAndStatsCards />
                </div>
              </div>
            </div>
          )}

          {activeNav === 'business' && <BusinessSuitePage />}
          {activeNav === 'chat' && <ChatPage onToggleVoice={onToggleVoice} />}
          {activeNav === 'tasks' && <TasksPage />}
          {activeNav === 'files' && <FilesPage />}
          {activeNav === 'calendar' && <CalendarPage />}
          {activeNav === 'websearch' && <SearchPage />}
          {activeNav === 'system' && <SystemPage />}
          {activeNav === 'settings' && <SettingsPage onToggleVoice={onToggleVoice} />}
        </div>
      </main>

      {/* 3. Floating Voice FAB */}
      <button
        type="button"
        className={`gacks-floating-mic-btn ${
          phase === 'listening'
            ? 'gacks-mic-pulse-listening'
            : phase === 'thinking'
            ? 'gacks-mic-pulse-thinking'
            : phase === 'speaking'
            ? 'gacks-mic-pulse-speaking'
            : ''
        }`}
        onClick={onToggleVoice}
        title="Voice Assistant (Space or 'Hey Insight')"
        aria-label="Toggle voice conversation"
      >
        {phase === 'listening' ? (
          <Mic className="w-5 h-5 text-white" />
        ) : phase === 'speaking' ? (
          <Volume2 className="w-5 h-5 text-white" />
        ) : (
          <Mic className="w-5 h-5 text-orange-400" />
        )}
      </button>

      {/* Spoken subtitle overlay when voice is speaking */}
      {caption && (
        <div className="gacks-floating-caption">
          <span className="gacks-caption-dot" />
          <p className="gacks-caption-text">{caption}</p>
        </div>
      )}
    </div>
  )
}
