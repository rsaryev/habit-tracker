import type { ReactNode } from 'react'

/** Rows divided by hairlines inside one border: the only container the screen draws. */
export function RowList({ children }: { children: ReactNode }) {
  return (
    <ul className="divide-y divide-border-faint overflow-hidden rounded-lg border border-border">
      {children}
    </ul>
  )
}
