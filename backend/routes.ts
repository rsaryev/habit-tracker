import { Hono, type Context } from 'hono'
import { z } from 'zod'
import {
  jsonBody,
  jsonError,
  type MiniAppContext,
  type MiniAppRouteContext,
} from '@localixai/mini-app-sdk/backend'
import { categoryInputSchema, habitInputSchema } from '../shared/model'
import { addCategory, deleteCategory, renameCategory, setHabitCategory } from './category-actions'
import { addHabit } from './habit-actions'
import type { Outcome } from './outcome'
import type { Stores } from './stores'

const id = z.string().min(1)
const newHabit = habitInputSchema.pick({ title: true, categoryId: true })
const renamedCategory = categoryInputSchema.extend({ id })
const habitInCategory = z.object({ id, categoryId: z.string().min(1).nullable() })

/** Answer with what a change came to, or with why it was refused. */
function reply<T>(c: Context, outcome: Outcome<T>, body: (value: T) => object) {
  if (outcome.ok) return c.json(body(outcome.value))
  return jsonError(c, outcome.status, outcome.code, outcome.message)
}

/**
 * The screen's changes that carry a rule. They sit beside the collections' own routes, which accept
 * any name and know nothing of the habits in a category: the screen reads those and writes through
 * these, the same way the agent's tools do.
 */
export function appRoutes(ctx: MiniAppContext, stores: Stores) {
  return new Hono<MiniAppRouteContext>()
    .post('/create-habit', jsonBody(newHabit), async (c) =>
      reply(c, await addHabit(ctx, stores, c.req.valid('json'), c.env.sessionId), (added) => ({
        habit: added.habit,
        category: added.category,
        decision: { by: added.choice.by, reason: added.choice.reason },
      })),
    )
    .post('/set-habit-category', jsonBody(habitInCategory), async (c) => {
      const { id, categoryId } = c.req.valid('json')
      return reply(c, await setHabitCategory(stores, id, categoryId), ({ habit }) => ({ habit }))
    })
    .post('/create-category', jsonBody(categoryInputSchema), async (c) =>
      reply(c, await addCategory(stores, c.req.valid('json').name), (category) => ({ category })),
    )
    .post('/rename-category', jsonBody(renamedCategory), async (c) => {
      const { id, name } = c.req.valid('json')
      return reply(c, await renameCategory(stores, id, name), ({ after }) => ({ category: after }))
    })
    .post('/delete-category', jsonBody(z.object({ id })), async (c) =>
      reply(c, await deleteCategory(stores, c.req.valid('json').id), (deleted) => deleted),
    )
}
