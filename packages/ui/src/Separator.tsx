import React from 'react'

export function Separator({ orientation = 'vertical' }: { orientation?: 'vertical' | 'horizontal' }) {
  if (orientation === 'vertical') return <div className="w-px h-5 bg-border mx-1 self-center" />
  return <div className="h-px w-full bg-border my-1" />
}
