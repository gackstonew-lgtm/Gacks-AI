import React, { useState, useEffect, useRef } from 'react'
import { Search, Sun, Cloud, CloudRain, ChevronDown, Sparkles, Menu } from 'lucide-react'
import { useStore } from '../../store'
import gacksAvatar from '../../assets/gacks-avatar.png'

interface TopBarProps {
  onOpenMobileMenu?: () => void
  onOpenSettings?: () => void
  onOpenChat?: () => void
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenMobileMenu,
  onOpenSettings,
  onOpenChat,
}) => {
  const [query, setQuery] = useState('')
  const [timeStr, setTimeStr] = useState('')
  const [dateStr, setDateStr] = useState('')
  const [weather, setWeather] = useState<{ temp: string; city: string; desc: string; icon: string }>({
    temp: '22°C',
    city: 'Nairobi',
    desc: 'Sunny',
    icon: 'sun',
  })
  const [profileOpen, setProfileOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const submitQuery = useStore((s) => s.submitQuery)
  const userProfile = useStore((s) => s.userProfile)
  const logActivity = useStore((s) => s.logActivity)

  // 1. Live Real Time and Date
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const date = now.toLocaleDateString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
      setTimeStr(time)
      setDateStr(date)
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  // 2. Ctrl + K Keyboard Shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 3. Truthful Local Weather Fetch (Open-Meteo free public API, zero key needed)
  useEffect(() => {
    let cancelled = false
    const fetchWeather = async () => {
      try {
        // Nairobi default coordinates (lat -1.29, lon 36.82)
        const res = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=-1.2921&longitude=36.8219&current_weather=true',
        )
        if (!res.ok) return
        const data = await res.json()
        if (cancelled || !data?.current_weather) return
        const temp = Math.round(data.current_weather.temperature)
        const code = data.current_weather.weathercode
        let desc = 'Clear'
        let icon = 'sun'
        if (code >= 1 && code <= 3) {
          desc = 'Partly Cloudy'
          icon = 'cloud'
        } else if (code >= 51 && code <= 67) {
          desc = 'Rainy'
          icon = 'rain'
        } else if (code >= 80) {
          desc = 'Showers'
          icon = 'rain'
        }
        setWeather({
          temp: `${temp}°C`,
          city: 'Nairobi',
          desc,
          icon,
        })
      } catch {
        // Graceful offline fallback
      }
    }
    fetchWeather()
    const interval = setInterval(fetchWeather, 300000) // every 5 mins
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    logActivity({
      title: trimmed.length > 35 ? `${trimmed.slice(0, 35)}...` : trimmed,
      subtitle: 'AI prompt dispatched',
      type: 'research',
    })
    submitQuery(trimmed)
    setQuery('')
    onOpenChat?.()
  }

  return (
    <header className="gacks-topbar">
      <div className="gacks-topbar-left">
        {/* Mobile menu trigger */}
        <button
          type="button"
          className="gacks-mobile-menu-btn"
          onClick={onOpenMobileMenu}
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5 text-gray-300" />
        </button>

        {/* Command / Search Input */}
        <form className="gacks-command-form" onSubmit={handleSubmit}>
          <Search className="gacks-command-icon" />
          <input
            ref={inputRef}
            type="text"
            className="gacks-command-input"
            placeholder="Ask Gacks anything..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="gacks-command-shortcut">Ctrl + K</kbd>
        </form>
      </div>

      <div className="gacks-topbar-right">
        {/* Real Digital Clock */}
        <div className="gacks-clock-widget">
          <span className="gacks-clock-time">{timeStr || '12:48 PM'}</span>
          <span className="gacks-clock-date">{dateStr || 'Sat, Sep 13, 2025'}</span>
        </div>

        {/* Real Weather Pill */}
        <div className="gacks-weather-pill" title={`${weather.city} · ${weather.desc}`}>
          <div className="gacks-weather-icon-wrap">
            {weather.icon === 'cloud' ? (
              <Cloud className="gacks-weather-icon" />
            ) : weather.icon === 'rain' ? (
              <CloudRain className="gacks-weather-icon" />
            ) : (
              <Sun className="gacks-weather-icon" />
            )}
          </div>
          <div className="gacks-weather-details">
            <div className="gacks-weather-location">{weather.city}</div>
            <div className="gacks-weather-temp">
              <span>{weather.temp}</span>
              <span className="gacks-weather-desc">{weather.desc}</span>
            </div>
          </div>
        </div>

        {/* User Profile Pill */}
        <div className="gacks-profile-pill-wrap">
          <button
            type="button"
            className="gacks-profile-pill"
            onClick={() => setProfileOpen(!profileOpen)}
            aria-expanded={profileOpen}
          >
            <div className="gacks-profile-avatar">
              <img
                src={gacksAvatar}
                alt={userProfile.name}
                className="w-full h-full object-cover"
                style={{ objectPosition: 'center 20%' }}
              />
            </div>
            <div className="gacks-profile-info">
              <span className="gacks-profile-name">{userProfile.name}</span>
              <span className="gacks-profile-sub">{userProfile.subtitle}</span>
            </div>
            <ChevronDown className="gacks-profile-chevron" />
          </button>

          {/* Profile Dropdown */}
          {profileOpen && (
            <div className="gacks-profile-dropdown">
              <div className="gacks-dropdown-header">
                <span className="text-xs text-orange-400 font-mono">GACKS P.A OPERATOR</span>
                <span className="text-sm text-white font-semibold">{userProfile.name}</span>
              </div>
              <div className="gacks-dropdown-divider" />
              <button
                type="button"
                className="gacks-dropdown-item"
                onClick={() => {
                  setProfileOpen(false)
                  onOpenSettings?.()
                }}
              >
                <Sparkles className="w-4 h-4 text-orange-400" />
                <span>Account & Preferences</span>
              </button>
              <button
                type="button"
                className="gacks-dropdown-item"
                onClick={() => {
                  setProfileOpen(false)
                  onOpenChat?.()
                }}
              >
                <Search className="w-4 h-4 text-cyan-400" />
                <span>Assistant Session</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
