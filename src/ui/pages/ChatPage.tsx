import React, { useState, useRef, useEffect, useCallback } from 'react'
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
  Layers,
  ChevronDown,
  Check,
  Zap,
  Globe,
  Brain,
} from 'lucide-react'
import { useStore, type Turn } from '../../store'
import { apiClient, type ModelDescriptor } from '../../lib/api-client'

interface ChatPageProps {
  onToggleVoice?: () => void
}

const PROVIDER_COLORS: Record<string, string> = {
  gemini: '#4285F4',
  anthropic: '#C06A3D',
  openai: '#10A37F',
  groq: '#F55036',
  mistral: '#FF7000',
  openrouter: '#7C3AED',
  litellm: '#0284C7',
  ollama: '#22C55E',
  llamacpp: '#EAB308',
}

const FEATURE_CARDS = [
  {
    icon: Brain,
    iconColor: '#20D8D0',
    title: 'Limitless Cognitive Power',
    desc: 'Get bold, original insights that push boundaries and unlock new possibilities, all in real-time.',
  },
  {
    icon: Zap,
    iconColor: '#319CFF',
    title: 'Zero-Lag, Full Awareness',
    desc: 'Receive instant, context-sensitive responses that adjust seamlessly to your needs and workflow.',
  },
  {
    icon: Globe,
    iconColor: '#7167FF',
    title: 'Intuition Meets Intelligence',
    desc: 'Enjoy human-like, intuitive interactions with AI that processes ideas and thinks faster than any human.',
  },
]

const COMPOSER_PILLS = [
  'Think Bigger',
  'Deep Search',
  'Brainstorm Mode',
  'Quick Fire',
  'Insight Generator',
]

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
  const [models, setModels] = useState<ModelDescriptor[]>([])
  const [activeModelId, setActiveModelId] = useState<string>('')
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const turnsEndRef = useRef<HTMLDivElement>(null)

  const loadModelsAndPrefs = useCallback(async () => {
    try {
      const [modelsRes, prefsRes] = await Promise.allSettled([
        apiClient.getModels(),
        apiClient.getModelPreferences(),
      ])
      if (modelsRes.status === 'fulfilled' && modelsRes.value.ok) {
        const fetched = modelsRes.value.data?.models ?? []
        setModels(fetched)
        if (prefsRes.status === 'fulfilled' && prefsRes.value.ok && prefsRes.value.data?.preferredModelId) {
          setActiveModelId(prefsRes.value.data.preferredModelId)
        } else if (fetched.length > 0) {
          setActiveModelId((prev) => prev || fetched[0].id)
        }
      }
    } catch {
      // Offline graceful resilience
    }
  }, [])

  useEffect(() => {
    loadModelsAndPrefs()
  }, [loadModelsAndPrefs])

  useEffect(() => {
    turnsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, phase])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsModelDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectModel = async (modelId: string) => {
    setActiveModelId(modelId)
    setIsModelDropdownOpen(false)
    try {
      await apiClient.updateModelPreferences({ preferredModelId: modelId })
    } catch {
      // local state remains active
    }
  }

  const activeModel = models.find((m) => m.id === activeModelId) || {
    id: activeModelId || 'auto',
    displayName: activeModelId.includes('claude')
      ? 'Claude 3.5 Sonnet'
      : activeModelId.includes('gpt')
      ? 'GPT-4o'
      : activeModelId.includes('sonar')
      ? 'Perplexity Sonar'
      : activeModelId.includes('litellm')
      ? 'LiteLLM Gateway'
      : activeModelId.includes('gemini')
      ? 'Gemini 2.5 Flash'
      : 'Dynamic Auto Core',
    provider: activeModelId.split(':')[0] || 'auto',
  }

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

  const hasConversation = turns.length > 0

  return (
    <div className="gacks-page-container gacks-chat-page">
      {/* Page Header */}
      <div className="gacks-page-header">
        <div className="gacks-page-title-wrap">
          <div className="gacks-page-icon-badge">
            <MessageSquare className="w-4 h-4 text-[#20D8D0]" />
          </div>
          <div>
            <h1 className="gacks-page-title">AI CONVERSATION &amp; COMMAND</h1>
            <p className="gacks-page-subtitle">
              Active Core: <span className="text-[#20D8D0] font-semibold">{activeModel.displayName}</span> ({activeModel.provider.toUpperCase()}) — Streaming agent intelligence with multi-model failover
            </p>
          </div>
        </div>

        <div className="gacks-page-actions">
          {/* Dynamic Model Switcher Dropdown */}
          <div className="relative inline-block" ref={dropdownRef}>
            <button
              type="button"
              className="gacks-btn-subtle flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-[#0D1118] hover:bg-[#111722] hover:border-[#20D8D0]/40 transition-colors"
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              title="Switch Active AI Model"
              aria-label="Switch Active AI Model"
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: PROVIDER_COLORS[activeModel.provider] || '#20D8D0' }}
              />
              <Layers className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs font-mono text-gray-200 max-w-[140px] truncate">
                {activeModel.displayName}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>

            {isModelDropdownOpen && (
              <div
                className="absolute right-0 mt-1.5 w-64 max-h-80 overflow-y-auto rounded-xl border border-white/15 bg-[#0D1118] shadow-2xl z-50 py-1.5 backdrop-blur-xl"
                style={{
                  boxShadow: '0 10px 30px rgba(0,0,0,0.8), 0 0 15px rgba(32,216,208,0.08)',
                }}
              >
                <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-gray-400 border-b border-white/10">
                  Select Active Model
                </div>
                {models.length > 0 ? (
                  models.map((m) => {
                    const isSelected = m.id === activeModelId
                    const dotColor = PROVIDER_COLORS[m.provider] || '#20D8D0'
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-white/5 transition-colors ${
                          isSelected ? 'bg-[#20D8D0]/10 text-[#20D8D0]' : 'text-gray-300'
                        }`}
                        onClick={() => handleSelectModel(m.id)}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: dotColor }}
                          />
                          <div className="truncate">
                            <div className="font-medium truncate">{m.displayName}</div>
                            <div className="text-[10px] font-mono text-gray-500 uppercase">
                              {m.provider} • {m.isLocal ? 'Local' : 'Cloud'}
                            </div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#20D8D0] shrink-0" />}
                      </button>
                    )
                  })
                ) : (
                  <div className="p-3 text-center text-xs text-gray-500 font-mono">
                    Defaulting to Gemini 2.5 Flash
                  </div>
                )}
              </div>
            )}
          </div>

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

      {/* ------------------------------------------------------------------ */}
      {/* WELCOME / EMPTY STATE — ZeroPoint Design                           */}
      {/* ------------------------------------------------------------------ */}
      {!hasConversation && (
        <div className="gacks-chat-welcome-root">
          {/* Atmospheric background glow */}
          <div className="gacks-chat-atmo-glow" />

          {/* Brand icon */}
          <div className="gacks-chat-brand-orb">
            <Bot className="w-9 h-9" style={{ color: '#20D8D0' }} />
          </div>

          {/* Heading */}
          <h2 className="gacks-chat-welcome-heading">
            Welcome to <span className="gacks-chat-brand-accent">Gacks AI</span>
          </h2>
          <p className="gacks-chat-welcome-tag">
            Introducing Gacks AI — an advanced AI built to challenge assumptions, generate fearless ideas, and help you think beyond the obvious. Fast. Bold. Unfiltered.
          </p>

          {/* Centered Welcome Composer */}
          <div className="gacks-chat-welcome-composer-wrap">
            <form onSubmit={handleSubmit} className="gacks-chat-welcome-form">
              <div className="gacks-chat-welcome-input-row">
                {/* Mic button */}
                <button
                  type="button"
                  className={`gacks-composer-mic-btn gacks-welcome-mic ${
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
                  className="gacks-chat-welcome-input"
                  placeholder="Ask Anythink..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  autoFocus
                />

                <button
                  type="submit"
                  className="gacks-composer-send-btn gacks-welcome-send"
                  disabled={!input.trim()}
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {/* Decorative toolbar pills */}
              <div className="gacks-composer-toolbar">
                {COMPOSER_PILLS.map((pill) => (
                  <button
                    key={pill}
                    type="button"
                    className="gacks-composer-pill"
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    {pill}
                  </button>
                ))}
              </div>
            </form>
          </div>

          {/* Feature cards */}
          <div className="gacks-chat-feature-cards">
            {FEATURE_CARDS.map((card) => {
              const Icon = card.icon
              return (
                <div key={card.title} className="gacks-chat-feature-card">
                  <div className="gacks-feature-card-icon-wrap">
                    <Icon className="w-5 h-5" style={{ color: card.iconColor }} />
                  </div>
                  <h3 className="gacks-feature-card-title">{card.title}</h3>
                  <p className="gacks-feature-card-desc">{card.desc}</p>
                </div>
              )
            })}
          </div>

          {/* Suggested prompts */}
          <div className="gacks-chat-suggestions gacks-welcome-suggestions">
            <span className="text-xs font-mono text-[#20D8D0] uppercase tracking-wider mb-1">
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
      )}

      {/* ------------------------------------------------------------------ */}
      {/* CONVERSATION STREAM — active conversation                          */}
      {/* ------------------------------------------------------------------ */}
      {hasConversation && (
        <>
          <div className="gacks-chat-stream-viewport gacks-chat-has-turns">
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
                        <Bot className="w-4 h-4" style={{ color: '#20D8D0' }} />
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
                    <Bot className="w-4 h-4 animate-pulse" style={{ color: '#20D8D0' }} />
                  </div>
                  <div className="gacks-turn-content">
                    <div className="gacks-turn-header">
                      <span className="gacks-turn-sender">{assistantName.toUpperCase()}</span>
                    </div>
                    <div className="gacks-turn-bubble gacks-thinking-bubble">
                      <span className="gacks-pulse-dot" />
                      <span className="text-xs font-mono" style={{ color: '#20D8D0' }}>
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
          </div>

          {/* Floating spoken caption if voice is reading */}
          {caption && (
            <div className="gacks-chat-caption-bar">
              <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="gacks-caption-quote">"{caption}"</span>
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
        </>
      )}
    </div>
  )
}
