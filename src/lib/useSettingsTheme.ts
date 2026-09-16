import { useEffect } from 'react'
import { useStore } from '../store'

export function useSettingsTheme() {
  const general = useStore((s) => s.settings.general)

  useEffect(() => {
    if (!general) return
    const root = document.documentElement

    // 1. Theme (Dark, Light, System, Cyber-Black, Deep-Space)
    let resolvedTheme: string = general.theme || 'dark'
    if (resolvedTheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      resolvedTheme = prefersDark ? 'dark' : 'light'
    } else if (resolvedTheme === 'dark-charcoal') {
      resolvedTheme = 'dark'
    }
    root.setAttribute('data-theme', resolvedTheme)

    // 2. Accent Color
    const accent = general.accentColor || '#00A3FF'
    root.style.setProperty('--gacks-cyan', accent)
    root.style.setProperty('--gacks-border-cyan', accent)
    root.style.setProperty('--gacks-accent', accent)
    root.style.setProperty('--gacks-cyan-glow', `${accent}40`)

    // 3. Density (compact, comfortable, spacious)
    root.setAttribute('data-density', general.density || 'comfortable')

    // 4. Glassmorphism (low, medium, high)
    let glass = 'medium'
    if (typeof general.glassIntensity === 'string') {
      glass = general.glassIntensity
    } else if (typeof general.glassIntensity === 'number') {
      if (general.glassIntensity > 35) glass = 'high'
      else if (general.glassIntensity < 15) glass = 'low'
      else glass = 'medium'
    }
    root.setAttribute('data-glass', glass)

    // 5. Font Size (sm, md, lg)
    root.setAttribute('data-font-size', general.fontSize || 'md')

    // 6. Animations (true / false)
    root.setAttribute('data-animations', String(general.animationsEnabled !== false))

    // 7. Background Grid (true / false)
    root.setAttribute('data-background-grid', String(general.backgroundGrid !== false))

    // 8. Compact Mode
    root.setAttribute('data-compact-mode', String(!!general.compactMode))

    // 9. Fullscreen Mode
    if (general.fullscreenMode && !document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {})
    } else if (!general.fullscreenMode && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {})
    }
  }, [general])
}
