import { UNCATEGORIZED, categoryOf, groupByCategory, type HabitGroup } from './categories'
import type { Category, Habit } from './model'

export const WEEK_DAYS = 7

/** The local calendar day of a moment, `YYYY-MM-DD`. */
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** A habit as today shows it. Its `categoryId` is the category that still exists, or null. */
export interface HabitRow extends Habit {
  done: boolean
  /** The days of the last week it was done, oldest first. */
  recentDays: string[]
}

export interface CategoryRow extends Category {
  habits: number
}

export interface Summary {
  /** Today's local day. */
  today: string
  /** Habits done today, and all habits. */
  done: number
  total: number
  /** Done over all, 0–1. */
  progress: number
  /** Habits done per day for the last seven days, oldest first, today last. */
  week: { key: string; value: number }[]
  /** The habits grouped by category, uncategorized last; a category with none has no group. */
  groups: HabitGroup<HabitRow>[]
  /** Every category, with how many habits are in it. */
  categories: CategoryRow[]
}

/** Everything the screen shows and the agent is told, computed once from the two lists. */
export function summarize(
  habits: readonly Habit[],
  categories: readonly Category[],
  now: Date,
): Summary {
  const today = dayKey(now)
  const weekKeys = Array.from({ length: WEEK_DAYS }, (_, index) =>
    dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (WEEK_DAYS - 1 - index))),
  )
  const rows = habits.map((habit): HabitRow => ({
    ...habit,
    categoryId: categoryOf(habit, categories)?.id ?? null,
    done: habit.days.includes(today),
    recentDays: weekKeys.filter((key) => habit.days.includes(key)),
  }))
  const done = rows.filter((row) => row.done).length
  return {
    today,
    done,
    total: rows.length,
    progress: rows.length ? done / rows.length : 0,
    week: weekKeys.map((key) => ({ key, value: rows.filter((r) => r.days.includes(key)).length })),
    groups: groupByCategory(rows, categories),
    categories: categories.map((category) => ({
      ...category,
      habits: rows.filter((row) => row.categoryId === category.id).length,
    })),
  }
}

/** "1 habit", "3 habits". */
export const countHabits = (habits: number) => `${habits} ${habits === 1 ? 'habit' : 'habits'}`

/** The categories with the ids the agent names them by, and how many habits each holds. */
export function describeCategories(categories: readonly CategoryRow[]): string {
  if (categories.length === 0) return 'No categories yet.'
  const lines = categories.map((c) => `- ${c.name} (id ${c.id}): ${countHabits(c.habits)}`)
  return ['Categories:', ...lines].join('\n')
}

/** The summary as the agent reads it: today, each habit with its id, the week, the categories. */
export function describeForAgent(summary: Summary): string {
  const habits = summary.groups.flatMap((group) =>
    group.habits.map((habit) => {
      const where = group.category?.name ?? UNCATEGORIZED
      const state = habit.done ? 'done' : 'not done'
      const days = habit.recentDays.join(', ') || 'none'
      return `- ${habit.title} (id ${habit.id}), ${where}: ${state} today; this week ${days}`
    }),
  )
  const week = summary.week.map((day) => `${day.key}: ${day.value}`).join('; ')
  return [
    `Today (${summary.today}): ${summary.done} of ${countHabits(summary.total)} done.`,
    habits.length ? ['Habits:', ...habits].join('\n') : 'No habits yet.',
    `Last ${WEEK_DAYS} days (habits done per day): ${week}`,
    describeCategories(summary.categories),
  ].join('\n')
}
