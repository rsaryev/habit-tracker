import { SectionLabel } from '@localixai/kit/section-label'
import { TrendChart } from '@localixai/mini-app-sdk/ui/stats-charts'
import { WEEK_DAYS, type Summary } from '../../shared/summary'

/** Habits done on each of the last seven days, today last. */
export function Week({ summary }: { summary: Summary }) {
  const any = summary.week.some((day) => day.value > 0)
  return (
    <section aria-label={`Last ${WEEK_DAYS} days`} className="flex flex-col gap-3">
      <SectionLabel as="h2">Last {WEEK_DAYS} days</SectionLabel>
      {any ? (
        <TrendChart points={summary.week} formatValue={(value) => `${value} done`} />
      ) : (
        <p className="text-sm text-text-faint">Nothing done this week yet.</p>
      )}
    </section>
  )
}
