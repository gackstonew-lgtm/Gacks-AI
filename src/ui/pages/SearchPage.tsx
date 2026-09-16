import React, { useState } from 'react'
import {
  Globe,
  Search,
  ArrowRight,
  TrendingUp,
  Cpu,
  Coins,
  ShieldCheck,
  Compass,
} from 'lucide-react'
import { useStore } from '../../store'
import { navigate } from '../../lib/router'

export const SearchPage: React.FC = () => {
  const submitQuery = useStore((s) => s.submitQuery)
  const [query, setQuery] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    submitQuery(`Autonomous Web Research: ${trimmed}`)
    navigate('chat')
  }

  const handlePreset = (_topic: string, prompt: string) => {
    submitQuery(prompt)
    navigate('chat')
  }

  const researchTopics = [
    {
      id: 'gold-forex',
      title: 'XAUUSD & Forex Analysis',
      desc: 'Real-time technical price action, liquidity pools, and US Dollar index (DXY) momentum.',
      icon: TrendingUp,
      color: '#00A3FF',
      prompt: 'Execute deep research on current XAUUSD (Gold) price action, key resistance/support levels, and DXY macro trends.',
    },
    {
      id: 'ai-agents',
      title: 'Agentic AI Systems & Architecture',
      desc: 'Survey recent breakthroughs in LLM multi-step planning, bounded execution, and tool use.',
      icon: Cpu,
      color: '#FF5A36',
      prompt: 'Summarize the most significant breakthroughs in autonomous agent architectures and production-grade LLM tooling.',
    },
    {
      id: 'crypto-macro',
      title: 'Crypto & Bitcoin Macroeconomics',
      desc: 'On-chain dynamics, institutional inflows, and global liquidity indicators for BTC and ETH.',
      icon: Coins,
      color: '#10B981',
      prompt: 'Analyze current Bitcoin (BTC) macro market trends, institutional ETF flow metrics, and regulatory landscape.',
    },
    {
      id: 'geopolitics',
      title: 'Global Geopolitical & Energy Briefing',
      desc: 'Crude oil, commodity supply chains, and global economic calendar events impacting markets.',
      icon: Compass,
      color: '#8B5CF6',
      prompt: 'Compile a concise executive briefing on global energy markets, crude oil trends, and upcoming high-impact economic releases.',
    },
  ]

  return (
    <div className="gacks-page-container gacks-search-page">
      {/* Page Header */}
      <div className="gacks-page-header">
        <div className="gacks-page-title-wrap">
          <div className="gacks-page-icon-badge">
            <Globe className="w-4 h-4 text-[#00A3FF]" />
          </div>
          <div>
            <h1 className="gacks-page-title">AUTONOMOUS WEB RESEARCH</h1>
            <p className="gacks-page-subtitle">
              Ground-truth search and document synthesis with SSRF security boundaries and factual citations
            </p>
          </div>
        </div>

        <div className="gacks-security-badge-safe">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>SSRF Gate Active</span>
        </div>
      </div>

      {/* Main Search Hero Bar */}
      <form onSubmit={handleSearch} className="gacks-search-hero-form">
        <div className="gacks-search-hero-input-wrap">
          <Search className="w-5 h-5 text-gray-400 ml-3" />
          <input
            type="text"
            className="gacks-search-hero-input"
            placeholder="Enter research topic, market symbol, or question to investigate across the web..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button
            type="submit"
            className="gacks-search-hero-btn"
            disabled={!query.trim()}
          >
            <span>Investigate</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </button>
        </div>
      </form>

      {/* Topics Grid */}
      <div className="gacks-search-topics-section">
        <div className="flex items-center gap-2 mb-3">
          <span className="gacks-orange-bullet" />
          <h3 className="text-xs font-mono text-gray-300 uppercase tracking-wider font-semibold">
            Curated Intelligence Modules
          </h3>
        </div>

        <div className="gacks-search-topics-grid">
          {researchTopics.map((topic) => {
            const Icon = topic.icon
            return (
              <div
                key={topic.id}
                className="gacks-card gacks-search-topic-card"
                onClick={() => handlePreset(topic.title, topic.prompt)}
              >
                <div className="gacks-search-topic-header">
                  <div
                    className="gacks-topic-icon-wrap"
                    style={{ backgroundColor: `${topic.color}15`, color: topic.color }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-mono text-[#00A3FF] flex items-center gap-1">
                    Execute <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
                <h4 className="gacks-topic-title">{topic.title}</h4>
                <p className="gacks-topic-desc">{topic.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
