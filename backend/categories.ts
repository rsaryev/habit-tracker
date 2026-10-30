import { join } from 'node:path'
import {
  collectionFileSchema,
  defineCollection,
  openJsonStore,
  statIfExists,
  type Collection,
  type MiniAppContext,
} from '@localixai/mini-app-sdk/backend'
import {
  CATEGORIES,
  MAX_CATEGORIES,
  SEED_CATEGORIES,
  categoryInputSchema,
  categorySchema,
  type Category,
} from '../shared/model'

/** The categories the person sorts habits into. Ids are the collection's: a name can change. */
export const categoriesSpec = defineCollection({
  name: CATEGORIES,
  item: categorySchema,
  input: categoryInputSchema,
  create: (input, { id }) => ({ id, name: input.name }),
  scope: 'app',
  limit: MAX_CATEGORIES,
})

export type Categories = Collection<Category, typeof categoryInputSchema.shape>

const FILE = `${CATEGORIES}.json`

/** Thrown inside the store's queue to leave the file as it is. */
const ALREADY_SEEDED = new Error('The categories were seeded before.')

/**
 * Write the default categories the first time the app runs, never again: a person who deletes them
 * all keeps an empty list. They are written to the collection's own file, with their fixed ids
 * (which `add` cannot give), through the store's own queue: queued here, before `register` returns,
 * every later read of the file waits for it. The file existing is the sign that this was done, so
 * a call that finds it throws to write nothing rather than rewrite the file on every load.
 */
export function seedCategories(ctx: MiniAppContext): void {
  const store = openJsonStore({
    dir: ctx.dataDir,
    file: FILE,
    schema: collectionFileSchema(categorySchema),
    initial: { items: [] as Category[] },
  })
  store
    .update(async () => {
      if (await statIfExists(join(ctx.dataDir, FILE))) throw ALREADY_SEEDED
      return { items: [...SEED_CATEGORIES] }
    })
    .catch((error: unknown) => {
      if (error !== ALREADY_SEEDED) ctx.log(`Could not write the default categories: ${error}`)
    })
}
