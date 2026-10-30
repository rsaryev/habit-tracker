import { ListChecks } from 'lucide-react'
import { ConfirmDialog } from '@localixai/kit/confirm-dialog'
import { SectionLabel } from '@localixai/kit/section-label'
import { StateNotice } from '@localixai/kit/state-notice'
import { UNCATEGORIZED } from '../../shared/categories'
import type { Category } from '../../shared/model'
import { countHabits, type HabitRow, type Summary } from '../../shared/summary'
import { useConfirmation } from '../useConfirmation'
import { HabitItem } from './HabitItem'
import { RowList } from './RowList'

/**
 * The habits, a list for each category and one for those without. With no categories at all there
 * is nothing to group by, so the headings are left out. Deleting asks first: the history goes too.
 */
export function HabitList({
  summary,
  categories,
  busy,
  onToggle,
  onSetCategory,
  onRemove,
}: {
  summary: Summary
  categories: readonly Category[]
  busy: boolean
  onToggle: (habit: HabitRow) => void
  onSetCategory: (habitId: string, categoryId: string | null) => void
  onRemove: (habitId: string) => void
}) {
  const removal = useConfirmation<HabitRow>()
  if (summary.total === 0) {
    return (
      <StateNotice
        icon={ListChecks}
        title="No habits yet"
        body="Add one above, or ask in the chat: “add a habit to read for 10 minutes”."
      />
    )
  }
  return (
    <section aria-label="Habits" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Habits</h2>
        <span className="text-xs tabular-nums text-text-faint">{countHabits(summary.total)}</span>
      </div>
      {summary.groups.map((group) => (
        <div key={group.category?.id ?? 'uncategorized'} className="flex flex-col gap-2">
          {categories.length > 0 && (
            <SectionLabel as="h3">
              {group.category?.name ?? UNCATEGORIZED}
              <span className="ml-1.5 tabular-nums">{group.habits.length}</span>
            </SectionLabel>
          )}
          <RowList>
            {group.habits.map((habit) => (
              <HabitItem
                key={habit.id}
                habit={habit}
                categories={categories}
                busy={busy}
                onToggle={() => onToggle(habit)}
                onSetCategory={(categoryId) => onSetCategory(habit.id, categoryId)}
                onRemove={() => removal.ask(habit)}
              />
            ))}
          </RowList>
        </div>
      ))}
      <ConfirmDialog
        open={removal.open}
        title={`Delete "${removal.target?.title ?? ''}"?`}
        description="The habit and its history are deleted. This cannot be undone."
        confirmLabel="Delete habit"
        onConfirm={() => removal.target && onRemove(removal.target.id)}
        onClose={removal.close}
      />
    </section>
  )
}
