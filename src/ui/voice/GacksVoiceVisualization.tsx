import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useStore, type Phase } from '../../store'
import { Mic, Volume2, Sparkles } from 'lucide-react'

// Active phases where the voice visualization should be visible
const ACTIVE_PHASES: Phase[] = ['waking', 'listening', 'thinking', 'tooling', 'speaking']

interface Particle {
  theta: number       // Latitude angle [-PI/2, PI/2]
  phi: number         // Longitude angle [0, 2*PI]
  baseRadius: number  // Distance from center (relative: 0.85 - 1.15)
  speedTheta: number  // Drift along latitude
  speedPhi: number    // Drift along longitude
  streamId: number    // 0 = Cloud, 1..6 = Orbital Stream Ribbons
  streamOffset: number
  size: number        // Particle diameter in pixels
  colorType: number   // 0: Cyan, 1: Deep Blue, 2: Electric Cyan, 3: Violet/Magenta, 4: Specular White
  pulsePhase: number  // Individual shimmer offset
}

export const GacksVoiceVisualization: React.FC = () => {
  const phase = useStore((s) => s.phase)
  const level = useStore((s) => s.level)
  const caption = useStore((s) => s.caption)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Transition visibility state
  const isActive = ACTIVE_PHASES.includes(phase)
  const [shouldRender, setShouldRender] = useState(isActive)
  const [transitionProgress, setTransitionProgress] = useState(isActive ? 1 : 0)

  // High-frequency animation values stored in refs to avoid React re-renders
  const animRef = useRef({
    smoothLevel: 0,
    time: 0,
    rotX: 0.15,
    rotY: 0,
    targetScale: isActive ? 1 : 0.88,
    scale: isActive ? 1 : 0.88,
    opacity: isActive ? 1 : 0,
  })

  // Check accessibility: prefers-reduced-motion
  const reducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  // Manage Show/Hide transition lifecycle
  useEffect(() => {
    if (isActive) {
      setShouldRender(true)
    }
  }, [isActive])

  // Canvas loop & particle simulation
  useEffect(() => {
    if (!shouldRender) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let animationFrameId = 0
    let lastTime = performance.now()

    // Determine canvas dimensions based on screen width
    const updateCanvasSize = () => {
      const isMobile = window.innerWidth < 640
      const isTablet = window.innerWidth < 1024
      const displaySize = isMobile ? 310 : isTablet ? 420 : 520
      const dpr = Math.min(window.devicePixelRatio || 1, 2)

      canvas.width = displaySize * dpr
      canvas.height = displaySize * dpr
      canvas.style.width = `${displaySize}px`
      canvas.style.height = `${displaySize}px`
    }
    updateCanvasSize()

    // Pre-render particle sprite textures for maximum 60 FPS performance
    const spriteColors = [
      'rgba(0, 240, 255, ',    // 0: Cyan Core
      'rgba(0, 130, 255, ',    // 1: Deep Blue
      'rgba(0, 210, 255, ',    // 2: Electric Cyan
      'rgba(192, 132, 252, ',  // 3: Violet / Magenta
      'rgba(255, 255, 255, ',  // 4: Specular White
    ]

    const preRenderedSprites: HTMLCanvasElement[] = spriteColors.map((colorPrefix) => {
      const spriteCanvas = document.createElement('canvas')
      spriteCanvas.width = 32
      spriteCanvas.height = 32
      const sctx = spriteCanvas.getContext('2d')
      if (sctx) {
        const radGrad = sctx.createRadialGradient(16, 16, 0, 16, 16, 16)
        radGrad.addColorStop(0, `${colorPrefix}1.0)`)
        radGrad.addColorStop(0.35, `${colorPrefix}0.75)`)
        radGrad.addColorStop(0.7, `${colorPrefix}0.25)`)
        radGrad.addColorStop(1, `${colorPrefix}0.0)`)
        sctx.fillStyle = radGrad
        sctx.fillRect(0, 0, 32, 32)
      }
      return spriteCanvas
    })

    // Generate ~2,800 particles
    // 60% Cloud Particles + 40% Flowing Orbital Stream Ribbons
    const TOTAL_PARTICLES = window.innerWidth < 640 ? 1600 : 2800
    const particles: Particle[] = []

    for (let i = 0; i < TOTAL_PARTICLES; i++) {
      const isStream = i < TOTAL_PARTICLES * 0.42
      const streamId = isStream ? (i % 7) + 1 : 0

      let theta: number
      let phi: number
      let baseRadius: number
      let speedPhi: number
      let colorType: number
      let size: number

      if (isStream) {
        // Stream ribbons wrapping around the sphere at tilted angles
        const streamProgress = (i / (TOTAL_PARTICLES * 0.42)) * Math.PI * 2
        phi = streamProgress
        // Wave inclination based on stream id
        const tilt = (streamId - 3.5) * 0.35
        theta = Math.sin(phi * 2 + streamId) * tilt + (Math.random() - 0.5) * 0.12
        baseRadius = 0.96 + Math.random() * 0.08
        speedPhi = (0.008 + (streamId % 3) * 0.003) * (streamId % 2 === 0 ? 1 : -1)
        colorType = Math.random() > 0.4 ? (Math.random() > 0.3 ? 0 : 2) : Math.random() > 0.5 ? 3 : 4
        size = 1.6 + Math.random() * 1.8
      } else {
        // Spherical surface and volumetric cloud using golden ratio
        const y = 1 - (i / (TOTAL_PARTICLES * 0.58)) * 2
        theta = Math.asin(Math.max(-1, Math.min(1, y)))
        phi = i * 2.39996323 // Golden angle
        baseRadius = 0.88 + Math.random() * 0.22 // Multi-layered depth
        speedPhi = (Math.random() - 0.5) * 0.003
        colorType = Math.random() > 0.35 ? (Math.random() > 0.4 ? 0 : 1) : Math.random() > 0.4 ? 3 : 4
        size = 1.0 + Math.random() * 1.6
      }

      particles.push({
        theta,
        phi,
        baseRadius,
        speedTheta: (Math.random() - 0.5) * 0.002,
        speedPhi,
        streamId,
        streamOffset: Math.random() * Math.PI * 2,
        size,
        colorType,
        pulsePhase: Math.random() * Math.PI * 2,
      })
    }

    // Main 60 FPS Render Loop
    const render = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1)
      lastTime = currentTime

      const st = useStore.getState()
      const currentPhase = st.phase
      const currentLevel = st.level || 0
      const active = ACTIVE_PHASES.includes(currentPhase)

      // Smooth audio loudness tracking
      const targetLevel = active ? currentLevel : 0
      animRef.current.smoothLevel += (targetLevel - animRef.current.smoothLevel) * 0.18

      // Transition progress (0 = fully hidden, 1 = fully active)
      if (active) {
        animRef.current.opacity = Math.min(1, animRef.current.opacity + dt * 3.5)
        animRef.current.scale = 0.88 + animRef.current.opacity * 0.12
      } else {
        animRef.current.opacity = Math.max(0, animRef.current.opacity - dt * 2.8)
        animRef.current.scale = 0.88 + animRef.current.opacity * 0.12
        if (animRef.current.opacity <= 0.005) {
          setShouldRender(false)
          setTransitionProgress(0)
          return // Stop animation loop when idle
        }
      }

      setTransitionProgress(animRef.current.opacity)

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const width = canvas.width / dpr
      const height = canvas.height / dpr
      const centerX = width / 2
      const centerY = height / 2
      const sphereRadius = width * 0.33 * animRef.current.scale

      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, width, height)

      // Background Atmospheric Radial Glow
      const glowIntensity = Math.min(1, 0.4 + animRef.current.smoothLevel * 0.6) * animRef.current.opacity
      const atmosphericGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        sphereRadius * 1.55
      )
      atmosphericGrad.addColorStop(0, `rgba(0, 163, 255, ${0.16 * glowIntensity})`)
      atmosphericGrad.addColorStop(0.35, `rgba(139, 92, 246, ${0.08 * glowIntensity})`)
      atmosphericGrad.addColorStop(0.7, `rgba(0, 210, 255, ${0.03 * glowIntensity})`)
      atmosphericGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')

      ctx.fillStyle = atmosphericGrad
      ctx.fillRect(0, 0, width, height)

      // Particle Simulation Time Steps
      const timeSpeed = reducedMotion
        ? 0.2
        : currentPhase === 'thinking'
        ? 2.2
        : currentPhase === 'speaking'
        ? 1.0 + animRef.current.smoothLevel * 2.0
        : 1.0

      animRef.current.time += dt * timeSpeed
      const t = animRef.current.time

      // Rotation angles
      if (!reducedMotion) {
        const rotYSpeed = currentPhase === 'thinking' ? 0.012 : 0.004
        animRef.current.rotY += rotYSpeed * timeSpeed
        animRef.current.rotX = 0.15 + Math.sin(t * 0.4) * 0.08
      }

      const cosX = Math.cos(animRef.current.rotX)
      const sinX = Math.sin(animRef.current.rotX)
      const cosY = Math.cos(animRef.current.rotY)
      const sinY = Math.sin(animRef.current.rotY)
      const fov = 550

      // Render Particles with 3D Depth Sorting
      // Sort in buckets for performance
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        // Advance angle positions
        p.phi += p.speedPhi * timeSpeed
        p.theta += p.speedTheta * timeSpeed

        // Audio reactivity displacement
        let r = p.baseRadius * sphereRadius
        if (currentPhase === 'speaking') {
          // Dynamic wave modulation driven by real voice amplitude
          const wave1 = Math.sin(p.theta * 4 + t * 5) * 0.24 * animRef.current.smoothLevel
          const wave2 = Math.cos(p.phi * 3 - t * 4) * 0.16 * animRef.current.smoothLevel
          r *= 1 + wave1 + wave2
        } else if (currentPhase === 'thinking') {
          // Intelligent thinking wave pulse
          const thinkWave = Math.sin(p.theta * 6 - t * 7 + p.streamId) * 0.08
          r *= 1 + thinkWave
        } else if (currentPhase === 'listening') {
          // Calm listening breath synced slightly with mic loudness
          const breath = Math.sin(t * 1.8) * 0.03 + animRef.current.smoothLevel * 0.12
          r *= 1 + breath
        }

        // 3D Spherical Coordinates
        const cosTheta = Math.cos(p.theta)
        const sinTheta = Math.sin(p.theta)
        const cosPhi = Math.cos(p.phi)
        const sinPhi = Math.sin(p.phi)

        const px = r * cosTheta * sinPhi
        const py = r * sinTheta
        const pz = r * cosTheta * cosPhi

        // 3D Rotations
        const y1 = py * cosX - pz * sinX
        const z1 = py * sinX + pz * cosX
        const x2 = px * cosY + z1 * sinY
        const z2 = -px * sinY + z1 * cosY

        // Perspective Projection
        const scale = fov / (fov + z2)
        const projX = centerX + x2 * scale
        const projY = centerY + y1 * scale

        // Depth Normalization [-sphereRadius, sphereRadius] -> [0, 1]
        const depth = Math.max(0, Math.min(1, (z2 + sphereRadius) / (2 * sphereRadius)))

        // Front vs Back Shading
        let alpha = (0.15 + depth * 0.8) * animRef.current.opacity
        if (currentPhase === 'speaking') {
          alpha = Math.min(1, alpha * (1 + animRef.current.smoothLevel * 0.4))
        }

        const renderSize = Math.max(1, p.size * scale * (0.6 + depth * 0.8))

        // Draw particle via pre-rendered sprite
        const sprite = preRenderedSprites[p.colorType]
        if (sprite && alpha > 0.02) {
          ctx.globalAlpha = alpha
          ctx.drawImage(
            sprite,
            projX - renderSize,
            projY - renderSize,
            renderSize * 2,
            renderSize * 2
          )
        }
      }

      ctx.restore()
      animationFrameId = requestAnimationFrame(render)
    }

    animationFrameId = requestAnimationFrame(render)

    window.addEventListener('resize', updateCanvasSize)

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', updateCanvasSize)
    }
  }, [shouldRender, reducedMotion])

  if (!shouldRender) return null

  // State Subtitle Label
  const stateLabel =
    phase === 'listening'
      ? 'LISTENING...'
      : phase === 'thinking' || phase === 'tooling'
      ? 'PROCESSING...'
      : phase === 'speaking'
      ? 'INSIGHT SPEAKING'
      : 'VOICE CORE'

  return (
    <div
      ref={containerRef}
      className="gacks-voice-overlay-root"
      style={{
        opacity: transitionProgress,
        transform: `translate(-50%, -50%) scale(${0.88 + transitionProgress * 0.12})`,
      }}
      aria-live="polite"
      aria-label={`Insight Voice Assistant: ${stateLabel}`}
    >
      {/* 3D Particle Canvas */}
      <div className="gacks-voice-canvas-container">
        <canvas ref={canvasRef} className="gacks-voice-particle-canvas" />

        {/* Ambient Outer Halo */}
        <div
          className="gacks-voice-outer-halo"
          style={{
            opacity: 0.3 + level * 0.5,
            transform: `scale(${1 + level * 0.12})`,
          }}
        />
      </div>

      {/* Floating Status HUD Pill beneath the Orb */}
      <div className="gacks-voice-status-pill">
        <div className="gacks-voice-status-icon-wrap">
          {phase === 'listening' ? (
            <Mic className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          ) : phase === 'speaking' ? (
            <Volume2 className="w-3.5 h-3.5 text-cyan-300" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-spin" />
          )}
        </div>

        <span className="gacks-voice-status-text">{stateLabel}</span>

        {/* Live Audio Equalizer Bars when speaking or listening */}
        {(phase === 'speaking' || phase === 'listening') && (
          <div className="gacks-voice-eq-bars">
            <span
              className="gacks-eq-bar"
              style={{ height: `${Math.max(3, Math.min(14, 4 + level * 18))}px` }}
            />
            <span
              className="gacks-eq-bar"
              style={{ height: `${Math.max(3, Math.min(14, 6 + level * 24))}px` }}
            />
            <span
              className="gacks-eq-bar"
              style={{ height: `${Math.max(3, Math.min(14, 3 + level * 16))}px` }}
            />
          </div>
        )}
      </div>

      {/* Spoken phrase subtitle display */}
      {caption && phase === 'speaking' && (
        <div className="gacks-voice-caption-wrap">
          <p className="gacks-voice-caption-text">{caption}</p>
        </div>
      )}
    </div>
  )
}
