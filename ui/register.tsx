import { lazy } from 'react'
import { ListChecks } from 'lucide-react'
import { screenUi } from '@localixai/mini-app-sdk/ui/app'
import { LoadingHint } from '@localixai/kit/empty-hint'
import { APP } from '../shared/model'

const App = lazy(() => import('./App').then((module) => ({ default: module.App })))

/**
 * The screen's registration: its tab, its launcher in the rail's overflow, and what the agent is
 * told while it is open. Each chat has its own tab, because a habit added here asks the decision
 * model for its category on behalf of that chat.
 */
export const registerUi = screenUi({
  app: APP,
  scope: 'chat',
  title: 'Habit Tracker',
  label: 'Habit Tracker — daily habits, their progress and categories',
  keywords: ['habits', 'tracker', 'daily', 'routine', 'streak', 'categories'],
  Icon: ListChecks,
  Screen: App,
  loading: <LoadingHint>Opening Habit Tracker…</LoadingHint>,
  agentContext: {
    description:
      'Daily habits, which are done today, the last seven days and the categories they are in.',
    tools: [
      'habit_tracker_summary',
      'habit_tracker_create_habit',
      'habit_tracker_set_completion',
      'habit_tracker_remove_habit',
      'habit_tracker_set_category',
      'habit_tracker_list_categories',
      'habit_tracker_create_category',
      'habit_tracker_rename_category',
      'habit_tracker_delete_category',
    ],
    nextSteps: [
      'Add a habit with habit_tracker_create_habit; leave out the category unless one is named.',
      'To mark, move or remove a habit, take its id from the published summary.',
      'Delete a habit or a category only when the person asks: a habit goes with its history.',
      'Answer questions about progress from the published summary.',
    ],
  },
})
