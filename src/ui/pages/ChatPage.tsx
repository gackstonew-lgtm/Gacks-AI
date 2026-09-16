import React, { useState, useRef, useEffect } from 'react'
import {
  MessageSquare,
  Send,
  Mic,
  MicOff,
  Sparkles,
  Trash2,
  Cpu,
  Bot,
  User,
  Volume2,
} from 'lucide-react'
import { useStore, type Turn } from '../../store'

interface ChatPageProps {
  onToggleVoice?: () => void
}

export const ChatPage: React.FC<ChatPageProps> = ({ onToggleVoice }) => {
  const turns = useStore((s) => s.turns)
  const phase = useStore((s) => s.phase)
  const submitQuery = useStore((s) => s.submitQuery)
  const activeTool = useStore((s) => s.activeTool)
  const clearScreen = useStore((s) => s.clearScreen)
  const caption = useStore((s) => s.caption)
  const userProfile = useStore((s) => s.userProfile)
  const assistantName = useStore((s) => s.settings.general.customAssistantName || 'Insight')

  const [input, setInput] = useState('')
  const turnsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    turnsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, phase])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return
    submitQuery(trimmed)
    setInput('')
  }

  const promptSuggestions = [
    'Analyze gold (XAUUSD) and forex market trends today',
    'Review system health and active tool capabilities',
    'Create a 3-step action plan to optimize focus today',
    'Summarize latest breakthroughs in agentic AI architecture',
  ]

  return (
    <div className="gacks-page-container gacks-chat-page">
      {/* Page Header */}
      <div className="gacks-page-header">
        <div className="gacks-page-title-wrap">
          <div className="gacks-page-icon-badge">
            <MessageSquare className="w-4 h-4 text-[#00A3FF]" />
          </div>
          <div>
            <h1 className="gacks-page-title">AI CONVERSATION & COMMAND</h1>
            <p className="gacks-page-subtitle">
              Streaming multimodal agent intelligence powered by Google Gemini 2.5 Flash & Claude Sonnet
            </p>
          </div>
        </div>

        <div className="gacks-page-actions">
          {activeTool && (
            <div className="gacks-tool-active-chip">
              <Cpu className="w-3.5 h-3.5 text-purple-400 animate-spin" />
              <span>Tool: {activeTool}</span>
            </div>
          )}
          {turns.length > 0 && (
            <button
              type="button"
              className="gacks-btn-subtle"
              onClick={() => clearScreen('all')}
              title="Clear conversation history"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Session</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Conversation Stream */}
      <div className="gacks-chat-stream-viewport">
        {turns.length === 0 ? (
          <div className="gacks-chat-empty-state">
            <div className="gacks-chat-empty-glow" />
            <div className="gacks-chat-empty-icon">
              <Bot className="w-10 h-10 text-[#00A3FF]" />
            </div>
            <h2 className="gacks-chat-empty-title">Insight Business Suite Core Online</h2>
            <p className="gacks-chat-empty-desc">
              Ready to converse, plan, analyze live market data, inspect workspace files, or automate workflows.
            </p>
            <div className="gacks-chat-suggestions">
              <span className="text-xs font-mono text-[#00A3FF] uppercase tracking-wider mb-1">
                Suggested Prompts:
              </span>
              <div className="gacks-suggestions-grid">
                {promptSuggestions.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="gacks-suggestion-pill"
                    onClick={() => submitQuery(prompt)}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="gacks-chat-turn-list">
            {turns.map((t: Turn) => {
              const isUser = t.role === 'user'
              return (
                <div
                  key={t.id}
                  className={`gacks-turn-row ${isUser ? 'gacks-turn-user' : 'gacks-turn-assistant'}`}
                >
                  <div className="gacks-turn-avatar">
                    {isUser ? (
                      <User className="w-4 h-4 text-white" />
                    ) : (
                      <Bot className="w-4 h-4 text-[#00A3FF]" />
                    )}
                  </div>
                  <div className="gacks-turn-content">
                    <div className="gacks-turn-header">
                      <span className="gacks-turn-sender">
                        {isUser ? userProfile.name.toUpperCase() : assistantName.toUpperCase()}
                      </span>
                      {t.tools && t.tools.length > 0 && (
                        <div className="gacks-turn-tools-badge">
                          <Cpu className="w-3 h-3 text-purple-400" />
                          <span>{t.tools.join(', ')}</span>
                        </div>
                      )}
                    </div>
                    <div className="gacks-turn-bubble">
                      <p className="gacks-turn-text">{t.text}</p>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Thinking / Running Indicator */}
            {(phase === 'thinking' || phase === 'tooling') && (
              <div className="gacks-turn-row gacks-turn-assistant">
                <div className="gacks-turn-avatar">
                  <Bot className="w-4 h-4 text-[#00A3FF] animate-pulse" />
                </div>
                <div className="gacks-turn-content">
                  <div className="gacks-turn-header">
                    <span className="gacks-turn-sender">{assistantName.toUpperCase()}</span>
                  </div>
                  <div className="gacks-turn-bubble gacks-thinking-bubble">
                    <span className="gacks-pulse-dot" />
                    <span className="text-xs font-mono text-[#00A3FF]">
                      {phase === 'tooling'
                        ? `Executing tool: ${activeTool || 'system'}...`
                        : 'Reasoning and synthesizing response...'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={turnsEndRef} />
          </div>
        )}
      </div>

      {/* Floating spoken caption if voice is reading */}
      {caption && (
        <div className="gacks-chat-caption-bar">
          <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="gacks-caption-quote">“{caption}”</span>
        </div>
      )}

      {/* Persistent Bottom Chat Input */}
      <form onSubmit={handleSubmit} className="gacks-chat-composer">
        <button
          type="button"
          className={`gacks-composer-mic-btn ${
            phase === 'listening'
              ? 'gacks-mic-listening'
              : phase === 'speaking'
              ? 'gacks-mic-speaking'
              : ''
          }`}
          onClick={onToggleVoice}
          title="Toggle Voice Input (Space or 'Hey Gacks')"
          aria-label="Toggle voice input"
        >
          {phase === 'listening' ? (
            <Mic className="w-4 h-4 text-white animate-pulse" />
          ) : (
            <MicOff className="w-4 h-4 text-gray-400" />
          )}
        </button>

        <input
          type="text"
          className="gacks-composer-input"
          placeholder="Ask Gacks anything, request analysis, or issue an agent tool command..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
        />

        <button
          type="submit"
          className="gacks-composer-send-btn"
          disabled={!input.trim()}
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}
