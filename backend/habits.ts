import { defineCollection, type Collection } from '@localixai/mini-app-sdk/backend'
import { HABITS, habitInputSchema, habitSchema, type Habit } from '../shared/model'

/**
 * The habits. What an input leaves out is filled in here, not by defaults in the input schema: a
 * change is parsed as a partial, and a default there would reset the fields the change never named.
 */
export const habitsSpec = defineCollection({
  name: HABITS,
  item: habitSchema,
  input: habitInputSchema,
  create: (input, { id }) => ({
    id,
    title: input.title,
    days: input.days ?? [],
    categoryId: input.categoryId ?? null,
  }),
  scope: 'app',
  limit: 5000,
  search: (habit) => habit.title,
})

export type Habits = Collection<Habit, typeof habitInputSchema.shape>
