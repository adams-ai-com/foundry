import React from 'react'

interface IconButtonProps {
  active?: boolean
  label: string
  children?: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
  'data-testid'?: string
}

export function IconButton({ active = false, label, className = '', children, onClick, disabled, 'data-testid': testId }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={`inline-flex items-center justify-center w-7 h-7 rounded text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 disabled:opacity-40 disabled:pointer-events-none ${active ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'} ${className}`}
    >
      {children}
    </button>
  )
}
