'use client'

import { useState, useTransition } from 'react'
import { renameFolder } from '@/lib/actions'

export function FolderRenameForm({
  folderId,
  currentName,
  siteSlug,
}: {
  folderId: string
  currentName: string
  siteSlug: string
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName]       = useState(currentName)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === currentName) {
      setName(currentName)
      setEditing(false)
      return
    }
    startTransition(async () => {
      await renameFolder(folderId, trimmed, siteSlug)
      setEditing(false)
    })
  }

  if (!editing) {
    return (
      <h1
        className="text-2xl font-bold tracking-tight text-fg-primary cursor-pointer hover:text-accent transition-colors"
        onClick={() => setEditing(true)}
        title="Click to rename"
      >
        {name}
      </h1>
    )
  }

  return (
    <input
      type="text"
      value={name}
      autoFocus
      onChange={e => setName(e.target.value)}
      onBlur={handleSave}
      onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setName(currentName); setEditing(false) } }}
      disabled={isPending}
      className="text-2xl font-bold tracking-tight text-fg-primary bg-transparent border-b-2 border-accent
                 outline-none px-0 min-w-0 w-auto disabled:opacity-60"
      style={{ width: `${Math.max(name.length, 8)}ch` }}
    />
  )
}
