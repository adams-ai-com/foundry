
import { requireAdmin } from "@/lib/auth"
import { logout } from "@/lib/actions"
import AdminNav from "./AdminNav"

export const dynamic = "force-dynamic"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin()
  const initials = session.email.slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen bg-bg-base flex">
      <aside className="w-60 border-r border-border bg-bg-raised flex flex-col flex-shrink-0">
        <div className="h-14 flex items-center gap-3 px-4 border-b border-border">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-accent-fg">
              <path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 0 2H5a1 1 0 0 1-1-1zm0 6a1 1 0 0 1 1-1h10a1 1 0 0 1 0 2H5a1 1 0 0 1-1-1zm0 6a1 1 0 0 1 1-1h6a1 1 0 0 1 0 2H5a1 1 0 0 1-1-1z"/>
            </svg>
          </div>
          <div>
            <div className="text-xs font-semibold text-fg-primary leading-none">Foundry Admin</div>
            <div className="text-[10px] text-fg-tertiary mt-0.5">{session.role}</div>
          </div>
        </div>

        <AdminNav />

        <div className="p-3 border-t border-border mt-auto">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
              <span className="text-accent text-[10px] font-semibold">{initials}</span>
            </div>
            <span className="text-xs text-fg-secondary overflow-hidden whitespace-nowrap text-ellipsis">{session.email}</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/" className="text-xs text-fg-tertiary hover:text-fg-primary transition-colors">Back to Workspace</a>
            <form action={logout} className="ml-auto">
              <button className="text-xs text-fg-tertiary hover:text-fg-primary transition-colors">Sign out</button>
            </form>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto min-w-0">
        {children}
      </main>
    </div>
  )
}
