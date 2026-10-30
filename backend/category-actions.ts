import { findByName } from '../shared/categories'
import { MAX_CATEGORIES, categoryNameSchema, type Category, type Habit } from '../shared/model'
import { categoryNotFound, done, habitNotFound, refuse, type Outcome } from './outcome'
import type { Stores } from './stores'

/**
 * The rules about categories, once for the agent's tools and the screen's routes. The collection's
 * own routes accept any name; these are what keep names unique and what unlink a deleted category's
 * habits, so the screen changes categories through them and not through those routes.
 */

const nameTaken = (taken: Category) =>
  refuse(409, 'name_taken', `A category named "${taken.name}" already exists (id ${taken.id}).`)

function checkedName(name: string): Outcome<string> {
  const parsed = categoryNameSchema.safeParse(name)
  if (parsed.success) return done(parsed.data)
  return refuse(400, 'invalid_name', parsed.error.issues[0]?.message ?? 'Name the category.')
}

export async function addCategory(
  { categories }: Stores,
  name: string,
): Promise<Outcome<Category>> {
  const checked = checkedName(name)
  if (!checked.ok) return checked
  const all = await categories.list()
  const taken = findByName(all, checked.value)
  if (taken) return nameTaken(taken)
  if (all.length >= MAX_CATEGORIES) {
    return refuse(
      400,
      'too_many',
      `There are already ${MAX_CATEGORIES} categories: delete one first.`,
    )
  }
  return done(await categories.add({ name: checked.value }))
}

export async function renameCategory(
  { categories }: Stores,
  id: string,
  name: string,
): Promise<Outcome<{ before: Category; after: Category }>> {
  const checked = checkedName(name)
  if (!checked.ok) return checked
  const all = await categories.list()
  const before = all.find((category) => category.id === id)
  if (!before) return categoryNotFound(id)
  const taken = findByName(all, checked.value, id)
  if (taken) return nameTaken(taken)
  const after = await categories.update(id, { name: checked.value })
  return after ? done({ before, after }) : categoryNotFound(id)
}

/** Delete a category. Its habits stay, with no category; says how many were unlinked. */
export async function deleteCategory(
  { categories, habits }: Stores,
  id: string,
): Promise<Outcome<{ category: Category; unlinked: number }>> {
  const category = await categories.get(id)
  if (!category) return categoryNotFound(id)
  await categories.remove(id)
  const members = (await habits.list()).filter((habit) => habit.categoryId === id)
  for (const habit of members) await habits.update(habit.id, { categoryId: null })
  return done({ category, unlinked: members.length })
}

/** Put a habit in a category, or in none with `null`. */
export async function setHabitCategory(
  { categories, habits }: Stores,
  habitId: string,
  categoryId: string | null,
): Promise<Outcome<{ habit: Habit; category: Category | null }>> {
  if (!(await habits.get(habitId))) return habitNotFound(habitId)
  const category = categoryId === null ? null : await categories.get(categoryId)
  if (categoryId !== null && !category) return categoryNotFound(categoryId)
  const habit = await habits.update(habitId, { categoryId })
  return habit ? done({ habit, category }) : habitNotFound(habitId)
}
