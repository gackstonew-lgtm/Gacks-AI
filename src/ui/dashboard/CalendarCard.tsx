import React from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import { useStore } from '../../store'

interface CalendarCardProps {
  onViewAll?: () => void
}

export const CalendarCard: React.FC<CalendarCardProps> = ({ onViewAll }) => {
  const calendarEvents = useStore((s) => s.calendarEvents)

  const now = new Date()
  const dayName = now.toLocaleDateString([], { weekday: 'short' }).toUpperCase()
  const dayNum = now.getDate()
  const monthName = now.toLocaleDateString([], { month: 'short' }).toUpperCase()

  return (
    <div className="gacks-card gacks-calendar-card">
      <div className="gacks-card-header">
        <div className="gacks-card-title-wrap">
          <CalendarIcon className="w-4 h-4 text-orange-500" />
          <h3 className="gacks-card-title">CALENDAR</h3>
        </div>
        <button
          type="button"
          className="gacks-card-header-link"
          onClick={onViewAll}
        >
          View all
        </button>
      </div>

      <div className="gacks-calendar-body">
        {/* Left Date Block */}
        <div className="gacks-date-block">
          <span className="gacks-date-day-name">{dayName}</span>
          <span className="gacks-date-day-num">{dayNum}</span>
          <span className="gacks-date-month">{monthName}</span>
        </div>

        {/* Right Event Timeline */}
        <div className="gacks-calendar-timeline">
          <div className="gacks-timeline-kicker">Today</div>
          <div className="gacks-timeline-events">
            {calendarEvents.map((ev) => (
              <div key={ev.id} className="gacks-timeline-event">
                <span
                  className="gacks-timeline-dot"
                  style={{ backgroundColor: ev.color || '#ff6600' }}
                />
                <div className="gacks-event-text">
                  <span className="gacks-event-title">{ev.title}</span>
                  <span className="gacks-event-time">{ev.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
