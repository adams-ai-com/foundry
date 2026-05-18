import { sql as db, newId } from '../db.js'

export interface Task {
  id: string
  accountId: string
  workspaceId: string | null
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'done' | 'cancelled'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  assignedTo: string | null
  dueAt: Date | null
  sourceThreadId: string | null
  sourceDecisionId: string | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export async function listTasks(
  accountId: string,
  opts: { status?: string; limit?: number; offset?: number } = {},
): Promise<{ tasks: Task[]; total: number }> {
  const { status, limit = 50, offset = 0 } = opts

  const where = status
    ? db`account_id = ${accountId} AND status = ${status}`
    : db`account_id = ${accountId}`

  const [{ count }] = await db<{ count: string }[]>`
    SELECT COUNT(*) FROM tasks WHERE ${where}`

  const rows = await db<Task[]>`
    SELECT id, account_id, workspace_id, title, description, status, priority,
           assigned_to, due_at, source_thread_id, source_decision_id,
           completed_at, created_at, updated_at
    FROM tasks WHERE ${where}
    ORDER BY
      CASE status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
      due_at ASC NULLS LAST,
      created_at DESC
    LIMIT ${limit} OFFSET ${offset}`

  return { tasks: rows, total: Number(count) }
}

export async function getTask(accountId: string, id: string): Promise<Task | null> {
  const [row] = await db<Task[]>`
    SELECT * FROM tasks WHERE id = ${id} AND account_id = ${accountId}`
  return row ?? null
}

export async function createTask(
  accountId: string,
  input: {
    title: string
    description?: string
    status?: Task['status']
    priority?: Task['priority']
    assignedTo?: string
    dueAt?: string
    sourceThreadId?: string
    sourceDecisionId?: string
    workspaceId?: string
  },
): Promise<Task> {
  const id = newId()
  const [row] = await db<Task[]>`
    INSERT INTO tasks (id, account_id, workspace_id, title, description, status, priority,
                       assigned_to, due_at, source_thread_id, source_decision_id)
    VALUES (
      ${id}, ${accountId}, ${input.workspaceId ?? null}, ${input.title},
      ${input.description ?? null}, ${input.status ?? 'todo'}, ${input.priority ?? 'normal'},
      ${input.assignedTo ?? null}, ${input.dueAt ?? null},
      ${input.sourceThreadId ?? null}, ${input.sourceDecisionId ?? null}
    )
    RETURNING *`
  return row
}

export async function updateTask(
  accountId: string,
  id: string,
  patch: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'assignedTo' | 'dueAt'>>,
): Promise<Task | null> {
  const completedAt =
    patch.status === 'done' ? db`NOW()` : patch.status ? db`NULL` : db`completed_at`

  const [row] = await db<Task[]>`
    UPDATE tasks SET
      title        = COALESCE(${patch.title ?? null}, title),
      description  = COALESCE(${patch.description ?? null}, description),
      status       = COALESCE(${patch.status ?? null}, status),
      priority     = COALESCE(${patch.priority ?? null}, priority),
      assigned_to  = COALESCE(${patch.assignedTo ?? null}, assigned_to),
      due_at       = COALESCE(${patch.dueAt ?? null}, due_at),
      completed_at = ${completedAt},
      updated_at   = NOW()
    WHERE id = ${id} AND account_id = ${accountId}
    RETURNING *`
  return row ?? null
}

export async function deleteTask(accountId: string, id: string): Promise<boolean> {
  const result = await db`DELETE FROM tasks WHERE id = ${id} AND account_id = ${accountId}`
  return result.count > 0
}
