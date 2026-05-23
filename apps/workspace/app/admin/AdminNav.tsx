'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const sections = [
  {
    label: 'Management',
    items: [
      { label: 'Overview',    href: '/admin' },
      { label: 'Users',       href: '/admin/users' },
      { label: 'Groups',      href: '/admin/groups' },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { label: 'Org Settings', href: '/admin/org' },
      { label: 'Domains',      href: '/admin/domains' },
      { label: 'App Access',   href: '/admin/apps' },
      { label: 'Security',     href: '/admin/security' },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { label: 'Audit Log',  href: '/admin/audit' },
      { label: 'Sessions',   href: '/admin/sessions' },
      { label: 'Mail Admin', href: '/admin/mail' },
      { label: 'Reports',    href: '/admin/reports' },
    ],
  },
]

export default function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="flex-1 p-2 overflow-y-auto">
      {sections.map(section => (
        <div key={section.label} className="mb-4">
          <div className="px-2 py-1 text-[10px] font-semibold text-fg-tertiary uppercase tracking-wider">
            {section.label}
          </div>
          <div className="space-y-0.5">
            {section.items.map(item => {
              const active = item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    'flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                    active
                      ? 'bg-accent/10 text-accent font-medium'
                      : 'text-fg-secondary hover:text-fg-primary hover:bg-bg-hover',
                  ].join(' ')}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}
