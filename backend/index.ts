import {
  createMiniApp,
  type MiniAppContext,
  type MiniAppRegistration,
} from '@localixai/mini-app-sdk/backend'
import { categoriesSpec, seedCategories } from './categories'
import { habitsSpec } from './habits'
import { appRoutes } from './routes'
import { createTools } from './tools'

/**
 * The backend: two collections (habits and the categories they are sorted into), the agent's tools
 * and the routes of the changes that carry a rule. `register(ctx)` runs more than once, so the
 * state lives in the collections and nothing is kept here.
 */
export function register(ctx: MiniAppContext): MiniAppRegistration {
  const app = createMiniApp(ctx)
  const stores = {
    habits: app.collection(habitsSpec),
    categories: app.collection(categoriesSpec),
  }
  seedCategories(ctx)
  return app.registration({ tools: createTools(ctx, stores), routes: appRoutes(ctx, stores) })
}
