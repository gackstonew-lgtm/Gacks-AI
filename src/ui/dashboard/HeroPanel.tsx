import React, { useState } from 'react'
import { MessageSquare, Compass, PenTool, Cpu, Mic, Volume2, X, Image as ImageIcon } from 'lucide-react'
import { useStore, type Phase } from '../../store'
import insightLogo from '../../assets/insight-logo.jpeg'

interface HeroPanelProps {
  onTriggerMode?: (mode: 'Research' | 'Plan' | 'Create' | 'Automate') => void
  onToggleVoice?: () => void
}

export const HeroPanel: React.FC<HeroPanelProps> = ({
  onTriggerMode,
  onToggleVoice,
}) => {
  const phase = useStore((s) => s.phase)
  const userProfile = useStore((s) => s.userProfile)
  const submitQuery = useStore((s) => s.submitQuery)
  const caption = useStore((s) => s.caption)
  const activeTool = useStore((s) => s.activeTool)

  const [showAvatar, setShowAvatar] = useState<boolean>(() => {
    try {
      return localStorage.getItem('gacks_hero_avatar_visible') !== 'false'
    } catch {
      return true
    }
  })

  const toggleAvatarVisibility = (visible: boolean) => {
    setShowAvatar(visible)
    try {
      localStorage.setItem('gacks_hero_avatar_visible', visible ? 'true' : 'false')
    } catch {}
  }

  // Compute real time of day greeting
  const hour = new Date().getHours()
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'

  const stateLabels: Record<Phase, { text: string; color: string }> = {
    offline: { text: 'Standby — Click to Initialise', color: 'text-gray-400' },
    boot: { text: 'Initialising neural core...', color: 'text-amber-400' },
    dormant: { text: 'Online · Always Ready', color: 'text-emerald-400' },
    waking: { text: 'Waking up...', color: 'text-orange-400' },
    listening: { text: 'Listening to your voice...', color: 'text-orange-400' },
    thinking: { text: 'Reasoning with Gemini...', color: 'text-cyan-400' },
    tooling: { text: `Running tool: ${activeTool || 'system'}...`, color: 'text-purple-400' },
    speaking: { text: 'Speaking response...', color: 'text-emerald-400' },
  }

  const currentStatus = stateLabels[phase] || stateLabels.dormant

  const handleModeClick = (mode: 'Research' | 'Plan' | 'Create' | 'Automate') => {
    onTriggerMode?.(mode)
    if (mode === 'Research') {
      submitQuery('Please provide a research summary of recent high-impact market and tech developments.')
    } else if (mode === 'Plan') {
      submitQuery('Help me plan and optimize my day and schedule for maximum focus and execution.')
    } else if (mode === 'Create') {
      submitQuery('Assist me in drafting and creating high-quality content and architecture plans.')
    } else if (mode === 'Automate') {
      submitQuery('Check available tools and assist with workflow automation.')
    }
  }

  return (
    <section className="gacks-hero-panel" aria-label="Insight Business Suite">
      {/* Visual Left: Official Insight Business Suite Scalable Logo / Avatar */}
      {showAvatar ? (
        <div className="gacks-hero-visual-wrapper">
          <div
            className="gacks-hero-visual"
            onClick={onToggleVoice}
            title="Click to activate voice assistant"
          >
            <div className="gacks-hero-avatar-glow" />
            <div className="gacks-hero-avatar-container">
              <img
                src={userProfile.avatar || insightLogo}
                alt="Insight Business Suite"
                className="gacks-hero-avatar-img"
              />
              {/* Subtle glowing visor & HUD overlay effect */}
              <div className="gacks-hero-hud-arcs" />
              {phase === 'listening' && (
                <div className="gacks-hero-pulse-indicator">
                  <Mic className="w-4 h-4 text-orange-400 animate-pulse" />
                </div>
              )}
              {phase === 'speaking' && (
                <div className="gacks-hero-pulse-indicator">
                  <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            className="gacks-hero-avatar-hide-btn"
            onClick={(e) => {
              e.stopPropagation()
              toggleAvatarVisibility(false)
            }}
            title="Remove hero visual image"
            aria-label="Remove hero visual image"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="gacks-hero-avatar-restore-btn"
          onClick={() => toggleAvatarVisibility(true)}
          title="Restore hero visual image"
          aria-label="Restore hero visual image"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Show Visual</span>
        </button>
      )}

      {/* Content Right: Brand, Headline, Greeting, Mode Buttons */}
      <div className="gacks-hero-content">
        <div className="gacks-hero-header">
          <h2 className="gacks-hero-title">Insight Business Suite</h2>
          <p className="gacks-hero-tagline">Autonomous Enterprise AI Operating System</p>
          <p className="gacks-hero-description">
            Executive intelligence for business growth, marketing, analytics, and operational automation.
          </p>
        </div>

        {/* Dynamic Greeting & Live State Pill */}
        <div className="gacks-hero-status-pill">
          <div className="gacks-hero-status-dot-wrap">
            <span className={`gacks-hero-status-dot gacks-hero-status-dot-${phase}`} />
          </div>
          <div className="gacks-hero-greeting-text">
            <span className="gacks-hero-greeting-line">
              Good {timeOfDay}, {userProfile.name}
            </span>
            <span className="gacks-hero-subline">
              {caption ? `“${caption}”` : currentStatus.text}
            </span>
          </div>
        </div>

        {/* 4 Quick Mode Pill Buttons */}
        <div className="gacks-hero-modes">
          <button
            type="button"
            className="gacks-mode-btn"
            onClick={() => handleModeClick('Research')}
          >
            <MessageSquare className="gacks-mode-icon" />
            <span>Research</span>
          </button>
          <button
            type="button"
            className="gacks-mode-btn"
            onClick={() => handleModeClick('Plan')}
          >
            <Compass className="gacks-mode-icon" />
            <span>Plan</span>
          </button>
          <button
            type="button"
            className="gacks-mode-btn"
            onClick={() => handleModeClick('Create')}
          >
            <PenTool className="gacks-mode-icon" />
            <span>Create</span>
          </button>
          <button
            type="button"
            className="gacks-mode-btn"
            onClick={() => handleModeClick('Automate')}
          >
            <Cpu className="gacks-mode-icon" />
            <span>Automate</span>
          </button>
        </div>
      </div>
    </section>
  )
}
