'use client'

import { useEffect, useRef } from 'react'

interface ContextMenuProps {
  type: 'row' | 'col'
  index: number
  x: number
  y: number
  onClose: () => void
  onInsertBefore: () => void
  onInsertAfter: () => void
  onDelete: () => void
  onSortAsc?: () => void
  onSortDesc?: () => void
}

export function ContextMenu({
  type, x, y, onClose,
  onInsertBefore, onInsertAfter, onDelete,
  onSortAsc, onSortDesc,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-bg-raised border border-border rounded-lg shadow-lg py-1 min-w-[168px]"
      style={{ left: x, top: y }}
    >
      <Item onClick={() => { onInsertBefore(); onClose() }}>
        {type === 'row' ? 'Insert row above' : 'Insert column left'}
      </Item>
      <Item onClick={() => { onInsertAfter(); onClose() }}>
        {type === 'row' ? 'Insert row below' : 'Insert column right'}
      </Item>
      <div className="h-px bg-border mx-1 my-1" />
      <Item danger onClick={() => { onDelete(); onClose() }}>
        {type === 'row' ? 'Delete row' : 'Delete column'}
      </Item>
      {type === 'col' && onSortAsc && onSortDesc && (
        <>
          <div className="h-px bg-border mx-1 my-1" />
          <Item onClick={() => { onSortAsc(); onClose() }}>Sort A → Z</Item>
          <Item onClick={() => { onSortDesc(); onClose() }}>Sort Z → A</Item>
        </>
      )}
    </div>
  )
}

function Item({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-bg-hover ${danger ? 'text-danger' : 'text-fg-primary'}`}
    >
      {children}
    </button>
  )
}
