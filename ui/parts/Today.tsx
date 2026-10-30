import { ContextRing } from '@localixai/kit/context-ring'
import { countHabits, type Summary } from '../../shared/summary'

/** Today at a glance: how many habits are done, as the headline number inside a ring. */
export function Today({ summary }: { summary: Summary }) {
  const { done, total } = summary
  const left = total - done
  const status =
    total === 0 ? 'Add your first habit.' : left === 0 ? 'Every habit is done.' : `${left} to go.`
  return (
    <section
      aria-label="Today"
      className="flex items-center gap-5 border-b border-border-faint pb-5"
    >
      <div
        role="img"
        aria-label={`${done} of ${countHabits(total)} done`}
        className="relative size-24 shrink-0 text-status-success"
      >
        <ContextRing
          fraction={summary.progress}
          size={96}
          radius={10}
          strokeWidth={1.6}
          className="size-full"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold tabular-nums text-foreground">{done}</span>
          <span className="text-xs text-text-faint">of {total}</span>
        </div>
      </div>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-foreground">Today</h2>
        <p className="mt-1 text-sm text-text-soft">{status}</p>
      </div>
    </section>
  )
}
