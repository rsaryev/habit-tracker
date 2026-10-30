import type { MiniAppContext } from '@localixai/mini-app-sdk/backend'
import type { Category, Habit } from '../shared/model'
import { chooseCategory, type CategoryChoice } from './category-choice'
import { categoryNotFound, done, type Outcome } from './outcome'
import type { Stores } from './stores'

export interface NewHabit {
  title: string
  /** The category's id, `null` for none; left out, the decision model chooses. */
  categoryId?: string | null | undefined
}

export interface AddedHabit {
  habit: Habit
  category: Category | null
  choice: CategoryChoice
  /** Whether there is any category at all to put it in. */
  hasCategories: boolean
}

/**
 * Add a habit. A category that was named must exist; one that was not named is chosen by the
 * decision model among the categories there are now. `sessionId` is the chat that pays for it.
 */
export async function addHabit(
  ctx: MiniAppContext,
  { habits, categories }: Stores,
  request: NewHabit,
  sessionId?: string,
): Promise<Outcome<AddedHabit>> {
  const all = await categories.list()
  let choice: CategoryChoice
  if (request.categoryId === undefined) {
    choice = await chooseCategory(ctx, all, request.title, sessionId)
  } else {
    if (request.categoryId !== null && !all.some((c) => c.id === request.categoryId)) {
      return categoryNotFound(request.categoryId)
    }
    choice = { categoryId: request.categoryId, by: 'given' }
  }
  const habit = await habits.add({ title: request.title, categoryId: choice.categoryId })
  const category = all.find((candidate) => candidate.id === choice.categoryId) ?? null
  return done({ habit, category, choice, hasCategories: all.length > 0 })
}
