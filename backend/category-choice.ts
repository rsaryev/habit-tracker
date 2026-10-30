import { decide, type MiniAppContext } from '@localixai/mini-app-sdk/backend'
import { UNCATEGORIZED } from '../shared/categories'
import type { Category } from '../shared/model'

/** The option that stands for "none of the categories", beside the id of each category. */
const NONE = 'none'

/**
 * How a habit got its category. `given`: the person or the agent named it. `model`: the decision
 * model picked it (or said none fits). `fallback`: nothing could pick, and `reason` says why.
 */
export interface CategoryChoice {
  categoryId: string | null
  by: 'given' | 'model' | 'fallback'
  reason?: string
}

// Keyed by string: a newer Localix names reasons (like 'no-host') this kit's types do not yet.
const MISSES: Record<string, string> = {
  'no-host': 'no decision model is available',
  unavailable: 'no decision model is available',
  deadline: 'the decision model took too long',
  cancelled: 'the decision model could not answer',
  failed: 'the decision model could not answer',
  unsure: 'the decision model was not sure',
}

const unchosen = (reason: string): CategoryChoice => ({ categoryId: null, by: 'fallback', reason })

/**
 * Ask the decision model which of the current `categories` fits a habit. Without an answer —
 * nothing to choose from, no chat to bill, no model, not sure — the habit is uncategorized and the
 * reason is kept, so the agent can choose for itself.
 */
export async function chooseCategory(
  ctx: MiniAppContext,
  categories: readonly Category[],
  title: string,
  sessionId?: string,
): Promise<CategoryChoice> {
  if (categories.length === 0) return unchosen('there are no categories yet')
  if (!sessionId) return unchosen('there is no chat to ask from')
  try {
    const options: Record<string, string> = Object.fromEntries(
      categories.map((category) => [category.id, category.name]),
    )
    options[NONE] = 'None of these categories fits'
    const answer = await decide(ctx, {
      userId: ctx.userId,
      sessionId,
      purpose: 'habit-category',
      state: { title },
      question: 'Which category fits this habit best? Answer "none" when no category fits.',
      options,
      fallback: NONE,
    })
    if (answer.by === 'fallback') return unchosen(MISSES[answer.reason] ?? MISSES.failed)
    return { categoryId: answer.pick === NONE ? null : answer.pick, by: 'model' }
  } catch {
    return unchosen(MISSES.failed)
  }
}

/** How the agent is told where a habit went: the category and, unless it was named, how. */
export function describeChoice(category: Category | null, choice: CategoryChoice): string {
  const name = category?.name ?? UNCATEGORIZED
  if (choice.by === 'given') return name
  if (choice.by === 'model')
    return category ? `${name} (picked by the decision model)` : `${name} (no category fits)`
  return `${name} (${choice.reason})`
}
