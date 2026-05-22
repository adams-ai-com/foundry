'use client'

import { useState } from "react"
import Link from "next/link"
import { WikiEditor } from "./WikiEditor"
import { createPage, deletePage } from "@/lib/actions"
import type { WikiPage, PageTreeNode } from "@/lib/actions"

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
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="w-60 border-r border-gray-100 flex flex-col flex-shrink-0 bg-gray-50">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pages</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleNewPage()}
                className="text-gray-400 hover:text-gray-700 px-1.5 py-1 rounded hover:bg-gray-100 text-sm leading-none"
                title="New page"
              >
                +
              </button>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-gray-400 hover:text-gray-600 px-1.5 py-1 rounded hover:bg-gray-100 text-base leading-none"
                title="Close sidebar"
              >
                ‹
              </button>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto py-2 px-2">
            <PageTree nodes={tree} activePage={page} onNewChild={handleNewPage} />
          </nav>
        </aside>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Breadcrumb bar */}
        <div className="border-b border-gray-100 px-4 py-2 flex items-center gap-2 flex-shrink-0">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-400 hover:text-gray-600 mr-1 text-base leading-none px-1.5 py-1 rounded hover:bg-gray-100"
              title="Open sidebar"
            >
              ›
            </button>
          )}

          <nav className="flex items-center gap-1 text-sm flex-1 min-w-0 overflow-hidden">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.id} className="flex items-center gap-1 min-w-0 shrink-0 last:shrink">
                {i > 0 && <span className="text-gray-300">/</span>}
                {i === breadcrumbs.length - 1 ? (
                  <span className="text-gray-700 font-medium overflow-hidden text-ellipsis whitespace-nowrap">{crumb.title || "Untitled"}</span>
                ) : (
                  <Link href={`/page/${crumb.id}`} className="text-gray-400 hover:text-gray-700 whitespace-nowrap">
                    {crumb.title || "Untitled"}
                  </Link>
                )}
              </span>
            ))}
          </nav>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => handleNewPage(page.id)}
              className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 hover:bg-gray-100 rounded whitespace-nowrap"
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
        <PageTreeItem key={node.id} node={node} activePage={activePage} onNewChild={onNewChild} depth={depth} />
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
  const isActive = node.id === activePage.id
  const hasChildren = node.children.length > 0

  return (
    <li>
      <div
        className={`flex items-center gap-1 group rounded px-2 py-1 ${
          isActive ? "bg-green-50 text-green-800" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <button
          onClick={() => setExpanded((v) => !v)}
          className={`w-4 h-4 flex items-center justify-center text-gray-400 flex-shrink-0 ${!hasChildren ? "invisible" : ""}`}
        >
          <span className="text-xs">{expanded ? "▾" : "▸"}</span>
        </button>
        <Link href={`/page/${node.id}`} className="flex-1 text-sm overflow-hidden text-ellipsis whitespace-nowrap">
          {node.isHome ? "🏠 Home" : (node.title || "Untitled")}
        </Link>
        <button
          onClick={(e) => { e.preventDefault(); onNewChild(node.id) }}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 text-sm leading-none px-0.5 flex-shrink-0"
          title="Add sub-page"
        >
          +
        </button>
      </div>

      {expanded && hasChildren && (
        <PageTree nodes={node.children} activePage={activePage} onNewChild={onNewChild} depth={depth + 1} />
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
