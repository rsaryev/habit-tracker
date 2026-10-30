import type { Categories } from './categories'
import type { Habits } from './habits'

/** The two collections every tool and route works on. */
export interface Stores {
  habits: Habits
  categories: Categories
}
