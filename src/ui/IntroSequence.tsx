import React, { useEffect, useRef, useState, useCallback } from 'react'
import gacksLogo from '../assets/gacks-logo.png'
import './intro.css'

export type IntroStatus =
  | 'loading'
  | 'ready'
  | 'waiting_user_start'
  | 'playing'
  | 'completing'
  | 'error'
  | 'done'

interface IntroSequenceProps {
  onComplete: () => void
  onUserGesture?: () => void
}

export const IntroSequence: React.FC<IntroSequenceProps> = ({
  onComplete,
  onUserGesture,
}) => {
  const [status, setStatus] = useState<IntroStatus>('loading')
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const videoReady = useRef(false)
  const audioReady = useRef(false)
  const videoEnded = useRef(false)
  const audioEnded = useRef(false)

  const startedRef = useRef(false)
  const completedRef = useRef(false)
  const unmountedRef = useRef(false)

  // Maximum runtime safety watchdog (18s total) to avoid hanging if media events stall
  const watchdogTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 1. Finalize Sequence with controlled fade-out
  const finalizeSequence = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true

    if (watchdogTimer.current) {
      clearTimeout(watchdogTimer.current)
      watchdogTimer.current = null
    }

    setStatus('completing')

    try {
      if (videoRef.current) {
        videoRef.current.pause()
      }
      if (audioRef.current) {
        audioRef.current.pause()
      }
    } catch {
      // Ignored
    }

    setTimeout(() => {
      if (unmountedRef.current) return
      setStatus('done')
      onComplete()
    }, 650)
  }, [onComplete])

  // 2. Synchronized completion checker
  const checkCompletion = useCallback(() => {
    if (completedRef.current) return
    if (videoEnded.current && audioEnded.current) {
      finalizeSequence()
    }
  }, [finalizeSequence])

  // 3. Playback Start Attempt (handles browser autoplay permission)
  const attemptStart = useCallback(async () => {
    if (startedRef.current || completedRef.current) return

    try {
      const v = videoRef.current
      const a = audioRef.current
      if (!v || !a) return

      // Align positions to start
      v.currentTime = 0
      a.currentTime = 0

      // Simultaneous play call
      const vPromise = v.play()
      const aPromise = a.play()

      await Promise.all([vPromise, aPromise])

      if (unmountedRef.current) return
      startedRef.current = true
      setStatus('playing')

      // Set safety watchdog: 17s (video is ~13.3s, audio ~11.8s)
      watchdogTimer.current = setTimeout(() => {
        if (!completedRef.current) {
          console.warn('[GACKS Intro] Watchdog triggered, ensuring dashboard transition')
          finalizeSequence()
        }
      }, 17000)
    } catch (err) {
      if (unmountedRef.current) return
      console.info('[GACKS Intro] Autoplay blocked by browser policy:', err)
      setStatus('waiting_user_start')
    }
  }, [finalizeSequence])

  // 4. User Interaction Trigger (when autoplay is restricted)
  const handleUserStart = useCallback(async () => {
    if (startedRef.current || completedRef.current) return

    try {
      onUserGesture?.()
      const v = videoRef.current
      const a = audioRef.current

      if (v && a) {
        v.currentTime = 0
        a.currentTime = 0
        const vPromise = v.play()
        const aPromise = a.play()
        await Promise.all([vPromise, aPromise])
      } else if (v) {
        await v.play()
      }

      startedRef.current = true
      setStatus('playing')

      watchdogTimer.current = setTimeout(() => {
        if (!completedRef.current) {
          finalizeSequence()
        }
      }, 17000)
    } catch (err) {
      console.error('[GACKS Intro] Playback failed after user interaction:', err)
      finalizeSequence()
    }
  }, [finalizeSequence, onUserGesture])

  // 5. Media Event Handlers
  const handleVideoCanPlay = useCallback(() => {
    videoReady.current = true
    if (audioReady.current && !startedRef.current) {
      void attemptStart()
    }
  }, [attemptStart])

  const handleAudioCanPlay = useCallback(() => {
    audioReady.current = true
    if (videoReady.current && !startedRef.current) {
      void attemptStart()
    }
  }, [attemptStart])

  const handleVideoEnded = useCallback(() => {
    videoEnded.current = true
    checkCompletion()
  }, [checkCompletion])

  const handleAudioEnded = useCallback(() => {
    audioEnded.current = true
    checkCompletion()
  }, [checkCompletion])

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current
    const a = audioRef.current
    if (!v) return

    const duration = v.duration || 13.33
    const pct = Math.min(100, Math.max(0, (v.currentTime / duration) * 100))
    setProgress(pct)

    // Sync drift correction: Keep audio aligned with video if playing
    if (a && !audioEnded.current && !a.paused && !v.paused) {
      const drift = Math.abs(v.currentTime - a.currentTime)
      if (drift > 0.35) {
        a.currentTime = v.currentTime
      }
    }
  }, [])

  const handleVideoError = useCallback(() => {
    console.warn('[GACKS Intro] Video asset error')
    setErrorMsg('Video initialization failed. You can proceed to the dashboard.')
    setStatus('error')
  }, [])

  const handleAudioError = useCallback(() => {
    console.warn('[GACKS Intro] Audio asset error — proceeding with visual stream only')
    audioEnded.current = true
    // If video is still fine, allow it to continue without breaking the app
    if (videoReady.current && !startedRef.current) {
      void attemptStart()
    }
  }, [attemptStart])

  // 6. Keyboard shortcuts: [Escape] to skip, [Space] to start if waiting
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        finalizeSequence()
      } else if (e.code === 'Space' && status === 'waiting_user_start') {
        e.preventDefault()
        void handleUserStart()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [finalizeSequence, handleUserStart, status])

  // 7. Tab Visibility Handling: Resync if tab is un-hidden
  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden && startedRef.current && !completedRef.current) {
        const v = videoRef.current
        const a = audioRef.current
        if (v && a && !audioEnded.current && !v.paused && !a.paused) {
          const drift = Math.abs(v.currentTime - a.currentTime)
          if (drift > 0.3) {
            a.currentTime = v.currentTime
          }
        }
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // 8. Lifecycle cleanup
  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
      if (watchdogTimer.current) {
        clearTimeout(watchdogTimer.current)
      }
    }
  }, [])

  return (
    <div
      className={`gacks-intro-container ${status === 'completing' ? 'is-completing' : ''}`}
      role="region"
      aria-label="GACKS P.A Startup Sequence"
    >
      {/* Discreet Header Branding */}
      <header className="gacks-intro-header">
        <img src={gacksLogo} alt="GACKS" className="gacks-intro-logo" />
        <span className="gacks-intro-title">GACKS P.A // STARTUP SEQUENCE</span>
        <span className="gacks-intro-status-dot" aria-hidden="true" />
      </header>

      {/* Skip Button */}
      {status !== 'completing' && status !== 'done' && (
        <button
          type="button"
          className="gacks-intro-skip-btn"
          onClick={finalizeSequence}
          title="Skip intro and enter dashboard (Esc)"
        >
          <span>SKIP</span>
          <kbd>ESC</kbd>
        </button>
      )}

      {/* Main Video Presentation Stage */}
      <div className="gacks-intro-stage">
        <video
          ref={videoRef}
          src="/video/gacks%20INTRO.mp4"
          className="gacks-intro-video"
          playsInline
          muted={false}
          preload="auto"
          onCanPlay={handleVideoCanPlay}
          onEnded={handleVideoEnded}
          onTimeUpdate={handleTimeUpdate}
          onError={handleVideoError}
        />

        {/* Accompanying Audio Stream */}
        <audio
          ref={audioRef}
          src="/audio/gacks%20INTRO.mp3"
          preload="auto"
          onCanPlay={handleAudioCanPlay}
          onEnded={handleAudioEnded}
          onError={handleAudioError}
        />

        {/* Ambient Dark Vignette */}
        <div className="gacks-intro-vignette" />
      </div>

      {/* Progress Track along bottom */}
      <div className="gacks-intro-progress-track">
        <div
          className="gacks-intro-progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* State Overlay: Loading */}
      {status === 'loading' && (
        <div className="gacks-intro-overlay">
          <div className="gacks-intro-spinner" />
          <div className="gacks-intro-loading-text">
            INITIALIZING GACKS P.A STREAMS...
          </div>
        </div>
      )}

      {/* State Overlay: Waiting for User Gesture (Autoplay Restricted) */}
      {status === 'waiting_user_start' && (
        <div className="gacks-intro-overlay">
          <div className="gacks-intro-start-box">
            <div className="gacks-intro-reticle-ring">
              <div className="gacks-intro-reticle-inner">
                <img src={gacksLogo} alt="" style={{ width: 28, height: 28 }} />
              </div>
            </div>
            <h1 className="gacks-intro-start-heading">GACKS P.A</h1>
            <p className="gacks-intro-start-sub">
              System ready. Click below or press Space to enable synchronized audio & visual core.
            </p>
            <button
              type="button"
              className="gacks-intro-start-btn"
              onClick={handleUserStart}
            >
              INITIALIZE GACKS P.A
            </button>
            <div className="gacks-intro-hint">PRESS [SPACE] OR CLICK TO COMMENCE</div>
          </div>
        </div>
      )}

      {/* State Overlay: Error Fallback */}
      {status === 'error' && (
        <div className="gacks-intro-overlay">
          <div className="gacks-intro-error-box">
            <div className="gacks-intro-error-title">SYSTEM STARTUP WARNING</div>
            <div className="gacks-intro-error-msg">
              {errorMsg || 'A media stream could not be loaded.'}
            </div>
            <button
              type="button"
              className="gacks-intro-proceed-btn"
              onClick={finalizeSequence}
            >
              PROCEED TO DASHBOARD →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
