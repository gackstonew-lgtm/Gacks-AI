import React from 'react'
import {
  Search,
  CheckCircle2,
  Newspaper,
  Terminal,
  CloudSun,
  Wrench,
} from 'lucide-react'
import { useStore, type ActivityItem } from '../../store'

interface RecentActivityCardProps {
  onViewAll?: () => void
}

export const RecentActivityCard: React.FC<RecentActivityCardProps> = ({
  onViewAll,
}) => {
  const activities = useStore((s) => s.activities)

  const renderIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'research':
        return (
          <div className="gacks-activity-badge gacks-act-green">
            <Search className="w-3.5 h-3.5 text-emerald-400" />
          </div>
        )
      case 'task':
        return (
          <div className="gacks-activity-badge gacks-act-blue">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
          </div>
        )
      case 'news':
        return (
          <div className="gacks-activity-badge gacks-act-indigo">
            <Newspaper className="w-3.5 h-3.5 text-indigo-400" />
          </div>
        )
      case 'system':
        return (
          <div className="gacks-activity-badge gacks-act-orange">
            <Terminal className="w-3.5 h-3.5 text-orange-400" />
          </div>
        )
      case 'weather':
        return (
          <div className="gacks-activity-badge gacks-act-cyan">
            <CloudSun className="w-3.5 h-3.5 text-cyan-400" />
          </div>
        )
      case 'tool':
      default:
        return (
          <div className="gacks-activity-badge gacks-act-orange">
            <Wrench className="w-3.5 h-3.5 text-orange-400" />
          </div>
        )
    }
  }

  return (
    <div className="gacks-card gacks-activity-card">
      <div className="gacks-card-header">
        <div className="gacks-card-title-wrap">
          <span className="gacks-orange-bullet" />
          <h3 className="gacks-card-title">RECENT ACTIVITY</h3>
        </div>
        <button
          type="button"
          className="gacks-card-header-link"
          onClick={onViewAll}
        >
          View all
        </button>
      </div>

      <div className="gacks-activity-list">
        {activities.slice(0, 5).map((act) => (
          <div key={act.id} className="gacks-activity-row">
            <div className="gacks-activity-icon-col">{renderIcon(act.type)}</div>
            <div className="gacks-activity-content">
              <span className="gacks-activity-title">{act.title}</span>
              <span className="gacks-activity-subtitle">{act.subtitle}</span>
            </div>
            <div className="gacks-activity-time">{act.time}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
