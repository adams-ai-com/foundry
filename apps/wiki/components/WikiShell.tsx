'use client'

import { useState } from 'react'
import Link from 'next/link'
import { WikiEditor } from './WikiEditor'
import { createPage, deletePage } from '@/lib/actions'
import type { WikiPage, PageTreeNode } from '@/lib/actions'

// ── Icons ──────────────────────────────────────────────────────────────────────

function HomeIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
    </svg>
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
function ChevronLeftIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 19l-7-7 7-7"/>
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
function ChevronDownIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 9l-7 7-7-7"/>
    </svg>
  )
}

// ── Shell ──────────────────────────────────────────────────────────────────────

export function WikiShell({
  page,
  tree,
  breadcrumbs,
}: {
  page: WikiPage
  tree: PageTreeNode[]
  breadcrumbs: WikiPage[]
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  async function handleNewPage(parentId?: string) {
    await createPage(parentId ?? null)
  }

  async function handleDelete() {
    if (page.isHome) return
    if (!confirm(`Delete "${page.title}"? Sub-pages will become top-level pages.`)) return
    await deletePage(page.id)
  }

  return (
    <div className="h-[calc(100vh-3rem)] flex overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <aside className="w-60 border-r border-border flex flex-col flex-shrink-0 bg-bg-surface">
          <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
            <span className="text-[11px] font-semibold text-fg-tertiary uppercase tracking-[0.15em]">
              Pages
            </span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => handleNewPage()}
                title="New page"
                className="w-6 h-6 flex items-center justify-center rounded text-fg-tertiary
                           hover:text-fg-primary hover:bg-bg-hover transition-colors"
              >
                <PlusIcon className="w-3.5 h-3.5" />
              </button>
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

          <nav className="flex-1 overflow-y-auto py-2 px-2">
            <PageTree nodes={tree} activePage={page} onNewChild={handleNewPage} />
          </nav>
        </aside>
      )}

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-bg-base">

        {/* Breadcrumb bar */}
        <div className="border-b border-border px-4 py-2 flex items-center gap-2 flex-shrink-0 bg-bg-raised">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              title="Expand sidebar"
              className="w-6 h-6 flex items-center justify-center rounded text-fg-tertiary
                         hover:text-fg-primary hover:bg-bg-hover transition-colors mr-1"
            >
              <ChevronRightIcon className="w-3.5 h-3.5" />
            </button>
          )}

          <nav className="flex items-center gap-1 text-sm flex-1 min-w-0 overflow-hidden">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.id} className="flex items-center gap-1 min-w-0 shrink-0 last:shrink">
                {i > 0 && <span className="text-fg-tertiary/60">/</span>}
                {i === breadcrumbs.length - 1 ? (
                  <span className="text-fg-primary font-medium overflow-hidden text-ellipsis whitespace-nowrap">
                    {crumb.title || 'Untitled'}
                  </span>
                ) : (
                  <Link
                    href={`/page/${crumb.id}`}
                    className="text-fg-tertiary hover:text-fg-primary whitespace-nowrap transition-colors"
                  >
                    {crumb.title || 'Untitled'}
                  </Link>
                )}
              </span>
            ))}
          </nav>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => handleNewPage(page.id)}
              className="flex items-center gap-1 text-xs text-fg-tertiary hover:text-fg-primary
                         px-2 py-1 hover:bg-bg-hover rounded whitespace-nowrap transition-colors"
            >
              <PlusIcon className="w-3 h-3" />
              Sub-page
            </button>
            {!page.isHome && (
              <button
                onClick={handleDelete}
                className="text-xs text-fg-tertiary hover:text-danger px-2 py-1
                           hover:bg-bg-hover rounded transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <WikiEditor page={page} />
        </div>
      </div>
    </div>
  )
}

// ── Page tree ──────────────────────────────────────────────────────────────────

function PageTree({
  nodes,
  activePage,
  onNewChild,
  depth = 0,
}: {
  nodes: PageTreeNode[]
  activePage: WikiPage
  onNewChild: (parentId: string) => void
  depth?: number
}) {
  return (
    <ul className="space-y-px">
      {nodes.map((node) => (
        <PageTreeItem key={node.id} node={node} activePage={activePage}
                      onNewChild={onNewChild} depth={depth} />
      ))}
    </ul>
  )
}

function PageTreeItem({
  node,
  activePage,
  onNewChild,
  depth,
}: {
  node: PageTreeNode
  activePage: WikiPage
  onNewChild: (parentId: string) => void
  depth: number
}) {
  const [expanded, setExpanded] = useState(node.isHome || isAncestor(node, activePage.id))
  const isActive   = node.id === activePage.id
  const hasChildren = node.children.length > 0

  return (
    <li>
      <div
        className={`flex items-center gap-1 group rounded-md transition-colors ${
          isActive
            ? 'bg-accent/10 text-accent'
            : 'text-fg-secondary hover:bg-bg-hover hover:text-fg-primary'
        }`}
        style={{ paddingLeft: `${depth * 12 + 6}px`, paddingRight: '4px' }}
      >
        {/* Expand / collapse */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className={`w-5 h-5 flex items-center justify-center flex-shrink-0 rounded
                      text-fg-tertiary hover:text-fg-primary transition-colors
                      ${!hasChildren ? 'invisible pointer-events-none' : ''}`}
        >
          {expanded
            ? <ChevronDownIcon className="w-3 h-3" />
            : <ChevronRightIcon className="w-3 h-3" />}
        </button>

        {/* Page link */}
        <Link
          href={`/page/${node.id}`}
          className="flex-1 flex items-center gap-1.5 py-1 text-sm overflow-hidden
                     text-ellipsis whitespace-nowrap"
        >
          {node.isHome
            ? <><HomeIcon className="w-3.5 h-3.5 flex-shrink-0" /><span>Home</span></>
            : <><PageIcon className="w-3.5 h-3.5 flex-shrink-0 opacity-40" /><span className="truncate">{node.title || 'Untitled'}</span></>
          }
        </Link>

        {/* Add sub-page (hover) */}
        <button
          onClick={(e) => { e.preventDefault(); onNewChild(node.id) }}
          title="Add sub-page"
          className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center
                     flex-shrink-0 rounded text-fg-tertiary hover:text-fg-primary
                     hover:bg-bg-active transition-all"
        >
          <PlusIcon className="w-3 h-3" />
        </button>
      </div>

      {expanded && hasChildren && (
        <PageTree nodes={node.children} activePage={activePage}
                  onNewChild={onNewChild} depth={depth + 1} />
      )}
    </li>
  )
}

function isAncestor(node: PageTreeNode, targetId: string): boolean {
  for (const child of node.children) {
    if (child.id === targetId || isAncestor(child, targetId)) return true
  }
  return false
}
