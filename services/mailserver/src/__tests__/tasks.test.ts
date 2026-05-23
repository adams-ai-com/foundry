import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { makeApp, createTestAccount, deleteTestAccount, inject } from './helpers.js'
import { sql } from '../db.js'

let app: FastifyInstance
let accountId: string

beforeAll(async () => {
  app = await makeApp()
  const acct = await createTestAccount('tasks')
  accountId = acct.id
})

afterAll(async () => {
  await deleteTestAccount(accountId)
  await app.close()
  await sql.end()
})

describe('GET /api/v1/tasks', () => {
  it('returns empty list for new account', async () => {
    const res = await inject(app, 'GET', '/api/v1/tasks', { accountId })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.tasks).toEqual([])
    expect(body.total).toBe(0)
  })

  it('filters by status', async () => {
    // Create tasks with different statuses
    await inject(app, 'POST', '/api/v1/tasks', { accountId, body: { title: 'todo task' } })
    const doneRes = await inject(app, 'POST', '/api/v1/tasks', { accountId, body: { title: 'done task' } })
    const doneTask = doneRes.json()
    await inject(app, 'PATCH', `/api/v1/tasks/${doneTask.id}`, { accountId, body: { status: 'done' } })

    const todoRes = await inject(app, 'GET', '/api/v1/tasks?status=todo', { accountId })
    const todos = todoRes.json()
    expect(todos.tasks.every((t: any) => t.status === 'todo')).toBe(true)

    const doneListRes = await inject(app, 'GET', '/api/v1/tasks?status=done', { accountId })
    const dones = doneListRes.json()
    expect(dones.tasks.every((t: any) => t.status === 'done')).toBe(true)
  })
})

describe('POST /api/v1/tasks', () => {
  it('creates a task with minimal fields', async () => {
    const res = await inject(app, 'POST', '/api/v1/tasks', {
      accountId,
      body: { title: 'My test task' },
    })
    expect(res.statusCode).toBe(201)
    const task = res.json()
    expect(task.id).toBeTruthy()
    expect(task.title).toBe('My test task')
    expect(task.status).toBe('todo')
    expect(task.priority).toBe('normal')
  })

  it('creates a task with all optional fields', async () => {
    const dueAt = '2030-12-31T23:59:59.000Z'
    const res = await inject(app, 'POST', '/api/v1/tasks', {
      accountId,
      body: {
        title: 'Full task',
        description: 'Detailed description',
        priority: 'high',
        assignedTo: 'user@example.com',
        dueAt,
      },
    })
    expect(res.statusCode).toBe(201)
    const task = res.json()
    expect(task.title).toBe('Full task')
    expect(task.description).toBe('Detailed description')
    expect(task.priority).toBe('high')
    expect(task.assigned_to ?? task.assignedTo).toBe('user@example.com')
  })

  it('rejects missing title', async () => {
    const res = await inject(app, 'POST', '/api/v1/tasks', {
      accountId,
      body: { description: 'no title' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects blank title', async () => {
    const res = await inject(app, 'POST', '/api/v1/tasks', {
      accountId,
      body: { title: '   ' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /api/v1/tasks/:id', () => {
  it('returns a single task by id', async () => {
    const created = await inject(app, 'POST', '/api/v1/tasks', {
      accountId,
      body: { title: 'Fetch me' },
    })
    const id = created.json().id

    const res = await inject(app, 'GET', `/api/v1/tasks/${id}`, { accountId })
    expect(res.statusCode).toBe(200)
    expect(res.json().id).toBe(id)
    expect(res.json().title).toBe('Fetch me')
  })

  it('returns 404 for nonexistent task', async () => {
    const res = await inject(app, 'GET', '/api/v1/tasks/nonexistent', { accountId })
    expect(res.statusCode).toBe(404)
  })

  it('cannot fetch another account task', async () => {
    const other = await createTestAccount('tasks-isolation')
    try {
      const created = await inject(app, 'POST', '/api/v1/tasks', {
        accountId: other.id,
        body: { title: 'Other account task' },
      })
      const id = created.json().id

      const res = await inject(app, 'GET', `/api/v1/tasks/${id}`, { accountId })
      expect(res.statusCode).toBe(404)
    } finally {
      await deleteTestAccount(other.id)
    }
  })
})

describe('PATCH /api/v1/tasks/:id', () => {
  it('updates task title', async () => {
    const created = await inject(app, 'POST', '/api/v1/tasks', {
      accountId,
      body: { title: 'Original title' },
    })
    const id = created.json().id

    const res = await inject(app, 'PATCH', `/api/v1/tasks/${id}`, {
      accountId,
      body: { title: 'Updated title' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().title).toBe('Updated title')
  })

  it('advances status through cycle', async () => {
    const created = await inject(app, 'POST', '/api/v1/tasks', {
      accountId,
      body: { title: 'Status cycle task' },
    })
    const id = created.json().id

    for (const [from, to] of [['todo', 'in_progress'], ['in_progress', 'done']] as const) {
      const res = await inject(app, 'PATCH', `/api/v1/tasks/${id}`, {
        accountId,
        body: { status: to },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().status).toBe(to)
    }
  })

  it('sets completedAt when status becomes done', async () => {
    const created = await inject(app, 'POST', '/api/v1/tasks', {
      accountId,
      body: { title: 'Complete me' },
    })
    const id = created.json().id

    const res = await inject(app, 'PATCH', `/api/v1/tasks/${id}`, {
      accountId,
      body: { status: 'done' },
    })
    expect(res.json().completedAt ?? res.json().completed_at).toBeTruthy()
  })

  it('returns 404 for nonexistent task', async () => {
    const res = await inject(app, 'PATCH', '/api/v1/tasks/nonexistent', {
      accountId,
      body: { title: 'x' },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('DELETE /api/v1/tasks/:id', () => {
  it('deletes a task', async () => {
    const created = await inject(app, 'POST', '/api/v1/tasks', {
      accountId,
      body: { title: 'Delete me' },
    })
    const id = created.json().id

    const del = await inject(app, 'DELETE', `/api/v1/tasks/${id}`, { accountId })
    expect(del.statusCode).toBe(204)

    const fetch = await inject(app, 'GET', `/api/v1/tasks/${id}`, { accountId })
    expect(fetch.statusCode).toBe(404)
  })

  it('returns 404 for nonexistent task', async () => {
    const res = await inject(app, 'DELETE', '/api/v1/tasks/nonexistent', { accountId })
    expect(res.statusCode).toBe(404)
  })
})
