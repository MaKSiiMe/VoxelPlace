import type { ReactNode } from 'react'

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-6 items-center justify-center rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-fg-muted">
      {children}
    </kbd>
  )
}
