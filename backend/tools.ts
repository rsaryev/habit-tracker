import type { AgentTool, MiniAppContext } from '@localixai/mini-app-sdk/backend'
import { summarize } from '../shared/summary'
import { categoryTools } from './category-tools'
import { habitTools } from './habit-tools'
import type { Stores } from './stores'

/** Everything the agent can do on the screen, as tools. */
export function createTools(ctx: MiniAppContext, stores: Stores): AgentTool[] {
  const view = async () =>
    summarize(await stores.habits.list(), await stores.categories.list(), new Date())
  return [...habitTools(ctx, stores, view), ...categoryTools(ctx, stores, view)]
}
