import type { CallClass } from '@localixai/mini-app-sdk/backend'
import type { Refusal } from './outcome'

/** What a tool that changes the app's data declares: one at a time, and it writes durable state. */
export const writes = {
  executionMode: 'sequential' as const,
  mutates: true,
  classify: (): CallClass => ({ effect: 'host' }),
  permissionPaths: (): string[] => [],
}

/** A tool that deletes, which cannot be undone. */
export const deletes = {
  ...writes,
  classify: (): CallClass => ({ effect: 'host', irreversible: true }),
}

/** What every tool that only reads declares: it may overlap with others. */
export const reads = {
  executionMode: 'parallel' as const,
  mutates: false,
  classify: (): CallClass => ({ effect: 'read' }),
  permissionPaths: (): string[] => [],
}

/** The result of a call that was refused, and changed nothing. */
export const refused = (refusal: Refusal) => ({ content: refusal.message, isError: true })
