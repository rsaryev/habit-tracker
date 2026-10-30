import type { Category, Habit } from './model'

/** What a habit without a category is called, on the screen and to the agent. */
export const UNCATEGORIZED = 'Uncategorized'

const normalize = (name: string) => name.trim().toLowerCase()

/**
 * The category with this name, ignoring case and surrounding spaces. `exceptId` leaves one out, so
 * renaming a category to another case of its own name is not a clash.
 */
export function findByName(
  categories: readonly Category[],
  name: string,
  exceptId?: string,
): Category | undefined {
  return categories.find(
    (category) => category.id !== exceptId && normalize(category.name) === normalize(name),
  )
}

/**
 * A habit's category, or null when it has none or points at one that is gone. Whatever removes a
 * category, its habits read as uncategorized.
 */
export function categoryOf(habit: Habit, categories: readonly Category[]): Category | null {
  return categories.find((category) => category.id === habit.categoryId) ?? null
}

export interface HabitGroup<H extends Habit> {
  /** Null for the habits without a category. */
  category: Category | null
  habits: H[]
}

/**
 * Habits grouped by category: the categories in their order, each habit in the order it was added,
 * and the uncategorized last. A category with no habits has no group.
 */
export function groupByCategory<H extends Habit>(
  habits: readonly H[],
  categories: readonly Category[],
): HabitGroup<H>[] {
  const idOf = (habit: Habit) => categoryOf(habit, categories)?.id ?? null
  return [...categories, null]
    .map((category) => ({
      category,
      habits: habits.filter((habit) => idOf(habit) === (category?.id ?? null)),
    }))
    .filter((group) => group.habits.length > 0)
}
