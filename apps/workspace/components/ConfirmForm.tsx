'use client'

type Props = {
  action: (fd: FormData) => Promise<void>
  message: string
  className?: string
  children: React.ReactNode
}

export default function ConfirmForm({ action, message, className, children }: Props) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => { if (!confirm(message)) e.preventDefault() }}
    >
      {children}
    </form>
  )
}
