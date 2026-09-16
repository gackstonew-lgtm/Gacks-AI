import React from 'react'
import {
  MessageSquare,
  Folder,
  Calendar,
  Globe,
  Settings,
  Briefcase,
  LayoutGrid,
} from 'lucide-react'
import { useStore, type NavRoute } from '../../store'

interface QuickActionsCardProps {
  onActionClick?: (actionId: NavRoute | string) => void
}

export const QuickActionsCard: React.FC<QuickActionsCardProps> = ({
  onActionClick,
}) => {
  const setActiveNav = useStore((s) => s.setActiveNav)
  const logActivity = useStore((s) => s.logActivity)

  const actions = [
    {
      id: 'business' as NavRoute,
      title: 'Business Suite',
      desc: 'Growth, CRM & Ops',
      icon: Briefcase,
    },
    {
      id: 'chat' as NavRoute,
      title: 'Start Chat',
      desc: 'Ask Insight anything',
      icon: MessageSquare,
    },
    {
      id: 'files' as NavRoute,
      title: 'Manage Files',
      desc: 'Access workspace',
      icon: Folder,
    },
    {
      id: 'calendar' as NavRoute,
      title: 'Plan My Day',
      desc: 'Calendar & priorities',
      icon: Calendar,
    },
    {
      id: 'websearch' as NavRoute,
      title: 'Web Search',
      desc: 'WebHunt research',
      icon: Globe,
    },
    {
      id: 'settings' as NavRoute,
      title: 'Settings',
      desc: 'Customize Insight Suite',
      icon: Settings,
    },
  ]

  const handleAction = (id: NavRoute) => {
    logActivity({
      title: `Activated ${id.toUpperCase()}`,
      subtitle: 'Quick action',
      type: 'tool',
    })
    if (onActionClick) {
      onActionClick(id)
    } else {
      setActiveNav(id)
    }
  }

  return (
    <div className="gacks-card gacks-quickactions-card">
      <div className="gacks-card-header">
        <div className="gacks-card-title-wrap">
          <LayoutGrid className="w-4 h-4 text-[#00A3FF]" />
          <h3 className="gacks-card-title">QUICK ACTIONS</h3>
        </div>
      </div>

      <div className="gacks-quickactions-grid">
        {actions.map((act) => {
          const Icon = act.icon
          return (
            <button
              key={act.id}
              type="button"
              className="gacks-action-tile"
              onClick={() => handleAction(act.id)}
            >
              <div className="gacks-action-icon-wrap">
                <Icon className="gacks-action-icon" />
              </div>
              <div className="gacks-action-text">
                <span className="gacks-action-title">{act.title}</span>
                <span className="gacks-action-desc">{act.desc}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
