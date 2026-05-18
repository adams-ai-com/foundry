'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { WikiEditor } from './WikiEditor'
import { createPage, deletePage } from '@/lib/actions'
import type { WikiPage, PageTreeNode } from '@/lib/actions'

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
  const router = useRouter()

  async function handleNewPage(parentId?: string) {
    await createPage(parentId ?? null)
  }

  async function handleDelete() {
    if (page.isHome) return
    if (!confirm(`Delete "${page.title}"? Sub-pages will become top-level pages.`)) return
    await deletePage(page.id)
  }

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="w-60 border-r border-gray-100 flex flex-col flex-shrink-0 bg-gray-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-600 rounded flex items-center justify-center">
                <span className="text-white font-bold text-xs">W</span>
              </div>
              <span className="font-semibold text-sm text-gray-800">Foundry Wiki</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              title="Close sidebar"
            >
              ‹
            </button>
          </div>

          {/* New page button */}
          <div className="px-3 py-2 border-b border-gray-100">
            <button
              onClick={() => handleNewPage()}
              className="w-full text-left text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 px-2 py-1.5 rounded flex items-center gap-1"
            >
              <span className="text-base leading-none">+</span> New page
            </button>
          </div>

          {/* Page tree */}
          <nav className="flex-1 overflow-y-auto py-2 px-2">
            <PageTree
              nodes={tree}
              activePage={page}
              onNewChild={handleNewPage}
            />
          </nav>
        </aside>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="border-b border-gray-100 px-4 py-2 flex items-center gap-2 flex-shrink-0">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-400 hover:text-gray-600 mr-1"
              title="Open sidebar"
            >
              ›
            </button>
          )}

          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1 text-sm flex-1 min-w-0">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.id} className="flex items-center gap-1 min-w-0">
                {i > 0 && <span className="text-gray-300">/</span>}
                {i === breadcrumbs.length - 1 ? (
                  <span className="text-gray-700 font-medium truncate">{crumb.title || 'Untitled'}</span>
                ) : (
                  <Link href={`/page/${crumb.id}`} className="text-gray-400 hover:text-gray-700 truncate">
                    {crumb.title || 'Untitled'}
                  </Link>
                )}
              </span>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => handleNewPage(page.id)}
              className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 hover:bg-gray-100 rounded"
            >
              + Sub-page
            </button>
            {!page.isHome && (
              <button
                onClick={handleDelete}
                className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 hover:bg-gray-100 rounded"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-hidden">
          <WikiEditor page={page} />
        </div>
      </div>
    </div>
  )
}

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
    <ul className="space-y-0.5">
      {nodes.map((node) => (
        <PageTreeItem
          key={node.id}
          node={node}
          activePage={activePage}
          onNewChild={onNewChild}
          depth={depth}
        />
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
  const [expanded, setExpanded] = useState(
    node.isHome || isAncestor(node, activePage.id),
  )
  const isActive = node.id === activePage.id
  const hasChildren = node.children.length > 0

  return (
    <li>
      <div
        className={`flex items-center gap-1 group rounded px-2 py-1 ${
          isActive ? 'bg-green-100 text-green-800' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <button
          onClick={() => setExpanded((v) => !v)}
          className={`w-4 h-4 flex items-center justify-center text-gray-400 flex-shrink-0 ${!hasChildren ? 'invisible' : ''}`}
        >
          <span className="text-xs">{expanded ? '▾' : '▸'}</span>
        </button>
        <Link
          href={`/page/${node.id}`}
          className="flex-1 text-sm truncate"
        >
          {node.isHome ? '🏠 ' : ''}{node.title || 'Untitled'}
        </Link>
        <button
          onClick={(e) => { e.preventDefault(); onNewChild(node.id) }}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 text-sm leading-none"
          title="Add sub-page"
        >
          +
        </button>
      </div>

      {expanded && hasChildren && (
        <PageTree
          nodes={node.children}
          activePage={activePage}
          onNewChild={onNewChild}
          depth={depth + 1}
        />
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
