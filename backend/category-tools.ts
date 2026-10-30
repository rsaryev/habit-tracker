import type { AgentTool, MiniAppContext } from '@localixai/mini-app-sdk/backend'
import { categoryInputSchema } from '../shared/model'
import { describeCategories, describeForAgent, type Summary } from '../shared/summary'
import { addCategory, deleteCategory, renameCategory } from './category-actions'
import type { Stores } from './stores'
import { deletes, reads, refused, writes } from './tool-kinds'

const habitCount = (count: number) => `${count} ${count === 1 ? 'habit is' : 'habits are'}`

/** The agent's tools for categories, with the same rules as the screen's. */
export function categoryTools(
  ctx: MiniAppContext,
  stores: Stores,
  view: () => Promise<Summary>,
): AgentTool[] {
  const { z } = ctx
  const standing = async () => describeForAgent(await view())
  const categoryId = z
    .string()
    .min(1)
    .describe('The category’s id, from habit_tracker_list_categories.')
  const name = categoryInputSchema.shape.name

  return [
    ctx.defineTool({
      name: 'habit_tracker_list_categories',
      label: 'List categories',
      activeVerb: 'Reading categories',
      description: 'List the categories with their ids and how many habits are in each.',
      inputSchema: z.object({}),
      ...reads,
      async execute() {
        const { categories } = await view()
        const none = ' Add one with habit_tracker_create_category.'
        return { content: describeCategories(categories) + (categories.length ? '' : none) }
      },
    }),
    ctx.defineTool({
      name: 'habit_tracker_create_category',
      label: 'Add category',
      activeVerb: 'Adding a category',
      description: 'Add a category for habits. Names are unique, ignoring case.',
      inputSchema: categoryInputSchema.extend({
        name: name.describe('The category’s name, up to 40 characters.'),
      }),
      ...writes,
      async execute(_toolCallId, input) {
        const added = await addCategory(stores, input.name)
        if (!added.ok) return refused(added)
        return { content: `Added the category "${added.value.name}".\n${await standing()}` }
      },
    }),
    ctx.defineTool({
      name: 'habit_tracker_rename_category',
      label: 'Rename category',
      activeVerb: 'Renaming a category',
      description: 'Rename a category. Its habits stay in it.',
      inputSchema: z.object({
        id: categoryId,
        name: name.describe('The new name, up to 40 characters.'),
      }),
      ...writes,
      async execute(_toolCallId, input) {
        const renamed = await renameCategory(stores, input.id, input.name)
        if (!renamed.ok) return refused(renamed)
        const { before, after } = renamed.value
        const change = `Renamed the category "${before.name}" to "${after.name}".`
        return { content: `${change}\n${await standing()}` }
      },
    }),
    ctx.defineTool({
      name: 'habit_tracker_delete_category',
      label: 'Delete category',
      activeVerb: 'Deleting a category',
      description:
        'Delete a category; its habits are kept, with no category. Only when the person asks.',
      inputSchema: z.object({ id: categoryId }),
      ...deletes,
      async execute(_toolCallId, input) {
        const deleted = await deleteCategory(stores, input.id)
        if (!deleted.ok) return refused(deleted)
        const { category, unlinked } = deleted.value
        const left = unlinked ? ` ${habitCount(unlinked)} now uncategorized.` : ''
        return { content: `Deleted the category "${category.name}".${left}\n${await standing()}` }
      },
    }),
  ]
}
