'use client'

import { useState, useEffect, useCallback } from 'react'
import { listTasks, createTask, updateTask, deleteTask, type Task } from '../lib/api'

const STATUS_LABELS: Record<Task['status'], string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
  cancelled: 'Cancelled',
}

const PRIORITY_COLORS: Record<Task['priority'], string> = {
  low: 'text-fg-tertiary',
  normal: 'text-accent',
  high: 'text-orange-400',
  urgent: 'text-danger',
}

const STATUS_ORDER: Task['status'][] = ['todo', 'in_progress', 'done', 'cancelled']

export function TasksView() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [filter, setFilter] = useState<string>('active')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { tasks: rows } = await listTasks(filter === 'all' ? undefined : filter)
      setTasks(rows)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  async function cycleStatus(task: Task) {
    const next: Record<Task['status'], Task['status']> = {
      todo: 'in_progress',
      in_progress: 'done',
      done: 'todo',
      cancelled: 'todo',
    }
    await updateTask(task.id, { status: next[task.status] })
    load()
  }

  async function handleDelete(id: string) {
    await deleteTask(id)
    load()
  }

  return (
    <div className="flex flex-col h-full bg-bg-surface text-fg-primary">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-fg-primary">Tasks</h2>
        <button
          data-testid="new-task-button"
          onClick={() => { setEditingTask(null); setShowForm(true) }}
          className="text-xs bg-accent hover:bg-accent-hover text-accent-fg px-3 py-1 rounded"
        >
          + New Task
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-border">
        {['active', 'all', 'done'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1 rounded capitalize transition-colors ${
              filter === f
                ? 'bg-bg-hover text-fg-primary font-medium'
                : 'text-fg-secondary hover:text-fg-primary'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center text-fg-tertiary text-sm">Loading…</div>
        ) : tasks.length === 0 ? (
          <div className="p-6 text-center text-fg-tertiary text-sm">No tasks</div>
        ) : (
          <ul className="divide-y divide-border">
            {tasks.map((task) => (
              <li key={task.id} data-testid="task-item" className="flex items-start gap-3 px-4 py-3 hover:bg-bg-hover/40 group transition-colors">
                {/* Status toggle */}
                <button
                  onClick={() => cycleStatus(task)}
                  title={`Status: ${STATUS_LABELS[task.status]}`}
                  className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                    task.status === 'done'
                      ? 'bg-green-600 border-green-600'
                      : task.status === 'in_progress'
                      ? 'border-accent'
                      : 'border-border'
                  }`}
                >
                  {task.status === 'done' && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  {task.status === 'in_progress' && (
                    <div className="w-2 h-2 rounded-sm bg-accent" />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-sm ${task.status === 'done' ? 'line-through text-fg-tertiary' : 'text-fg-primary'}`}>
                      {task.title}
                    </span>
                    {task.priority !== 'normal' && (
                      <span className={`text-xs ${PRIORITY_COLORS[task.priority]}`}>
                        {task.priority}
                      </span>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-xs text-fg-tertiary mt-0.5 truncate">{task.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    {task.dueAt && (
                      <span className={`text-xs ${new Date(task.dueAt) < new Date() && task.status !== 'done' ? 'text-danger' : 'text-fg-tertiary'}`}>
                        Due {new Date(task.dueAt).toLocaleDateString()}
                      </span>
                    )}
                    {task.assignedTo && (
                      <span className="text-xs text-fg-tertiary">{task.assignedTo}</span>
                    )}
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      task.status === 'todo' ? 'bg-bg-hover text-fg-secondary'
                      : task.status === 'in_progress' ? 'bg-accent/10 text-accent'
                      : task.status === 'done' ? 'bg-green-500/10 text-green-500'
                      : 'bg-bg-hover text-fg-tertiary'
                    }`}>
                      {STATUS_LABELS[task.status]}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditingTask(task); setShowForm(true) }}
                    className="text-xs text-fg-tertiary hover:text-fg-primary px-1 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="text-xs text-fg-tertiary hover:text-danger px-1 transition-colors"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Create / Edit modal */}
      {showForm && (
        <TaskForm
          task={editingTask}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}
    </div>
  )
}

function TaskForm({
  task,
  onClose,
  onSaved,
}: {
  task: Task | null
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [priority, setPriority] = useState<Task['priority']>(task?.priority ?? 'normal')
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo ?? '')
  const [dueAt, setDueAt] = useState(task?.dueAt ? task.dueAt.slice(0, 10) : '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      if (task) {
        await updateTask(task.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          assignedTo: assignedTo.trim() || undefined,
          dueAt: dueAt || undefined,
        })
      } else {
        await createTask({
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          assignedTo: assignedTo.trim() || undefined,
          dueAt: dueAt || undefined,
        })
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-bg-raised border border-border rounded-lg w-full max-w-md mx-4 p-5">
        <h3 className="text-sm font-semibold text-fg-primary mb-4">
          {task ? 'Edit Task' : 'New Task'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            data-testid="task-title-input"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            className="w-full bg-bg-surface border border-border rounded px-3 py-2 text-sm text-fg-primary placeholder-fg-tertiary focus:outline-none focus:border-accent"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full bg-bg-surface border border-border rounded px-3 py-2 text-sm text-fg-primary placeholder-fg-tertiary focus:outline-none focus:border-accent resize-none"
          />
          <div className="flex gap-2">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Task['priority'])}
              className="flex-1 bg-bg-surface border border-border rounded px-3 py-2 text-sm text-fg-primary focus:outline-none focus:border-accent"
            >
              <option value="low">Low priority</option>
              <option value="normal">Normal priority</option>
              <option value="high">High priority</option>
              <option value="urgent">Urgent</option>
            </select>
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="flex-1 bg-bg-surface border border-border rounded px-3 py-2 text-sm text-fg-primary focus:outline-none focus:border-accent"
            />
          </div>
          <input
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            placeholder="Assign to (email, optional)"
            className="w-full bg-bg-surface border border-border rounded px-3 py-2 text-sm text-fg-primary placeholder-fg-tertiary focus:outline-none focus:border-accent"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="text-sm text-fg-secondary hover:text-fg-primary px-3 py-1.5 transition-colors">
              Cancel
            </button>
            <button
              data-testid="task-save-button"
              type="submit"
              disabled={saving || !title.trim()}
              className="text-sm bg-accent hover:bg-accent-hover disabled:opacity-50 text-accent-fg px-4 py-1.5 rounded transition-colors"
            >
              {saving ? 'Saving…' : task ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
