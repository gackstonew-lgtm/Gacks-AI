import React, { useState } from 'react'
import {
  CheckSquare,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Filter,
  Flame,
} from 'lucide-react'
import { useStore, type FocusTask } from '../../store'

export const TasksPage: React.FC = () => {
  const tasks = useStore((s) => s.tasks)
  const toggleTask = useStore((s) => s.toggleTask)
  const addTask = useStore((s) => s.addTask)
  const deleteTask = useStore((s) => s.deleteTask)
  const logActivity = useStore((s) => s.logActivity)

  const [newTaskText, setNewTaskText] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newTaskText.trim()
    if (!trimmed) return
    addTask(trimmed)
    logActivity({
      title: `Created task: ${trimmed}`,
      subtitle: 'Task created',
      type: 'task',
    })
    setNewTaskText('')
  }

  const completedCount = tasks.filter((t) => t.completed).length
  const totalCount = tasks.length
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'active') return !t.completed
    if (filter === 'completed') return t.completed
    return true
  })

  return (
    <div className="gacks-page-container gacks-tasks-page">
      {/* Page Header */}
      <div className="gacks-page-header">
        <div className="gacks-page-title-wrap">
          <div className="gacks-page-icon-badge">
            <CheckSquare className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h1 className="gacks-page-title">FOCUS & TASKS MANAGER</h1>
            <p className="gacks-page-subtitle">
              Prioritized daily execution objectives, trading journal reviews, and habit milestones
            </p>
          </div>
        </div>

        {/* Top Progress Stat */}
        <div className="gacks-tasks-top-stats">
          <div className="gacks-tasks-stat-box">
            <span className="text-xs text-gray-400 font-mono">COMPLETION</span>
            <span className="text-base font-bold text-white font-mono">
              {completedCount}/{totalCount} ({pct}%)
            </span>
          </div>
          <div className="gacks-tasks-progress-mini">
            <div
              className="gacks-tasks-progress-fill"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Task Creation Input Bar */}
      <form onSubmit={handleAdd} className="gacks-tasks-form-bar">
        <input
          type="text"
          className="gacks-tasks-input-hero"
          placeholder="Add a new high-priority objective or task (Press Enter)..."
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
        />
        <button
          type="submit"
          className="gacks-btn-primary"
          disabled={!newTaskText.trim()}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          <span>Add Objective</span>
        </button>
      </form>

      {/* Filter Tabs */}
      <div className="gacks-tasks-controls">
        <div className="gacks-tasks-filter-tabs">
          <button
            type="button"
            className={`gacks-filter-tab ${filter === 'all' ? 'gacks-filter-tab-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            <Filter className="w-3.5 h-3.5 mr-1" />
            <span>All Tasks ({totalCount})</span>
          </button>
          <button
            type="button"
            className={`gacks-filter-tab ${filter === 'active' ? 'gacks-filter-tab-active' : ''}`}
            onClick={() => setFilter('active')}
          >
            <Circle className="w-3.5 h-3.5 mr-1 text-orange-400" />
            <span>Active ({totalCount - completedCount})</span>
          </button>
          <button
            type="button"
            className={`gacks-filter-tab ${filter === 'completed' ? 'gacks-filter-tab-active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
            <span>Completed ({completedCount})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-orange-400">
          <Flame className="w-4 h-4" />
          <span>Stay Consistent</span>
        </div>
      </div>

      {/* Task List Grid */}
      <div className="gacks-tasks-list-viewport">
        {filteredTasks.length === 0 ? (
          <div className="gacks-tasks-empty">
            <CheckCircle2 className="w-10 h-10 text-gray-600 mb-2" />
            <p className="text-gray-300 font-medium">No objectives in this category.</p>
            <p className="text-xs text-gray-500">Add a new item above to stay on track.</p>
          </div>
        ) : (
          <div className="gacks-tasks-card-container">
            {filteredTasks.map((task: FocusTask) => (
              <div
                key={task.id}
                className={`gacks-task-item-card ${
                  task.completed ? 'gacks-task-item-completed' : ''
                }`}
              >
                <button
                  type="button"
                  className={`gacks-task-checkbox ${
                    task.completed ? 'gacks-task-checkbox-checked' : ''
                  }`}
                  onClick={() => toggleTask(task.id)}
                  aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                >
                  {task.completed && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  )}
                </button>

                <div className="gacks-task-details">
                  <span className="gacks-task-title">{task.text}</span>
                  <span className="gacks-task-meta">
                    {task.completed ? 'Status: Completed' : 'Status: Pending Execution'}
                  </span>
                </div>

                <button
                  type="button"
                  className="gacks-task-delete-icon-btn"
                  onClick={() => deleteTask(task.id)}
                  title="Delete objective"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
