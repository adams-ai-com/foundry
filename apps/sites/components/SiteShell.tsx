'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createFolder, createPage } from '@/lib/actions'
import type { Site, FolderNode } from '@/lib/actions'

// ── Icons ──────────────────────────────────────────────────────────────────────

function FolderIcon({ className = '', locked = false }: { className?: string; locked?: boolean }) {
  return (
    <span className={`relative inline-flex ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
           strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
        <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
      </svg>
      {locked && (
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-bg-base rounded-full flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
               className="w-1.5 h-1.5 text-fg-tertiary">
            <rect x="5" y="11" width="14" height="10" rx="2" ry="2"/>
            <path d="M8 11V7a4 4 0 018 0v4"/>
          </svg>
        </span>
      )}
    </span>
  )
}
function PageIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
    </svg>
  )
}
function PlusIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 5v14M5 12h14"/>
    </svg>
  )
}
function ChevronDownIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 9l-7 7-7-7"/>
    </svg>
  )
}
function ChevronRightIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 18l6-6-6-6"/>
    </svg>
  )
}
function ChevronLeftIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 19l-7-7 7-7"/>
    </svg>
  )
}
function SettingsIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  )
}

// ── Shell ──────────────────────────────────────────────────────────────────────

export function SiteShell({
  site,
  tree,
  children,
}: {
  site: Site
  tree: FolderNode[]
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isPending, startTransition] = useTransition()

  function handleNewFolder(parentId?: string) {
    startTransition(async () => { await createFolder(site.id, parentId ?? null, site.slug) })
  }

  function handleNewPage(folderId?: string) {
    startTransition(async () => { await createPage(site.id, folderId ?? null, site.slug) })
  }

  return (
    <div className="h-[calc(100vh-3rem)] flex overflow-hidden">

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <aside className={`w-64 border-r border-border flex flex-col flex-shrink-0 bg-bg-surface transition-opacity ${isPending ? 'opacity-70 pointer-events-none' : ''}`}>
          {/* Site header */}
          <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
            <Link
              href={`/${site.slug}`}
              className="flex-1 font-semibold text-sm text-fg-primary hover:text-accent transition-colors overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
            >
              {site.name}
            </Link>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={() => handleNewFolder()}
                title="New folder"
                className="w-6 h-6 flex items-center justify-center rounded text-fg-tertiary
                           hover:text-fg-primary hover:bg-bg-hover transition-colors"
              >
                <PlusIcon className="w-3.5 h-3.5" />
              </button>
              <Link
                href={`/${site.slug}/settings`}
                title="Site settings"
                className="w-6 h-6 flex items-center justify-center rounded text-fg-tertiary
                           hover:text-fg-primary hover:bg-bg-hover transition-colors"
              >
                <SettingsIcon className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                title="Collapse sidebar"
                className="w-6 h-6 flex items-center justify-center rounded text-fg-tertiary
                           hover:text-fg-primary hover:bg-bg-hover transition-colors"
              >
                <ChevronLeftIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Folder tree */}
          <nav className="flex-1 overflow-y-auto py-2 px-2">
            {tree.length === 0 ? (
              <p className="text-xs text-fg-tertiary px-2 py-2">No folders yet</p>
            ) : (
              <FolderTree nodes={tree} siteSlug={site.slug} onNewChild={handleNewFolder} onNewPage={handleNewPage} />
            )}
          </nav>

          {/* New page at root */}
          <div className="px-3 py-2.5 border-t border-border">
            <button
              onClick={() => handleNewPage()}
              className="flex items-center gap-1.5 text-xs text-fg-tertiary hover:text-fg-primary
                         w-full text-left hover:bg-bg-hover rounded px-1.5 py-1 transition-colors"
            >
              <PlusIcon className="w-3 h-3 flex-shrink-0" />
              New page
            </button>
          </div>
        </aside>
      )}

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!sidebarOpen && (
          <div className="px-3 py-2.5 border-b border-border flex items-center gap-2 bg-bg-raised flex-shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              title="Expand sidebar"
              className="w-6 h-6 flex items-center justify-center rounded text-fg-tertiary
                         hover:text-fg-primary hover:bg-bg-hover transition-colors"
            >
              <ChevronRightIcon className="w-3.5 h-3.5" />
            </button>
            <span className="text-sm font-semibold text-fg-primary">{site.name}</span>
          </div>
        )}
        <div className="flex-1 overflow-hidden flex flex-col">
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Folder tree ────────────────────────────────────────────────────────────────

function FolderTree({
  nodes,
  siteSlug,
  onNewChild,
  onNewPage,
  depth = 0,
}: {
  nodes: FolderNode[]
  siteSlug: string
  onNewChild: (parentId: string) => void
  onNewPage: (folderId: string) => void
  depth?: number
}) {
  return (
    <ul className="space-y-px">
      {nodes.map(node => (
        <FolderItem key={node.id} node={node} siteSlug={siteSlug}
                    onNewChild={onNewChild} onNewPage={onNewPage} depth={depth} />
      ))}
    </ul>
  )
}

function FolderItem({
  node,
  siteSlug,
  onNewChild,
  onNewPage,
  depth,
}: {
  node: FolderNode
  siteSlug: string
  onNewChild: (parentId: string) => void
  onNewPage: (folderId: string) => void
  depth: number
}) {
  const pathname = usePathname()
  const isActive = pathname.includes(`/folder/${node.id}`)
  const hasChildren = node.children.length > 0
  const [expanded, setExpanded] = useState(isActive || hasChildren && depth === 0)

  return (
    <li>
      <div
        className={`flex items-center gap-1 group rounded-md transition-colors ${
          isActive
            ? 'bg-accent/10 text-accent'
            : 'text-fg-secondary hover:bg-bg-hover hover:text-fg-primary'
        }`}
        style={{ paddingLeft: `${depth * 12 + 4}px`, paddingRight: '4px' }}
      >
        <button
          onClick={() => setExpanded(v => !v)}
          className={`w-5 h-5 flex items-center justify-center flex-shrink-0 rounded
                      text-fg-tertiary hover:text-fg-primary transition-colors
                      ${!hasChildren ? 'invisible pointer-events-none' : ''}`}
        >
          {expanded
            ? <ChevronDownIcon className="w-3 h-3" />
            : <ChevronRightIcon className="w-3 h-3" />}
        </button>

        <Link
          href={`/${siteSlug}/folder/${node.id}`}
          className="flex-1 flex items-center gap-1.5 py-1 text-sm overflow-hidden"
        >
          <FolderIcon
            className="w-3.5 h-3.5 flex-shrink-0 opacity-50"
            locked={node.permissionMode === 'override'}
          />
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">{node.name}</span>
        </Link>

        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
          <button
            onClick={e => { e.preventDefault(); onNewPage(node.id) }}
            title="New page in folder"
            className="w-5 h-5 flex items-center justify-center rounded text-fg-tertiary
                       hover:text-fg-primary hover:bg-bg-active transition-all"
          >
            <PageIcon className="w-3 h-3" />
          </button>
          <button
            onClick={e => { e.preventDefault(); onNewChild(node.id) }}
            title="New sub-folder"
            className="w-5 h-5 flex items-center justify-center rounded text-fg-tertiary
                       hover:text-fg-primary hover:bg-bg-active transition-all"
          >
            <PlusIcon className="w-3 h-3" />
          </button>
        </div>
      </div>

      {expanded && hasChildren && (
        <FolderTree nodes={node.children} siteSlug={siteSlug}
                    onNewChild={onNewChild} onNewPage={onNewPage} depth={depth + 1} />
      )}
    </li>
  )
}
