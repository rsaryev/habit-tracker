import type { AgentTool, MiniAppContext } from '@localixai/mini-app-sdk/backend'
import { dateSchema, habitInputSchema } from '../shared/model'
import { dayKey, describeForAgent, type Summary } from '../shared/summary'
import { setHabitCategory } from './category-actions'
import { describeChoice } from './category-choice'
import { addHabit } from './habit-actions'
import { habitNotFound } from './outcome'
import type { Stores } from './stores'
import { deletes, reads, refused, writes } from './tool-kinds'

/**
 * The agent's tools for habits. Each write answers with what changed and where things stand, so the
 * agent can tell the person in one line. `view` reads the current summary.
 */
export function habitTools(
  ctx: MiniAppContext,
  stores: Stores,
  view: () => Promise<Summary>,
): AgentTool[] {
  const { z } = ctx
  const { habits } = stores
  const standing = async () => describeForAgent(await view())
  const habitId = z.string().min(1).describe('The habit’s id, from habit_tracker_summary.')

  return [
    ctx.defineTool({
      name: 'habit_tracker_summary',
      label: 'Show habits',
      activeVerb: 'Reading habits',
      description:
        'Show today’s progress, each habit with id and category, the last 7 days, the categories.',
      inputSchema: z.object({}),
      ...reads,
      async execute() {
        return { content: await standing() }
      },
    }),
    ctx.defineTool({
      name: 'habit_tracker_create_habit',
      label: 'Add habit',
      activeVerb: 'Adding a habit',
      description:
        'Add a daily habit. Name its category by id, or leave it out to have one picked.',
      inputSchema: habitInputSchema.pick({ title: true, categoryId: true }).extend({
        title: habitInputSchema.shape.title.describe('The habit, as the person would name it.'),
        categoryId: habitInputSchema.shape.categoryId.describe(
          'The id of its category, or null for none. Leave out to have one picked.',
        ),
      }),
      ...writes,
      async execute(_toolCallId, input, _signal, _update, context) {
        const result = await addHabit(ctx, stores, input, context?.session?.id)
        if (!result.ok) return refused(result)
        const { habit, category, choice, hasCategories } = result.value
        const hint =
          choice.by === 'fallback' && hasCategories
            ? ' If a category fits, set it with habit_tracker_set_category.'
            : ''
        const saved = `Added the habit "${habit.title}".`
        const placed = `Category: ${describeChoice(category, choice)}.`
        return { content: `${saved} ${placed}${hint}\n${await standing()}` }
      },
    }),
    ctx.defineTool({
      name: 'habit_tracker_set_completion',
      label: 'Mark habit',
      activeVerb: 'Updating a habit',
      description:
        'Mark a habit done for a day, or take the mark back. Today when no day is given.',
      inputSchema: z.object({
        id: habitId,
        done: z.boolean().describe('true to mark it done, false to take the mark back.'),
        date: dateSchema.optional().describe('The day, YYYY-MM-DD. Today when left out.'),
      }),
      ...writes,
      async execute(_toolCallId, { id, done, date = dayKey(new Date()) }) {
        const habit = await habits.get(id)
        if (!habit) return refused(habitNotFound(id))
        const days = habit.days.filter((day) => day !== date)
        await habits.update(id, { days: done ? [...days, date] : days })
        const change = done ? `is done for ${date}` : `is no longer marked done for ${date}`
        return { content: `"${habit.title}" ${change}.\n${await standing()}` }
      },
    }),
    ctx.defineTool({
      name: 'habit_tracker_set_category',
      label: 'Set habit category',
      activeVerb: 'Changing a category',
      description: 'Put a habit in a category, or in none. Its history is kept.',
      inputSchema: z.object({
        id: habitId,
        categoryId: z
          .string()
          .min(1)
          .nullable()
          .describe(
            'The id of the category, from habit_tracker_list_categories, or null for none.',
          ),
      }),
      ...writes,
      async execute(_toolCallId, { id, categoryId }) {
        const set = await setHabitCategory(stores, id, categoryId)
        if (!set.ok) return refused(set)
        const { habit, category } = set.value
        const where = category ? `in the category ${category.name}` : 'uncategorized'
        return { content: `"${habit.title}" is now ${where}.\n${await standing()}` }
      },
    }),
    ctx.defineTool({
      name: 'habit_tracker_remove_habit',
      label: 'Remove habit',
      activeVerb: 'Removing a habit',
      description:
        'Remove a habit and all its history. Only when the person asks; it cannot be undone.',
      inputSchema: z.object({ id: habitId }),
      ...deletes,
      async execute(_toolCallId, { id }) {
        const habit = await habits.get(id)
        if (!habit || !(await habits.remove(id))) return refused(habitNotFound(id))
        return {
          content: `Removed the habit "${habit.title}" and its history.\n${await standing()}`,
        }
      },
    }),
  ]
}
