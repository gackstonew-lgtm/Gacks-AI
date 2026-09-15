import React, { useState } from 'react'
import { Sidebar } from './dashboard/Sidebar'
import { TopBar } from './dashboard/TopBar'
import { HeroPanel } from './dashboard/HeroPanel'
import { SystemStatusCard } from './dashboard/SystemStatusCard'
import { QuickActionsCard } from './dashboard/QuickActionsCard'
import { RecentActivityCard } from './dashboard/RecentActivityCard'
import { TodaysFocusCard } from './dashboard/TodaysFocusCard'
import { CalendarCard } from './dashboard/CalendarCard'
import { MarketOverviewCard } from './dashboard/MarketOverviewCard'
import { QuoteAndStatsCards } from './dashboard/QuoteAndStatsCards'
import { ViewsModals } from './dashboard/ViewsModals'
import { useStore, type NavRoute } from '../store'
import { Mic, Volume2 } from 'lucide-react'

interface GacksDashboardProps {
  onToggleVoice?: () => void
}

export const GacksDashboard: React.FC<GacksDashboardProps> = ({
  onToggleVoice,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const setActiveNav = useStore((s) => s.setActiveNav)
  const phase = useStore((s) => s.phase)
  const caption = useStore((s) => s.caption)

  const handleNavSelect = (route: NavRoute) => {
    setActiveNav(route)
  }

  return (
    <div className="gacks-dashboard-root">
      {/* 1. Left Vertical Navigation Sidebar */}
      <Sidebar
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onSelectNav={handleNavSelect}
      />

      {/* 2. Main Dashboard Viewport */}
      <main className="gacks-main-viewport">
        {/* Top Command Bar */}
        <TopBar
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenSettings={() => setActiveNav('settings')}
          onOpenChat={() => setActiveNav('chat')}
        />

        {/* Dashboard Content Container */}
        <div className="gacks-dashboard-content">
          {/* Top Row: Hero Assistant Panel + System Status */}
          <div className="gacks-grid-top-row">
            <div className="gacks-hero-col">
              <HeroPanel
                onTriggerMode={(_mode) => setActiveNav('chat')}
                onToggleVoice={onToggleVoice}
              />
            </div>
            <div className="gacks-system-col">
              <SystemStatusCard />
            </div>
          </div>

          {/* Middle Row: Quick Actions + Recent Activity + Focus / Calendar */}
          <div className="gacks-grid-middle-row">
            <div className="gacks-quickactions-col">
              <QuickActionsCard onActionClick={(route) => setActiveNav(route as NavRoute)} />
            </div>
            <div className="gacks-activity-col">
              <RecentActivityCard onViewAll={() => setActiveNav('chat')} />
            </div>
            <div className="gacks-schedule-col">
              <TodaysFocusCard onViewAll={() => setActiveNav('tasks')} />
              <CalendarCard onViewAll={() => setActiveNav('calendar')} />
            </div>
          </div>

          {/* Bottom Row: Live Market Overview + Quote & Stats Cluster */}
          <div className="gacks-grid-bottom-row">
            <div className="gacks-market-col">
              <MarketOverviewCard />
            </div>
            <div className="gacks-stats-col">
              <QuoteAndStatsCards />
            </div>
          </div>
        </div>
      </main>

      {/* 3. Interactive Modals for Active Navigation Routes */}
      <ViewsModals
        onClose={() => setActiveNav('dashboard')}
        onToggleVoice={onToggleVoice}
      />

      {/* 4. Floating Mic Action FAB */}
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
        title="Voice Assistant (Space or 'Hey Gacks')"
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

      {/* Spoken subtitle overlay when voice is talking */}
      {caption && (
        <div className="gacks-floating-caption">
          <span className="gacks-caption-dot" />
          <p className="gacks-caption-text">{caption}</p>
        </div>
      )}
    </div>
  )
}
