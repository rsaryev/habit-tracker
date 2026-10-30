import { useMemo } from 'react'
import { useAgentContext, useScreenProblem, type ScreenProps } from '@localixai/mini-app-sdk/ui/app'
import { ProblemLine } from '@localixai/mini-app-sdk/ui/components'
import { LoadingHint } from '@localixai/kit/empty-hint'
import { cn } from '@localixai/mini-app-sdk/ui/classes'
import { APP } from '../shared/model'
import { describeForAgent } from '../shared/summary'
import { Categories } from './parts/Categories'
import { HabitList } from './parts/HabitList'
import { QuickAdd } from './parts/QuickAdd'
import { Today } from './parts/Today'
import { Week } from './parts/Week'
import { useTracker } from './useTracker'

/**
 * The screen. Every number on it comes from the one summary the agent's tools also use, and the
 * agent is told exactly what the screen shows.
 */
export function App({ active, publishMessageContext }: ScreenProps) {
  const tracker = useTracker(active)
  const { summary } = tracker
  useAgentContext(
    publishMessageContext,
    active && !tracker.loading,
    useMemo(() => ({ label: 'Habit Tracker', content: describeForAgent(summary) }), [summary]),
  )
  const problem = useScreenProblem({
    app: APP,
    subject: 'Habits',
    failure: tracker.failure,
    showingData: summary.total > 0 || summary.categories.length > 0,
  })

  return (
    // The screen scrolls on one axis and reflows to its own width (it may sit in a narrow pane).
    <div className="@container h-full min-h-0 overflow-y-auto">
      <div className="flex flex-col gap-6 px-4 py-5 @2xl:px-6">
        <header>
          <h1 className="text-base font-semibold text-foreground">Habit Tracker</h1>
          <p className="mt-0.5 text-xs text-text-faint">Small steps, every day</p>
        </header>
        {problem && <ProblemLine {...problem} />}
        {tracker.loading ? (
          <LoadingHint>Opening Habit Tracker…</LoadingHint>
        ) : (
          <div
            className={cn(
              'grid gap-6 @3xl:items-start',
              '@3xl:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]',
            )}
          >
            <div className="flex min-w-0 flex-col gap-6">
              <Today summary={summary} />
              <QuickAdd
                categories={summary.categories}
                busy={tracker.sending}
                onAdd={tracker.addHabit}
              />
              <HabitList
                summary={summary}
                categories={summary.categories}
                busy={tracker.sending}
                onToggle={(habit) => void tracker.toggle(habit)}
                onSetCategory={(id, categoryId) => void tracker.setCategory(id, categoryId)}
                onRemove={(id) => void tracker.removeHabit(id)}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-6">
              <Week summary={summary} />
              <Categories
                categories={summary.categories}
                busy={tracker.sending}
                onAdd={tracker.addCategory}
                onRename={tracker.renameCategory}
                onDelete={(id) => void tracker.deleteCategory(id)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
