import React from 'react'

function SparkleIcon({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
         strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
      <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
    </svg>
  )
}
function CodeIcon({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
         strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
      <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
    </svg>
  )
}
function ServerIcon({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
         strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
      <rect x="2" y="2" width="20" height="8" rx="2"/>
      <rect x="2" y="14" width="20" height="8" rx="2"/>
      <path d="M6 6h.01M6 18h.01"/>
    </svg>
  )
}
function FoundryLogoIcon({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style} aria-hidden="true">
      <path d="M4 5a1 1 0 011-1h14a1 1 0 010 2H5a1 1 0 01-1-1zm0 6a1 1 0 011-1h10a1 1 0 010 2H5a1 1 0 01-1-1zm0 6a1 1 0 011-1h6a1 1 0 010 2H5a1 1 0 01-1-1z"/>
    </svg>
  )
}

const FEATURES = [
  {
    Icon: SparkleIcon,
    title: 'AI-native',
    desc: 'Intelligent assistance built into every app — write, analyze, search.',
  },
  {
    Icon: CodeIcon,
    title: 'Open source',
    desc: 'AGPL-3.0 licensed. Inspect every line, fork it, run it yourself.',
  },
  {
    Icon: ServerIcon,
    title: 'Self-hosted',
    desc: 'Your documents and email never leave your own infrastructure.',
  },
]

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">

      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[460px] xl:w-[520px] flex-shrink-0 flex-col relative overflow-hidden">

        {/* Base gradient */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(145deg, #020617 0%, #1e1b4b 50%, #0f0f23 100%)' }} />

        {/* Radial accent glow — top right */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 70% 50% at 75% 10%, rgb(129 140 248 / .18), transparent 60%)' }} />

        {/* Secondary glow — bottom left */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 50% 40% at -10% 90%, rgb(99 102 241 / .12), transparent 60%)' }} />

        {/* Grid texture */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(rgb(255 255 255 / .025) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / .025) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />

        {/* Content */}
        <div className="relative flex flex-col h-full px-12 py-12 z-10">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgb(255 255 255 / .10)', backdropFilter: 'blur(4px)', border: '1px solid rgb(255 255 255 / .12)' }}>
              <FoundryLogoIcon className="text-white" style={{ width: '1.1rem', height: '1.1rem' }} />
            </div>
            <span className="font-bold text-white text-lg tracking-tight">Foundry</span>
          </div>

          {/* Central copy */}
          <div className="flex-1 flex flex-col justify-center py-16">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-5" style={{ color: 'rgb(129 140 248 / .7)' }}>
              Open-source workspace
            </p>

            <h2 className="text-[2.1rem] font-bold leading-[1.15] tracking-tight mb-5" style={{ color: 'rgb(248 248 255)' }}>
              Everything your team<br />
              needs. Nothing you<br />
              don&apos;t own.
            </h2>

            <p className="text-sm leading-relaxed mb-10" style={{ color: 'rgb(255 255 255 / .42)' }}>
              Mail, docs, spreadsheets, and a team wiki — all in one beautiful,
              self-hosted platform built in the open.
            </p>

            <div className="space-y-5">
              {FEATURES.map(({ Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgb(255 255 255 / .07)', border: '1px solid rgb(255 255 255 / .08)' }}>
                    <Icon className="w-4 h-4" style={{ color: 'rgb(129 140 248 / .8)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'rgb(255 255 255 / .88)' }}>{title}</p>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'rgb(255 255 255 / .38)' }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3">
            <span className="text-[10.5px] font-mono px-2 py-0.5 rounded" style={{ background: 'rgb(255 255 255 / .07)', color: 'rgb(255 255 255 / .35)', border: '1px solid rgb(255 255 255 / .08)' }}>
              AGPL-3.0
            </span>
            <span style={{ color: 'rgb(255 255 255 / .15)' }} className="text-xs">·</span>
            <span className="text-[11px]" style={{ color: 'rgb(255 255 255 / .28)' }}>Built by Adams AI</span>
          </div>
        </div>
      </div>

      {/* ── Right panel ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-bg-base px-6 py-12">

        {/* Mobile-only logo */}
        <div className="lg:hidden mb-10 flex flex-col items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-accent flex items-center justify-center shadow-lg">
            <FoundryLogoIcon className="w-5 h-5 text-accent-fg" />
          </div>
          <span className="text-base font-bold text-fg-primary tracking-tight">Foundry</span>
        </div>

        <div className="w-full max-w-[380px]">
          {children}
        </div>
      </div>

    </div>
  )
}
