import React, { useState } from 'react'
import { Target, Check, Plus } from 'lucide-react'
import { useStore } from '../../store'

interface TodaysFocusCardProps {
  onViewAll?: () => void
}

export const TodaysFocusCard: React.FC<TodaysFocusCardProps> = ({
  onViewAll,
}) => {
  const tasks = useStore((s) => s.tasks)
  const toggleTask = useStore((s) => s.toggleTask)
  const addTask = useStore((s) => s.addTask)
  const logActivity = useStore((s) => s.logActivity)

  const [newTaskText, setNewTaskText] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const handleToggle = (id: string, text: string, currentStatus: boolean) => {
    toggleTask(id)
    logActivity({
      title: `${!currentStatus ? 'Completed' : 'Reopened'}: ${text}`,
      subtitle: 'Task updated',
      type: 'task',
    })
  }

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskText.trim()) return
    addTask(newTaskText.trim())
    logActivity({
      title: `Created task: ${newTaskText.trim()}`,
      subtitle: 'Task added',
      type: 'task',
    })
    setNewTaskText('')
    setIsAdding(false)
  }

  return (
    <div className="gacks-card gacks-focus-card">
      <div className="gacks-card-header">
        <div className="gacks-card-title-wrap">
          <Target className="w-4 h-4 text-orange-500" />
          <h3 className="gacks-card-title">TODAY'S FOCUS</h3>
        </div>
        <button
          type="button"
          className="gacks-card-header-link"
          onClick={onViewAll}
        >
          View all
        </button>
      </div>

      <div className="gacks-focus-list">
        {tasks.slice(0, 5).map((task) => (
          <label
            key={task.id}
            className={`gacks-focus-item ${task.completed ? 'gacks-focus-item-completed' : ''}`}
          >
            <button
              type="button"
              className={`gacks-checkbox ${task.completed ? 'gacks-checkbox-checked' : ''}`}
              onClick={() => handleToggle(task.id, task.text, task.completed)}
              aria-checked={task.completed}
              role="checkbox"
            >
              {task.completed && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
            </button>
            <span className="gacks-focus-text">{task.text}</span>
          </label>
        ))}

        {isAdding ? (
          <form onSubmit={handleAddSubmit} className="gacks-add-task-form">
            <input
              type="text"
              autoFocus
              className="gacks-add-task-input"
              placeholder="Add new task..."
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
            />
            <button type="submit" className="gacks-add-task-btn">
              Add
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="gacks-focus-add-trigger"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="w-3.5 h-3.5 text-orange-400" />
            <span>Add Focus Item</span>
          </button>
        )}
      </div>
    </div>
  )
}
