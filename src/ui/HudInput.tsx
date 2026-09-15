import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { useStore } from '../store'

export function HudInput() {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const submitQuery = useStore((s) => s.submitQuery)
  const phase = useStore((s) => s.phase)

  useEffect(() => {
    const handleGlobalKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleGlobalKey)
    return () => window.removeEventListener('keydown', handleGlobalKey)
  }, [])

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    submitQuery(trimmed)
    setText('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      inputRef.current?.blur()
    }
  }

  return (
    <div className="hud-input-dock">
      <div className="hud-input-pills">
        <button
          type="button"
          className="hud-pill"
          onClick={() => submitQuery('What is on my screen right now?')}
        >
          Inspect Screen
        </button>
        <button
          type="button"
          className="hud-pill"
          onClick={() => submitQuery('Check your system integrations status.')}
        >
          Check Integrations
        </button>
        <button
          type="button"
          className="hud-pill"
          onClick={() => submitQuery('Who are you and what are your capabilities?')}
        >
          Capabilities
        </button>
      </div>

      <div className="hud-input-bar">
        <span className="hud-input-prompt">›</span>
        <input
          ref={inputRef}
          type="text"
          className="hud-input-field"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask GACKS P.A anything... (Press / to focus)"
          disabled={phase === 'boot'}
          autoComplete="off"
          spellCheck="false"
        />
        <button
          type="button"
          className="hud-input-send"
          onClick={handleSubmit}
          disabled={!text.trim() || phase === 'boot'}
          title="Send query (Enter)"
        >
          SEND
        </button>
      </div>
    </div>
  )
}
