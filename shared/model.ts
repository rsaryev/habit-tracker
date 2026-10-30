import { z } from 'zod'

/**
 * THE MODEL — what Habit Tracker keeps, shared by the backend, its tools and the screen. Two
 * lists: habits, and the categories the person sorts them into. A habit points at its category by
 * id, or at none.
 */

/** The mini app's name: its routes are `/rpc/<APP>/…`. */
export const APP = 'habit-tracker'
/** The collection of habits: `/rpc/<APP>/habits`. */
export const HABITS = 'habits'
/** The collection of categories: `/rpc/<APP>/categories`. */
export const CATEGORIES = 'categories'
/** How many categories the person can keep. */
export const MAX_CATEGORIES = 100

export const dateSchema = z.iso.date()

export const categoryNameSchema = z
  .string()
  .trim()
  .min(1, 'Name the category.')
  .max(40, 'Keep the name to 40 characters.')
export const categoryInputSchema = z.object({ name: categoryNameSchema })
export const categorySchema = categoryInputSchema.extend({ id: z.string() })
export type Category = z.infer<typeof categorySchema>
export type CategoryInput = z.input<typeof categoryInputSchema>

/**
 * The categories everyone starts with, written once when the app first runs. Each id is the key
 * the first version stored on a habit (`category: 'health'`), which is how those habits find their
 * category again; see {@link habitSchema}.
 */
export const SEED_CATEGORIES: readonly Category[] = [
  { id: 'health', name: 'Health & fitness' },
  { id: 'learning', name: 'Learning' },
  { id: 'wellbeing', name: 'Wellbeing' },
  { id: 'productivity', name: 'Productivity' },
  { id: 'relationships', name: 'Relationships' },
]

/**
 * What a person or the agent sends to add a habit, and any part of it to change one. Nothing has a
 * default here: a change is parsed as a partial, and a default would fill in the parts it leaves
 * out — a new category would reset the days, a new day would reset the category. The defaults
 * belong to the item that is made from an input.
 */
export const habitInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  days: z.array(dateSchema).max(10000).optional(),
  /** The category's id; `null` for none. */
  categoryId: z.string().min(1).nullable().optional(),
})

const storedHabitSchema = z.object({
  id: z.string(),
  title: habitInputSchema.shape.title,
  days: z.array(dateSchema).max(10000).default([]),
  categoryId: z.string().nullable().default(null),
})

/**
 * The first version stored `category: 'health' | … | 'other'` on a habit. Read, such a habit gets
 * the seeded category of that key as its `categoryId`; `other`, or no category at all, is none.
 * The old field is dropped, so the habit reads the same from then on, and the file is written in
 * the new shape by the next change. A habit that already has a `categoryId` is left as it is.
 */
function withLegacyCategory(stored: unknown): unknown {
  if (typeof stored !== 'object' || stored === null || 'categoryId' in stored) return stored
  const legacy = 'category' in stored ? stored.category : undefined
  const seeded = SEED_CATEGORIES.find((category) => category.id === legacy)
  return { ...stored, categoryId: seeded?.id ?? null }
}

/** One stored habit, from the first version's shape or this one's. */
export const habitSchema = z.preprocess(withLegacyCategory, storedHabitSchema)
export type Habit = z.infer<typeof habitSchema>
export type HabitInput = z.input<typeof habitInputSchema>
