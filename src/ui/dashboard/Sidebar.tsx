import React, { useEffect } from 'react'
import {
  LayoutDashboard,
  MessageSquare,
  CheckSquare,
  Folder,
  Calendar,
  Globe,
  Cpu,
  Settings,
  Briefcase,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react'
import { useStore, type NavRoute } from '../../store'
import insightLogo from '../../assets/insight-logo.jpeg'

interface SidebarProps {
  onSelectNav?: (route: NavRoute) => void
  isOpenMobile?: boolean
  onCloseMobile?: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  onSelectNav,
  isOpenMobile,
  onCloseMobile,
}) => {
  const activeNav = useStore((s) => s.activeNav)
  const setActiveNav = useStore((s) => s.setActiveNav)
  const phase = useStore((s) => s.phase)
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed)
  const toggleSidebarCollapsed = useStore((s) => s.toggleSidebarCollapsed)

  const navItems: { id: NavRoute; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'business', label: 'Business Suite', icon: Briefcase },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'files', label: 'Files', icon: Folder },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'websearch', label: 'Web Search', icon: Globe },
    { id: 'system', label: 'System', icon: Cpu },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  // Global Ctrl + B shortcut to toggle sidebar collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggleSidebarCollapsed()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleSidebarCollapsed])

  const handleNav = (id: NavRoute) => {
    setActiveNav(id)
    onSelectNav?.(id)
    onCloseMobile?.()
  }

  const isOnline = phase !== 'offline' && phase !== 'boot'

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          className="gacks-sidebar-backdrop"
          onClick={onCloseMobile}
          aria-label="Close menu backdrop"
        />
      )}

      <aside
        className={`gacks-sidebar ${sidebarCollapsed ? 'gacks-sidebar-collapsed' : ''} ${
          isOpenMobile ? 'gacks-sidebar-open-mobile' : ''
        }`}
        aria-label="Navigation Sidebar"
      >
        {/* Top Header: Brand Logo & Collapse Trigger */}
        <div className="gacks-sidebar-top-section">
          <div
            className="gacks-sidebar-brand"
            onClick={() => handleNav('dashboard')}
            title="Insight Business Suite"
          >
            <div className="gacks-brand-logo-wrap">
              <img
                src={insightLogo}
                alt="Insight Business Suite"
                className="gacks-brand-logo-img"
                style={{ objectFit: 'contain' }}
              />
              <div className="gacks-brand-logo-glow" />
            </div>
            {!sidebarCollapsed && (
              <div className="gacks-brand-text">
                <h1 className="gacks-brand-title">INSIGHT</h1>
                <span className="gacks-brand-subtitle">BUSINESS SUITE</span>
              </div>
            )}
          </div>

          {/* Desktop Collapse / Expand Control Button */}
          <button
            type="button"
            className="gacks-sidebar-collapse-btn"
            onClick={toggleSidebarCollapsed}
            title={sidebarCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
            aria-label={sidebarCollapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'}
            aria-expanded={!sidebarCollapsed}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-gray-400 hover:text-white" />
            ) : (
              <PanelLeftClose className="w-4 h-4 text-gray-400 hover:text-white" />
            )}
          </button>

          {/* Mobile Close Button */}
          {isOpenMobile && (
            <button
              type="button"
              className="gacks-sidebar-mobile-close-btn"
              onClick={onCloseMobile}
              aria-label="Close mobile navigation"
            >
              <X className="w-4 h-4 text-gray-300" />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="gacks-sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeNav === item.id
            return (
              <button
                key={item.id}
                type="button"
                className={`gacks-nav-item ${isActive ? 'gacks-nav-item-active' : ''}`}
                onClick={() => handleNav(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className="gacks-nav-icon-wrap">
                  <Icon className="gacks-nav-icon" />
                </div>
                {!sidebarCollapsed && <span className="gacks-nav-label">{item.label}</span>}
                {isActive && <div className="gacks-nav-active-pill" />}
              </button>
            )
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="gacks-sidebar-footer">
          {/* Technical decorative lines */}
          <div className="gacks-tech-lines">
            <div className="gacks-tech-line gacks-tech-line-1" />
            <div className="gacks-tech-line gacks-tech-line-2" />
          </div>

          {/* Brand Motto (Signature removed) */}
          {!sidebarCollapsed && (
            <div className="gacks-motto-block">
              <div className="gacks-motto-words">
                <span>THINK</span>
                <span className="gacks-motto-sep">·</span>
                <span>PLAN</span>
                <span className="gacks-motto-sep">·</span>
                <span>EXECUTE</span>
              </div>
            </div>
          )}

          {/* Live Status Indicator */}
          <div className="gacks-status-pill">
            <div className="gacks-status-pill-inner">
              <span
                className={`gacks-status-dot ${
                  isOnline ? 'gacks-status-dot-online' : 'gacks-status-dot-standby'
                }`}
              />
              {!sidebarCollapsed && (
                <div className="gacks-status-pill-text">
                  <span className="gacks-status-title">
                    {phase === 'offline' ? 'Offline' : phase === 'boot' ? 'Initialising' : 'Online'}
                  </span>
                  <span className="gacks-status-desc">
                    {isOnline ? 'Always ready' : 'Click Initialise or Space'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
