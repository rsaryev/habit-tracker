import { useState } from 'react'

/**
 * A question asked before something is deleted. `target` is what it is about; it stays set while
 * the dialog closes, so the question does not empty out as it fades.
 */
export function useConfirmation<T>() {
  const [target, setTarget] = useState<T | null>(null)
  const [open, setOpen] = useState(false)
  return {
    target,
    open,
    ask: (item: T) => {
      setTarget(item)
      setOpen(true)
    },
    close: () => setOpen(false),
  }
}
