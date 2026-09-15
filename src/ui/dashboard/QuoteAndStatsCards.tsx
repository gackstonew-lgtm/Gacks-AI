import React, { useState } from 'react'
import { Quote as QuoteIcon, Target, Clock, Zap, ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '../../store'

const QUOTES = [
  {
    text: 'Discipline turns plans into results.',
    author: 'Gacks',
  },
  {
    text: 'Execution is the only currency that matters in the arena.',
    author: 'Gacks P.A',
  },
  {
    text: 'Speed without accuracy is reckless; speed with precision is mastery.',
    author: 'Gacks Core',
  },
  {
    text: 'Quiet competence speaks louder than loud ambition.',
    author: 'Gacks Philosophy',
  },
  {
    text: 'Every obstacle is merely an unoptimized parameter.',
    author: 'Gacks Systems',
  },
]

export const QuoteAndStatsCards: React.FC = () => {
  const [quoteIdx, setQuoteIdx] = useState(0)
  const tasks = useStore((s) => s.tasks)

  const completedCount = tasks.filter((t) => t.completed).length
  const totalTasks = tasks.length || 5
  const goalsRatio = `${completedCount}/${totalTasks}`
  const goalsPct = Math.round((completedCount / totalTasks) * 100)

  const prevQuote = () => {
    setQuoteIdx((prev) => (prev > 0 ? prev - 1 : QUOTES.length - 1))
  }

  const nextQuote = () => {
    setQuoteIdx((prev) => (prev < QUOTES.length - 1 ? prev + 1 : 0))
  }

  const currentQuote = QUOTES[quoteIdx]

  return (
    <div className="gacks-bottom-cluster">
      {/* 1. Quote Card */}
      <div className="gacks-card gacks-quote-card">
        <div className="gacks-card-header">
          <div className="gacks-card-title-wrap">
            <QuoteIcon className="w-4 h-4 text-orange-500" />
            <h3 className="gacks-card-title">QUOTE</h3>
          </div>
        </div>

        <div className="gacks-quote-body">
          <p className="gacks-quote-text">“{currentQuote.text}”</p>
          <span className="gacks-quote-author">— {currentQuote.author}</span>
        </div>

        <div className="gacks-quote-footer">
          <div className="gacks-carousel-dots">
            {QUOTES.map((_, i) => (
              <span
                key={i}
                className={`gacks-carousel-dot ${i === quoteIdx ? 'gacks-dot-active' : ''}`}
                onClick={() => setQuoteIdx(i)}
              />
            ))}
          </div>
          <div className="gacks-carousel-nav">
            <button
              type="button"
              className="gacks-carousel-btn"
              onClick={prevQuote}
              aria-label="Previous quote"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              className="gacks-carousel-btn"
              onClick={nextQuote}
              aria-label="Next quote"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Quick Stats Card */}
      <div className="gacks-card gacks-stats-card">
        <div className="gacks-card-header">
          <div className="gacks-card-title-wrap">
            <Target className="w-4 h-4 text-orange-500" />
            <h3 className="gacks-card-title">QUICK STATS</h3>
          </div>
        </div>

        <div className="gacks-stats-list">
          {/* Day Goals */}
          <div className="gacks-stat-row">
            <div className="gacks-stat-meta">
              <div className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-orange-400" />
                <span className="gacks-stat-label">Day Goals</span>
              </div>
              <span className="gacks-stat-val">{goalsRatio}</span>
            </div>
            <div className="gacks-progress-track">
              <div
                className="gacks-progress-fill"
                style={{ width: `${Math.min(100, Math.max(5, goalsPct))}%` }}
              />
            </div>
          </div>

          {/* Focus Time */}
          <div className="gacks-stat-row">
            <div className="gacks-stat-meta">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-orange-400" />
                <span className="gacks-stat-label">Focus Time</span>
              </div>
              <span className="gacks-stat-val">2h 14m</span>
            </div>
            <div className="gacks-progress-track">
              <div className="gacks-progress-fill" style={{ width: '65%' }} />
            </div>
          </div>

          {/* Energy */}
          <div className="gacks-stat-row">
            <div className="gacks-stat-meta">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-orange-400" />
                <span className="gacks-stat-label">Energy</span>
              </div>
              <span className="gacks-stat-val">78%</span>
            </div>
            <div className="gacks-progress-track">
              <div className="gacks-progress-fill" style={{ width: '78%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Decorative Cyber Badge */}
      <div className="gacks-card gacks-badge-card">
        <div className="gacks-badge-stripes">
          <div className="gacks-badge-stripe gacks-badge-stripe-1" />
          <div className="gacks-badge-stripe gacks-badge-stripe-2" />
        </div>
        <div className="gacks-badge-content">
          <h4 className="gacks-badge-title">GACKS</h4>
          <span className="gacks-badge-motto">BUILT FOR A SMARTER TOMORROW</span>
        </div>
      </div>
    </div>
  )
}
