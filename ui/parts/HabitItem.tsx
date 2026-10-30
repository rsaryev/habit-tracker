import { Circle, CircleCheck, Trash2 } from 'lucide-react'
import { IconButton } from '@localixai/kit/icon-button'
import { cn } from '@localixai/mini-app-sdk/ui/classes'
import type { Category } from '../../shared/model'
import type { HabitRow } from '../../shared/summary'
import { CategoryMenu } from './CategoryMenu'

/**
 * One habit: tick it, see where it stands today, move it to a category, delete it. Narrow, the
 * category sits under the title; wide, it sits beside it.
 */
export function HabitItem({
  habit,
  categories,
  busy,
  onToggle,
  onSetCategory,
  onRemove,
}: {
  habit: HabitRow
  categories: readonly Category[]
  busy: boolean
  onToggle: () => void
  onSetCategory: (categoryId: string | null) => void
  onRemove: () => void
}) {
  const verb = habit.done ? 'not done' : 'done'
  return (
    <li
      className={cn(
        'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 px-3 py-2.5',
        '@lg:grid-cols-[auto_minmax(0,1fr)_auto_auto]',
      )}
    >
      <IconButton
        aria-label={`Mark ${habit.title} ${verb}`}
        tooltip={`Mark ${verb}`}
        disabled={busy}
        onClick={onToggle}
      >
        {habit.done ? <CircleCheck /> : <Circle />}
      </IconButton>
      <div className="min-w-0">
        <p className="break-words text-sm font-medium text-foreground">{habit.title}</p>
        <p className={cn('text-xs', habit.done ? 'text-status-success' : 'text-text-faint')}>
          {habit.done ? 'Done today' : 'Daily'}
        </p>
      </div>
      <IconButton
        aria-label={`Delete ${habit.title}`}
        tooltip="Delete habit"
        size="sm"
        tone="danger"
        disabled={busy}
        onClick={onRemove}
        className="col-start-3 row-start-1 @lg:col-start-4"
      >
        <Trash2 />
      </IconButton>
      <div
        className={cn(
          'col-span-2 col-start-2 row-start-2 min-w-0',
          '@lg:col-span-1 @lg:col-start-3 @lg:row-start-1',
        )}
      >
        <CategoryMenu
          title={habit.title}
          categoryId={habit.categoryId}
          categories={categories}
          disabled={busy}
          onChoose={onSetCategory}
        />
      </div>
    </li>
  )
}
