export type CRStatus = 'backlog' | 'up_next' | 'in_progress' | 'in_review' | 'blocked' | 'done'
export type CRPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface CR {
  id: string
  title: string
  description: string | null
  status: CRStatus
  priority: CRPriority
  assigned_to: string | null
  submitted_by: string | null
  labels: string[]
  created_at: string
  updated_at: string
}

export interface CRNote {
  id: string
  cr_id: string
  author: string | null
  body: string
  created_at: string
}

export interface CRAttachmentMeta {
  id: string
  cr_id: string
  filename: string
  mime_type: string
  byte_size: number
  submitted_by: string | null
  created_at: string
}

export const CR_STATUSES: CRStatus[] = ['backlog', 'up_next', 'in_progress', 'in_review', 'blocked', 'done']

export const STATUS_LABELS: Record<CRStatus, string> = {
  backlog:     'Backlog',
  up_next:     'Up Next',
  in_progress: 'In Progress',
  in_review:   'In Review',
  blocked:     'Blocked',
  done:        'Done',
}

export const PRIORITY_LABELS: Record<CRPriority, string> = {
  low:    'Low',
  medium: 'Medium',
  high:   'High',
  urgent: 'Urgent',
}
