import type { DecisionHost, MiniAppRegistration } from '@localixai/mini-app-sdk/backend'
import { requestRoute } from '@localixai/mini-app-sdk/backend/testing'

/** What a test needs of a stored habit or category. */
export interface Item {
  id: string
  [field: string]: unknown
}

/** The list the screen reads from one of the app's collections. */
export async function listed(app: MiniAppRegistration, collection: string): Promise<Item[]> {
  const answer = await requestRoute(app, 'GET', `/${collection}`)
  return (answer.json as { items: Item[] }).items
}

export async function idOf(app: MiniAppRegistration, collection: string, label: string) {
  const items = await listed(app, collection)
  const found = items.find((item) => item.name === label || item.title === label)
  if (!found) throw new Error(`No ${collection} item called ${label}.`)
  return found.id
}

/** A decision model that answers `choice` with some confidence, and remembers what it was asked. */
export function decisionModel(choice: string, confidence = 0.99) {
  const asked: { state: unknown; options: string[]; criteria: Record<string, string> }[] = []
  const decisions: DecisionHost = {
    available: async () => ({ model: 'test' }),
    decide: async (_userId, ask) => {
      const criteria = (ask.questions.answer as { criteria: Record<string, string> }).criteria
      asked.push({ state: ask.state, options: Object.keys(criteria), criteria })
      return {
        status: 'answered',
        model: 'test',
        ms: 1,
        answers: {
          answer: { type: 'choice', choice, probabilities: { [choice]: confidence } },
        },
      }
    },
  }
  return { decisions, asked }
}

/** A decision model that cannot answer, for the reason given. */
export function silentDecisionModel(status: 'unavailable' | 'deadline' | 'failed') {
  const decisions: DecisionHost = {
    available: async () => null,
    decide: async () => ({ status, ms: 1 }),
  }
  return { decisions }
}
