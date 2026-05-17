import React from 'react'

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  label: string
  children?: React.ReactNode
}

export function IconButton({ active = false, label, className = '', children, ...props }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center w-7 h-7 rounded text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 disabled:opacity-40 disabled:pointer-events-none ${active ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
