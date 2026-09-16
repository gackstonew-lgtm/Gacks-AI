import React, { useState } from 'react'
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Trash2,
  CalendarDays,
  Sparkles,
} from 'lucide-react'
import { useStore, type CalendarEvent } from '../../store'

export const CalendarPage: React.FC = () => {
  const calendarEvents = useStore((s) => s.calendarEvents)
  const [events, setEvents] = useState<CalendarEvent[]>(calendarEvents)
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [color, setColor] = useState('#00A3FF')
  const [isAdding, setIsAdding] = useState(false)

  const now = new Date()
  const dayName = now.toLocaleDateString([], { weekday: 'long' })
  const dateNum = now.getDate()
  const monthName = now.toLocaleDateString([], { month: 'long', year: 'numeric' })

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !time.trim()) return
    const newEv: CalendarEvent = {
      id: `ev-${Date.now()}`,
      title: title.trim(),
      time: time.trim(),
      color,
    }
    setEvents([...events, newEv])
    setTitle('')
    setTime('')
    setIsAdding(false)
  }

  const handleDelete = (id: string) => {
    setEvents(events.filter((e) => e.id !== id))
  }

  return (
    <div className="gacks-page-container gacks-calendar-page">
      {/* Page Header */}
      <div className="gacks-page-header">
        <div className="gacks-page-title-wrap">
          <div className="gacks-page-icon-badge">
            <CalendarIcon className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <h1 className="gacks-page-title">CALENDAR & SCHEDULE</h1>
            <p className="gacks-page-subtitle">
              Structured daily trading sessions, project focus blocks, workouts, and milestones
            </p>
          </div>
        </div>

        <button
          type="button"
          className="gacks-btn-primary"
          onClick={() => setIsAdding(!isAdding)}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          <span>{isAdding ? 'Close Event Form' : 'Schedule Event'}</span>
        </button>
      </div>

      {/* Add Event Form Modal/Banner */}
      {isAdding && (
        <form onSubmit={handleAdd} className="gacks-calendar-add-banner">
          <div className="gacks-calendar-add-grid">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-mono text-gray-300">Event Title:</label>
              <input
                type="text"
                className="gacks-input"
                placeholder="e.g. Trading Session (Forex/Gold)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-mono text-gray-300">Time Window:</label>
              <input
                type="text"
                className="gacks-input"
                placeholder="e.g. 10:00 AM - 12:00 PM"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-mono text-gray-300">Color Tag:</label>
              <div className="flex items-center gap-2 pt-1">
                {['#00A3FF', '#FF5A36', '#10B981', '#F59E0B', '#8B5CF6'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                      color === c ? 'scale-125 border-white' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button
              type="button"
              className="gacks-btn-subtle"
              onClick={() => setIsAdding(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="gacks-btn-primary"
              disabled={!title.trim() || !time.trim()}
            >
              Confirm Schedule
            </button>
          </div>
        </form>
      )}

      {/* Calendar Layout: Left Big Date Card + Right Timeline */}
      <div className="gacks-calendar-layout-grid">
        {/* Big Date Card */}
        <div className="gacks-card gacks-calendar-hero-card">
          <div className="gacks-calendar-hero-top">
            <CalendarDays className="w-6 h-6 text-[#00A3FF]" />
            <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">
              Live Calendar
            </span>
          </div>

          <div className="gacks-calendar-hero-date">
            <span className="gacks-hero-date-num">{dateNum}</span>
            <span className="gacks-hero-date-day">{dayName}</span>
            <span className="gacks-hero-date-month">{monthName}</span>
          </div>

          <div className="gacks-calendar-hero-footer">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Sparkles className="w-3.5 h-3.5 text-orange-400" />
              <span>{events.length} planned routines for today</span>
            </div>
          </div>
        </div>

        {/* Timeline Events List */}
        <div className="gacks-card gacks-calendar-timeline-card">
          <div className="gacks-card-header">
            <div className="gacks-card-title-wrap">
              <Clock className="w-4 h-4 text-orange-500" />
              <h3 className="gacks-card-title">TODAY'S TIMELINE</h3>
            </div>
            <span className="text-xs font-mono text-gray-400">
              {events.length} Scheduled
            </span>
          </div>

          <div className="gacks-calendar-timeline-body">
            {events.length === 0 ? (
              <div className="gacks-tasks-empty">
                <Clock className="w-8 h-8 text-gray-600 mb-2" />
                <p className="text-gray-300 font-medium">No events scheduled.</p>
                <p className="text-xs text-gray-500">Click Schedule Event to plan your routine.</p>
              </div>
            ) : (
              <div className="gacks-calendar-event-stream">
                {events.map((ev) => (
                  <div key={ev.id} className="gacks-calendar-event-row">
                    <div
                      className="gacks-event-color-indicator"
                      style={{ backgroundColor: ev.color }}
                    />
                    <div className="gacks-event-detail-wrap">
                      <h4 className="gacks-event-name">{ev.title}</h4>
                      <span className="gacks-event-time-badge">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span>{ev.time}</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      className="gacks-task-delete-icon-btn"
                      onClick={() => handleDelete(ev.id)}
                      title="Remove event"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
