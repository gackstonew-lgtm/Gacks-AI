import React from 'react'
import {
  LayoutDashboard,
  MessageSquare,
  CheckSquare,
  Folder,
  Calendar,
  Globe,
  Cpu,
  Settings,
} from 'lucide-react'
import { useStore, type NavRoute } from '../../store'
import gacksLogo from '../../assets/gacks-logo.png'
import gacksSig from '../../assets/gacks-signature.png'

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

  const navItems: { id: NavRoute; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'files', label: 'Files', icon: Folder },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'websearch', label: 'Web Search', icon: Globe },
    { id: 'system', label: 'System', icon: Cpu },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  const handleNav = (id: NavRoute) => {
    setActiveNav(id)
    onSelectNav?.(id)
    onCloseMobile?.()
  }

  const isOnline = phase !== 'offline' && phase !== 'boot'

  return (
    <aside
      className={`gacks-sidebar ${isOpenMobile ? 'gacks-sidebar-open-mobile' : ''}`}
      aria-label="Navigation Sidebar"
    >
      {/* Brand Header */}
      <div className="gacks-sidebar-brand" onClick={() => handleNav('dashboard')}>
        <div className="gacks-brand-logo-wrap">
          <img src={gacksLogo} alt="GACKS Helmet" className="gacks-brand-logo-img" />
          <div className="gacks-brand-logo-glow" />
        </div>
        <div className="gacks-brand-text">
          <h1 className="gacks-brand-title">GACKS</h1>
          <span className="gacks-brand-subtitle">AI ASSISTANT</span>
        </div>
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
            >
              <div className="gacks-nav-icon-wrap">
                <Icon className="gacks-nav-icon" />
              </div>
              <span className="gacks-nav-label">{item.label}</span>
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

        {/* Brand Motto & Signature */}
        <div className="gacks-motto-block">
          <div className="gacks-motto-words">
            <span>THINK</span>
            <span>PLAN</span>
            <span>EXECUTE</span>
          </div>
          <div className="gacks-sig-wrap">
            <img src={gacksSig} alt="Gacks Signature" className="gacks-sig-img" />
          </div>
        </div>

        {/* Live Status Pill */}
        <div className="gacks-status-pill">
          <div className="gacks-status-pill-inner">
            <span
              className={`gacks-status-dot ${isOnline ? 'gacks-status-dot-online' : 'gacks-status-dot-standby'}`}
            />
            <div className="gacks-status-pill-text">
              <span className="gacks-status-title">
                {phase === 'offline' ? 'Offline' : phase === 'boot' ? 'Initialising' : 'Online'}
              </span>
              <span className="gacks-status-desc">
                {isOnline ? 'Always here for you' : 'Click Initialise or Space'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
