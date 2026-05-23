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
      className={`inline-flex items-center justify-center w-7 h-7 rounded text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-offset-1 disabled:opacity-40 disabled:pointer-events-none ${
        active ? 'bg-bg-active text-accent' : 'hover:bg-bg-hover text-fg-secondary hover:text-fg-primary'
      } ${className}`}
    >
      {children}
    </button>
  )
}
