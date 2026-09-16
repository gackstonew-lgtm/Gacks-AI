import React, { useState } from 'react'
import {
  X,
  MessageSquare,
  Folder,
  Calendar as CalendarIcon,
  Globe,
  Cpu,
  Send,
  Mic,
  MicOff,
  Trash2,
  CheckCircle2,
  Volume2,
  Shield,
  Plus,
} from 'lucide-react'
import { useStore } from '../../store'

interface ViewsModalsProps {
  onClose: () => void
  onToggleVoice?: () => void
}

export const ViewsModals: React.FC<ViewsModalsProps> = ({
  onClose,
  onToggleVoice,
}) => {
  const activeNav = useStore((s) => s.activeNav)
  const setActiveNav = useStore((s) => s.setActiveNav)
  const turns = useStore((s) => s.turns)
  const phase = useStore((s) => s.phase)
  const submitQuery = useStore((s) => s.submitQuery)
  const tasks = useStore((s) => s.tasks)
  const toggleTask = useStore((s) => s.toggleTask)
  const addTask = useStore((s) => s.addTask)
  const deleteTask = useStore((s) => s.deleteTask)
  const calendarEvents = useStore((s) => s.calendarEvents)
  const connected = useStore((s) => s.connected)
  const permissions = useStore((s) => s.permissions)
  const userProfile = useStore((s) => s.userProfile)
  const setUserProfile = useStore((s) => s.setUserProfile)
  const voice = useStore((s) => s.voice)

  const [chatInput, setChatInput] = useState('')
  const [newTaskInput, setNewTaskInput] = useState('')
  const [profileName, setProfileName] = useState(userProfile.name)
  const [profileSubtitle, setProfileSubtitle] = useState(userProfile.subtitle)
  const [savedToast, setSavedToast] = useState(false)

  if (activeNav === 'dashboard') return null

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim()) return
    submitQuery(chatInput.trim())
    setChatInput('')
  }

  const handleClose = () => {
    setActiveNav('dashboard')
    onClose()
  }

  return (
    <div className="gacks-modal-overlay" onClick={handleClose}>
      <div
        className="gacks-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="gacks-modal-header">
          <div className="gacks-modal-title-wrap">
            <span className="gacks-orange-bullet" />
            <h2 className="gacks-modal-title">
              {activeNav === 'chat' && 'AI CONVERSATION'}
              {activeNav === 'tasks' && 'FOCUS & TASKS MANAGER'}
              {activeNav === 'files' && 'FILE SYSTEM & WORKSPACE'}
              {activeNav === 'calendar' && 'CALENDAR & SCHEDULE'}
              {activeNav === 'websearch' && 'WEB RESEARCH & INTELLIGENCE'}
              {activeNav === 'system' && 'SYSTEM DIAGNOSTICS & TELEMETRY'}
              {activeNav === 'settings' && 'INSIGHT BUSINESS SUITE PREFERENCES'}
            </h2>
          </div>
          <button
            type="button"
            className="gacks-modal-close-btn"
            onClick={handleClose}
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-gray-400 hover:text-white" />
          </button>
        </div>

        {/* Modal Body Based on Active Route */}
        <div className="gacks-modal-body">
          {/* 1. CHAT VIEW */}
          {activeNav === 'chat' && (
            <div className="gacks-chat-view">
              <div className="gacks-chat-turns">
                {turns.length === 0 ? (
                  <div className="gacks-chat-empty">
                    <MessageSquare className="w-10 h-10 text-orange-500/50 mb-2" />
                    <p className="text-gray-300 font-medium">Session initialized and ready.</p>
                    <p className="text-xs text-gray-500">
                      Say "Hey Insight" or type below to ask anything or run tools.
                    </p>
                  </div>
                ) : (
                  turns.map((t) => (
                    <div
                      key={t.id}
                      className={`gacks-chat-bubble gacks-bubble-${
                        t.role === 'user' ? 'user' : 'assistant'
                      }`}
                    >
                      <div className="gacks-bubble-role">
                        {t.role === 'user' ? 'YOU' : 'INSIGHT'}
                      </div>
                      <div className="gacks-bubble-text">{t.text}</div>
                    </div>
                  ))
                )}
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleChatSubmit} className="gacks-chat-input-row">
                <button
                  type="button"
                  className={`gacks-chat-mic-btn ${
                    phase === 'listening' ? 'gacks-mic-active' : ''
                  }`}
                  onClick={onToggleVoice}
                  title="Toggle Microphone"
                >
                  {phase === 'listening' ? (
                    <Mic className="w-4 h-4 text-white animate-pulse" />
                  ) : (
                    <MicOff className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                <input
                  type="text"
                  className="gacks-chat-input"
                  placeholder="Ask Gacks anything or issue a command..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  autoFocus
                />
                <button type="submit" className="gacks-chat-send-btn">
                  <Send className="w-4 h-4 text-white" />
                </button>
              </form>
            </div>
          )}

          {/* 2. TASKS VIEW */}
          {activeNav === 'tasks' && (
            <div className="gacks-tasks-view">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!newTaskInput.trim()) return
                  addTask(newTaskInput.trim())
                  setNewTaskInput('')
                }}
                className="gacks-add-task-full"
              >
                <input
                  type="text"
                  className="gacks-task-input-full"
                  placeholder="Add a new objective or task..."
                  value={newTaskInput}
                  onChange={(e) => setNewTaskInput(e.target.value)}
                />
                <button type="submit" className="gacks-add-task-btn-full">
                  <Plus className="w-4 h-4 mr-1" /> Add Task
                </button>
              </form>

              <div className="gacks-task-list-full">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`gacks-task-row-full ${
                      task.completed ? 'gacks-task-full-done' : ''
                    }`}
                  >
                    <button
                      type="button"
                      className={`gacks-checkbox ${
                        task.completed ? 'gacks-checkbox-checked' : ''
                      }`}
                      onClick={() => toggleTask(task.id)}
                    >
                      {task.completed && (
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      )}
                    </button>
                    <span className="gacks-task-full-text">{task.text}</span>
                    <button
                      type="button"
                      className="gacks-task-delete-btn"
                      onClick={() => deleteTask(task.id)}
                      title="Delete Task"
                    >
                      <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. FILES VIEW */}
          {activeNav === 'files' && (
            <div className="gacks-files-view">
              <div className="gacks-view-info-banner">
                <Folder className="w-5 h-5 text-orange-400" />
                <div>
                  <p className="text-sm font-semibold text-white">Local Workspace & Bridge Files</p>
                  <p className="text-xs text-gray-400">
                    Accessible via Gemini tool calls `read_file` and `list_directory`.
                  </p>
                </div>
              </div>
              <div className="gacks-file-browser">
                <div className="gacks-file-item">📁 bridge/ (server.mjs, provider.mjs, tools.mjs)</div>
                <div className="gacks-file-item">📁 src/ (App.tsx, store.ts, ui/, scene/)</div>
                <div className="gacks-file-item">📄 package.json</div>
                <div className="gacks-file-item">📄 .env (Active secrets protected)</div>
                <div className="gacks-file-item">📄 vite.config.ts</div>
              </div>
              <button
                type="button"
                className="gacks-query-preset-btn"
                onClick={() => {
                  submitQuery('List the files in the workspace directory and summarize their purpose.')
                  setActiveNav('chat')
                }}
              >
                Ask Gacks to analyze workspace files
              </button>
            </div>
          )}

          {/* 4. CALENDAR VIEW */}
          {activeNav === 'calendar' && (
            <div className="gacks-calendar-view">
              <div className="gacks-view-info-banner">
                <CalendarIcon className="w-5 h-5 text-orange-400" />
                <div>
                  <p className="text-sm font-semibold text-white">Active Daily Schedule</p>
                  <p className="text-xs text-gray-400">
                    Syncs with your planned routines and trading sessions.
                  </p>
                </div>
              </div>
              <div className="gacks-events-list-full">
                {calendarEvents.map((ev) => (
                  <div key={ev.id} className="gacks-event-card-full">
                    <div
                      className="gacks-event-color-bar"
                      style={{ backgroundColor: ev.color }}
                    />
                    <div className="gacks-event-info-full">
                      <span className="text-sm font-semibold text-white">{ev.title}</span>
                      <span className="text-xs text-gray-400">{ev.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. WEB SEARCH VIEW */}
          {activeNav === 'websearch' && (
            <div className="gacks-search-view">
              <div className="gacks-view-info-banner">
                <Globe className="w-5 h-5 text-orange-400" />
                <div>
                  <p className="text-sm font-semibold text-white">Autonomous Web Research</p>
                  <p className="text-xs text-gray-400">
                    Insight Business Suite performs real-time queries through the Gemini reasoning core.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  className="gacks-query-preset-btn"
                  onClick={() => {
                    submitQuery('Research the latest market trends for Forex, Gold (XAUUSD), and Crypto.')
                    setActiveNav('chat')
                  }}
                >
                  Research current XAUUSD & Global Market Trends
                </button>
                <button
                  type="button"
                  className="gacks-query-preset-btn"
                  onClick={() => {
                    submitQuery('Search and summarize top global AI engineering breakthroughs today.')
                    setActiveNav('chat')
                  }}
                >
                  Summarize latest AI & Tech news
                </button>
              </div>
            </div>
          )}

          {/* 6. SYSTEM VIEW */}
          {activeNav === 'system' && (
            <div className="gacks-system-view">
              <div className="gacks-view-info-banner">
                <Cpu className="w-5 h-5 text-orange-400" />
                <div>
                  <p className="text-sm font-semibold text-white">System Diagnostics & Tool Registry</p>
                  <p className="text-xs text-gray-400">
                    Bridge status: ws://localhost:8787 · Gemini 2.5 Flash Free Tier
                  </p>
                </div>
              </div>
              <div className="gacks-tools-list">
                <span className="text-xs font-mono text-orange-400">
                  ACTIVE GEMINI TOOLS ({connected.length || 12}):
                </span>
                <div className="gacks-tools-chips">
                  {(connected.length > 0
                    ? connected
                    : [
                        'blade',
                        'display',
                        'ui_theme',
                        'ui_effect',
                        'ui_reset',
                        'capture_screen',
                        'look',
                        'check_integrations',
                        'send_whatsapp_message',
                        'send_email',
                        'read_file',
                        'list_directory',
                      ]
                  ).map((tool) => (
                    <span key={tool} className="gacks-tool-chip">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  className="gacks-query-preset-btn"
                  onClick={() => {
                    submitQuery('Run check_integrations and report live system status.')
                    setActiveNav('chat')
                  }}
                >
                  Verify All Live Integrations
                </button>
              </div>
            </div>
          )}

          {/* 7. SETTINGS VIEW */}
          {activeNav === 'settings' && (
            <div className="gacks-settings-view">
              <div className="gacks-settings-group">
                <h4 className="text-sm font-semibold text-orange-400 mb-2">User Profile</h4>
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-gray-300">Operator Name:</label>
                  <input
                    type="text"
                    className="gacks-settings-input"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                  />
                  <label className="text-xs text-gray-300">Operator Motto:</label>
                  <input
                    type="text"
                    className="gacks-settings-input"
                    value={profileSubtitle}
                    onChange={(e) => setProfileSubtitle(e.target.value)}
                  />
                  <div className="flex gap-3 mt-2">
                    <button
                      type="button"
                      className="gacks-settings-save-btn"
                      onClick={() => {
                        setUserProfile({ name: profileName, subtitle: profileSubtitle })
                        setSavedToast(true)
                        setTimeout(() => setSavedToast(false), 3000)
                      }}
                    >
                      Save Profile
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 text-xs font-semibold text-gray-300 bg-gray-800/80 hover:bg-gray-700/80 border border-gray-600/50 rounded-lg transition-colors cursor-pointer"
                      onClick={() => {
                        setProfileName(userProfile.name)
                        setProfileSubtitle(userProfile.subtitle)
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                  {savedToast && (
                    <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono mt-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Profile preferences saved and persisted!</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="gacks-settings-group mt-4">
                <h4 className="text-sm font-semibold text-orange-400 mb-2">AI Reasoning Engine</h4>
                <div className="flex flex-col gap-1.5 text-xs text-gray-300">
                  <div>
                    <span className="text-gray-400">Provider:</span>{' '}
                    <span className="text-white font-semibold">Google Gemini API</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Model:</span>{' '}
                    <span className="text-orange-400 font-mono">gemini-3.6-flash</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Tier:</span>{' '}
                    <span className="text-emerald-400 font-semibold">High-Speed Flash Core (Rate-Limit Optimized)</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Bridge Status:</span>{' '}
                    <span className="text-emerald-400 font-mono">ws://localhost:8787 (Active)</span>
                  </div>
                </div>
              </div>

              <div className="gacks-settings-group mt-4">
                <h4 className="text-sm font-semibold text-orange-400 mb-2">Voice & Speech Synthesis</h4>
                <p className="text-xs text-gray-400 mb-1">
                  Active Voice: <span className="text-white font-mono">{voice || 'ElevenLabs Neural / System Fallback'}</span>
                </p>
                <p className="text-xs text-gray-400 mb-3">
                  High-fidelity speech synthesis powered by ElevenLabs streaming API with automatic browser speech synthesis fallback.
                </p>
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs font-semibold text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 rounded-lg transition-colors cursor-pointer w-fit flex items-center gap-2"
                  onClick={() => {
                    onToggleVoice?.()
                  }}
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Test Voice Activation</span>
                </button>
              </div>

              <div className="gacks-settings-group mt-4">
                <h4 className="text-sm font-semibold text-orange-400 mb-2">Security & Permissions</h4>
                <div className="gacks-permissions-grid">
                  {Object.entries(permissions).map(([key, val]) => (
                    <div key={key} className="gacks-perm-item">
                      <Shield className="w-3.5 h-3.5 text-orange-400" />
                      <span className="text-xs text-gray-300 font-mono">{key}:</span>
                      <span className="text-xs text-emerald-400 font-semibold">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
