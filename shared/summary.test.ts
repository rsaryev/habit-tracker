import { describe, expect, test } from 'bun:test'
import type { Category, Habit } from './model'
import { describeForAgent, summarize } from './summary'

// Noon local time, so every day key below is the same in any time zone.
const now = new Date(2026, 9, 28, 12)

const learning: Category = { id: 'learning', name: 'Learning' }
const health: Category = { id: 'health', name: 'Health & fitness' }
const habit = (id: string, categoryId: string | null, days: string[] = []): Habit => ({
  id,
  title: `Habit ${id}`,
  days,
  categoryId,
})

describe('the summary the screen and the agent share', () => {
  test('counts today against all habits, once per habit however often a day is repeated', () => {
    const summary = summarize(
      [habit('a', null, ['2026-10-28', '2026-10-28']), habit('b', null)],
      [],
      now,
    )
    expect(summary).toMatchObject({ today: '2026-10-28', done: 1, total: 2, progress: 0.5 })
    expect(summary.week.at(-1)).toEqual({ key: '2026-10-28', value: 1 })
  })

  test('has no progress, and no division by zero, with no habits', () => {
    expect(summarize([], [learning], now)).toMatchObject({ done: 0, total: 0, progress: 0 })
  })

  test('lists the last seven days, oldest first, today last', () => {
    const { week } = summarize([habit('a', null, ['2026-10-22', '2026-10-27'])], [], now)
    expect(week.map((day) => day.key)).toEqual([
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
    ])
    expect(week.map((day) => day.value)).toEqual([1, 0, 0, 0, 0, 1, 0])
  })

  test('groups habits by category and counts them, whatever a habit points at', () => {
    const summary = summarize(
      [habit('a', 'health'), habit('b', 'learning'), habit('c', 'gone'), habit('d', 'health')],
      [learning, health],
      now,
    )
    expect(summary.groups.map((group) => group.category?.id ?? null)).toEqual([
      'learning',
      'health',
      null,
    ])
    expect(summary.categories).toEqual([
      { ...learning, habits: 1 },
      { ...health, habits: 2 },
    ])
    expect(summary.groups.at(-1)?.habits.map((row) => row.categoryId)).toEqual([null])
  })
})

describe('what the agent is told', () => {
  const habits = [
    habit('a', 'learning', ['2026-10-27', '2026-10-28', '2026-01-01']),
    habit('b', null),
  ]
  const text = describeForAgent(summarize(habits, [learning, health], now))

  test('starts with where today stands', () => {
    expect(text.split('\n')[0]).toBe('Today (2026-10-28): 1 of 2 habits done.')
  })

  test('gives each habit its id, category, today and the days it was done this week', () => {
    expect(text).toContain(
      '- Habit a (id a), Learning: done today; this week 2026-10-27, 2026-10-28',
    )
    expect(text).toContain('- Habit b (id b), Uncategorized: not done today; this week none')
    expect(text).not.toContain('2026-01-01')
  })

  test('gives the last seven days and the categories with the ids to use for them', () => {
    expect(text).toContain('Last 7 days (habits done per day): 2026-10-22: 0;')
    expect(text).toContain('2026-10-28: 1')
    expect(text).toContain('- Learning (id learning): 1 habit')
    expect(text).toContain('- Health & fitness (id health): 0 habits')
  })

  test('says so when there is nothing yet', () => {
    const empty = describeForAgent(summarize([], [], now))
    expect(empty).toContain('No habits yet.')
    expect(empty).toContain('No categories yet.')
  })
})
