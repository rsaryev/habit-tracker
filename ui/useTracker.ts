import { useCallback, useMemo, useState } from 'react'
import { useCollection } from '@localixai/mini-app-sdk/ui/app'
import { useNow } from '@localixai/mini-app-sdk/ui/now'
import {
  MiniAppApiError,
  postMiniAppJson,
  unwrapMiniAppResponse,
} from '@localixai/mini-app-sdk/ui/transport'
import { useWorkItemSessionId } from '@localixai/mini-app-sdk/ui/work-item-session'
import {
  APP,
  CATEGORIES,
  HABITS,
  categorySchema,
  habitSchema,
  type Category,
  type CategoryInput,
  type Habit,
  type HabitInput,
} from '../shared/model'
import { summarize, type HabitRow } from '../shared/summary'

/** Why a change failed, in words for the person. */
function explain(error: unknown): string {
  if (!(error instanceof MiniAppApiError)) return 'Cannot reach Localix. Try again.'
  if (error.code === 'name_taken') return 'You already have a category with that name.'
  if (error.code === 'category_not_found') return 'That category no longer exists.'
  if (error.code === 'habit_not_found') return 'That habit no longer exists.'
  return error.message
}

/**
 * Everything the screen shows and does. Reads go through the two collections; the changes that
 * carry a rule go to the app's own routes, the same ones the agent's tools share their rules with.
 * Every change answers with whether it worked, and a failure is kept in `failure`.
 */
export function useTracker(active: boolean) {
  const habits = useCollection<Habit, HabitInput>({
    app: APP,
    name: HABITS,
    item: habitSchema,
    active,
  })
  const categories = useCollection<Category, CategoryInput>({
    app: APP,
    name: CATEGORIES,
    item: categorySchema,
    active,
  })
  // Re-render each minute, so "today" turns over at midnight with the screen open.
  const now = useNow(60_000, active)
  const sessionId = useWorkItemSessionId()
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const { refresh: refreshHabits } = habits
  const { refresh: refreshCategories } = categories

  const summary = useMemo(
    () => summarize(habits.items, categories.items, new Date(now)),
    [habits.items, categories.items, now],
  )

  const send = useCallback(
    async (route: string, body: unknown, query = '') => {
      setSending(true)
      setFailure(null)
      try {
        await unwrapMiniAppResponse(await postMiniAppJson(`/rpc/${APP}/${route}${query}`, body))
        refreshHabits()
        refreshCategories()
        return true
      } catch (error) {
        setFailure(explain(error))
        return false
      } finally {
        setSending(false)
      }
    },
    [refreshHabits, refreshCategories],
  )

  const toggle = (row: HabitRow) =>
    habits.update(row.id, {
      days: row.done
        ? row.days.filter((day) => day !== summary.today)
        : [...row.days, summary.today],
    })

  return {
    summary,
    loading: habits.loading || categories.loading,
    sending: sending || habits.sending || categories.sending,
    failure: failure ?? habits.error ?? categories.error,
    toggle,
    removeHabit: habits.remove,
    /** `categoryId` left out has a category picked for the habit; `null` leaves it with none. */
    addHabit: (title: string, categoryId?: string | null) => {
      const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''
      const body = categoryId === undefined ? { title } : { title, categoryId }
      return send('create-habit', body, query)
    },
    setCategory: (id: string, categoryId: string | null) =>
      send('set-habit-category', { id, categoryId }),
    addCategory: (name: string) => send('create-category', { name }),
    renameCategory: (id: string, name: string) => send('rename-category', { id, name }),
    deleteCategory: (id: string) => send('delete-category', { id }),
  }
}

export type Tracker = ReturnType<typeof useTracker>
