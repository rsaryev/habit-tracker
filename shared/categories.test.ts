import { describe, expect, test } from 'bun:test'
import { categoryOf, findByName, groupByCategory } from './categories'
import type { Category, Habit } from './model'

const learning: Category = { id: 'learning', name: 'Learning' }
const health: Category = { id: 'health', name: 'Health & fitness' }
const habit = (id: string, categoryId: string | null): Habit => ({
  id,
  title: id,
  days: [],
  categoryId,
})

describe('finding a category by name', () => {
  test('ignores case and surrounding spaces', () => {
    expect(findByName([learning, health], '  LEARNING ')).toBe(learning)
    expect(findByName([learning, health], 'Sleep')).toBeUndefined()
  })

  test('can leave one category out, so a rename to a different case of itself is allowed', () => {
    expect(findByName([learning, health], 'learning', 'learning')).toBeUndefined()
    expect(findByName([learning, health], 'health & fitness', 'learning')).toBe(health)
  })
})

describe('the category of a habit', () => {
  test('is the one it points at', () => {
    expect(categoryOf(habit('a', 'health'), [learning, health])).toBe(health)
  })

  test('is none when it points at nothing, or at a category that is gone', () => {
    expect(categoryOf(habit('a', null), [learning, health])).toBeNull()
    expect(categoryOf(habit('a', 'deleted'), [learning, health])).toBeNull()
  })
})

describe('grouping habits by category', () => {
  const habits = [
    habit('a', 'health'),
    habit('b', null),
    habit('c', 'learning'),
    habit('d', 'gone'),
  ]

  test('follows the category order, keeps the habit order, and puts uncategorized last', () => {
    const groups = groupByCategory(habits, [learning, health])
    expect(groups.map((group) => group.category)).toEqual([learning, health, null])
    expect(groups.map((group) => group.habits.map((item) => item.id))).toEqual([
      ['c'],
      ['a'],
      ['b', 'd'],
    ])
  })

  test('leaves out a category with no habits, and has no group for no habits', () => {
    expect(groupByCategory([habit('a', 'health')], [learning, health]).length).toBe(1)
    expect(groupByCategory([], [learning, health])).toEqual([])
  })
})
