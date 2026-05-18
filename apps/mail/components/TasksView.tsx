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
  low: 'text-gray-400',
  normal: 'text-blue-400',
  high: 'text-orange-400',
  urgent: 'text-red-400',
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
      const status = filter === 'active' ? undefined : filter === 'done' ? 'done' : undefined
      const { tasks: rows } = await listTasks(status)
      const filtered = filter === 'active'
        ? rows.filter((t) => t.status === 'todo' || t.status === 'in_progress')
        : rows
      setTasks(filtered)
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-200">Tasks</h2>
        <button
          onClick={() => { setEditingTask(null); setShowForm(true) }}
          className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded"
        >
          + New Task
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-gray-800">
        {['active', 'all', 'done'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1 rounded capitalize ${
              filter === f
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center text-gray-500 text-sm">Loading…</div>
        ) : tasks.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">No tasks</div>
        ) : (
          <ul className="divide-y divide-gray-800">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-800/40 group">
                {/* Status toggle */}
                <button
                  onClick={() => cycleStatus(task)}
                  title={`Status: ${STATUS_LABELS[task.status]}`}
                  className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                    task.status === 'done'
                      ? 'bg-green-600 border-green-600'
                      : task.status === 'in_progress'
                      ? 'border-blue-400'
                      : 'border-gray-600'
                  }`}
                >
                  {task.status === 'done' && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  {task.status === 'in_progress' && (
                    <div className="w-2 h-2 rounded-sm bg-blue-400" />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-sm ${task.status === 'done' ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                      {task.title}
                    </span>
                    {task.priority !== 'normal' && (
                      <span className={`text-xs ${PRIORITY_COLORS[task.priority]}`}>
                        {task.priority}
                      </span>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{task.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    {task.dueAt && (
                      <span className={`text-xs ${new Date(task.dueAt) < new Date() && task.status !== 'done' ? 'text-red-400' : 'text-gray-500'}`}>
                        Due {new Date(task.dueAt).toLocaleDateString()}
                      </span>
                    )}
                    {task.assignedTo && (
                      <span className="text-xs text-gray-500">{task.assignedTo}</span>
                    )}
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      task.status === 'todo' ? 'bg-gray-700 text-gray-400'
                      : task.status === 'in_progress' ? 'bg-blue-900/50 text-blue-300'
                      : task.status === 'done' ? 'bg-green-900/50 text-green-400'
                      : 'bg-gray-700 text-gray-500'
                    }`}>
                      {STATUS_LABELS[task.status]}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => { setEditingTask(task); setShowForm(true) }}
                    className="text-xs text-gray-400 hover:text-gray-200 px-1"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="text-xs text-gray-400 hover:text-red-400 px-1"
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
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-md mx-4 p-5">
        <h3 className="text-sm font-semibold text-gray-200 mb-4">
          {task ? 'Edit Task' : 'New Task'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
          />
          <div className="flex gap-2">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Task['priority'])}
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
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
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>
          <input
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            placeholder="Assign to (email, optional)"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="text-sm text-gray-400 hover:text-gray-200 px-3 py-1.5">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-1.5 rounded"
            >
              {saving ? 'Saving…' : task ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
