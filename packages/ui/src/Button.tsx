import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ variant = 'default', size = 'md', className = '', ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none'
  const variants = {
    default: 'bg-accent text-accent-fg hover:bg-accent-hover focus:ring-accent/40',
    ghost:   'hover:bg-bg-hover text-fg-secondary hover:text-fg-primary focus:ring-border',
    outline: 'border border-border hover:bg-bg-hover text-fg-secondary hover:text-fg-primary focus:ring-border',
  }
  const sizes = {
    sm: 'h-7 px-2 text-xs gap-1',
    md: 'h-9 px-3 text-sm gap-1.5',
    lg: 'h-11 px-4 text-base gap-2',
  }
  return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />
}
