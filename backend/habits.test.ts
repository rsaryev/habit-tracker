import { describe, expect, test } from 'bun:test'
import { callTool, requestRoute, testMiniAppContext } from '@localixai/mini-app-sdk/backend/testing'
import { register } from './index'
import { idOf, listed } from './test-helpers'

const day = (offset = 0) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, '0'))
    .join('-')
}

describe('habits', () => {
  test('what the agent adds shows on the screen, and the other way round', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const app = register(ctx)

    const created = await callTool(app, 'habit_tracker_create_habit', { title: 'Read' })
    expect(created.isError).toBe(false)
    expect(created.text).toContain('Added the habit "Read".')
    await requestRoute(app, 'POST', '/create-habit', { title: 'Drink water' })

    expect((await listed(app, 'habits')).map((habit) => habit.title)).toEqual([
      'Read',
      'Drink water',
    ])
    expect((await callTool(app, 'habit_tracker_summary', {})).text).toContain(
      'Today (' + day() + '): 0 of 2 habits done.',
    )
  })

  test('the agent marks one done, and takes the mark back, by the id it was shown', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const app = register(ctx)
    await callTool(app, 'habit_tracker_create_habit', { title: 'Read' })
    await callTool(app, 'habit_tracker_create_habit', { title: 'Run' })
    const id = await idOf(app, 'habits', 'Read')

    const done = await callTool(app, 'habit_tracker_set_completion', { id, done: true })
    expect(done.text).toContain('"Read" is done for ' + day() + '.')
    expect(done.text).toContain('Today (' + day() + '): 1 of 2 habits done.')

    const undone = await callTool(app, 'habit_tracker_set_completion', { id, done: false })
    expect(undone.text).toContain('Today (' + day() + '): 0 of 2 habits done.')
    expect(await callTool(app, 'habit_tracker_set_completion', { id: 'nope', done: true })).toEqual(
      { text: expect.stringContaining('No habit has the id nope.'), isError: true },
    )
  })

  test('a day can be marked for a past date, once however often it is marked', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const app = register(ctx)
    await callTool(app, 'habit_tracker_create_habit', { title: 'Read' })
    const id = await idOf(app, 'habits', 'Read')

    await callTool(app, 'habit_tracker_set_completion', { id, done: true, date: day(-1) })
    await callTool(app, 'habit_tracker_set_completion', { id, done: true, date: day(-1) })

    expect(await listed(app, 'habits')).toEqual([expect.objectContaining({ days: [day(-1)] })])
    await expect(
      callTool(app, 'habit_tracker_set_completion', { id, done: true, date: '2026-02-31' }),
    ).rejects.toThrow()
  })

  test('the agent removes one with its history, and is told when it is gone', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const app = register(ctx)
    await callTool(app, 'habit_tracker_create_habit', { title: 'Read' })
    const id = await idOf(app, 'habits', 'Read')

    expect((await callTool(app, 'habit_tracker_remove_habit', { id })).text).toContain(
      'Removed the habit "Read" and its history.',
    )
    expect(await callTool(app, 'habit_tracker_remove_habit', { id })).toEqual({
      text: expect.stringContaining('No habit has the id'),
      isError: true,
    })
    expect(await listed(app, 'habits')).toEqual([])
  })

  test('the agent is shown the limits the app keeps', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const app = register(ctx)
    const accepts = (input: unknown) =>
      app.tools
        ?.find((tool) => tool.name === 'habit_tracker_create_habit')
        ?.inputSchema?.safeParse(input).success

    expect(accepts({ title: 'Read' })).toBe(true)
    expect(accepts({ title: 'x'.repeat(121) })).toBe(false)
    expect(accepts({ title: '   ' })).toBe(false)
  })
})

describe('a habit’s category', () => {
  test('the agent sets it by id, and the days are kept', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const app = register(ctx)
    await callTool(app, 'habit_tracker_create_habit', { title: 'Read', categoryId: null })
    const id = await idOf(app, 'habits', 'Read')
    await callTool(app, 'habit_tracker_set_completion', { id, done: true, date: day(-1) })

    const set = await callTool(app, 'habit_tracker_set_category', { id, categoryId: 'learning' })

    expect(set.text).toContain('"Read" is now in the category Learning.')
    expect(await listed(app, 'habits')).toEqual([
      expect.objectContaining({ categoryId: 'learning', days: [day(-1)] }),
    ])
  })

  test('the agent clears it with null', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const app = register(ctx)
    await callTool(app, 'habit_tracker_create_habit', { title: 'Read', categoryId: 'learning' })
    const id = await idOf(app, 'habits', 'Read')

    const cleared = await callTool(app, 'habit_tracker_set_category', { id, categoryId: null })

    expect(cleared.text).toContain('"Read" is now uncategorized.')
    expect(await listed(app, 'habits')).toEqual([expect.objectContaining({ categoryId: null })])
  })

  test('is refused for a category or habit that does not exist, and nothing changes', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const app = register(ctx)
    await callTool(app, 'habit_tracker_create_habit', { title: 'Read', categoryId: 'learning' })
    const id = await idOf(app, 'habits', 'Read')

    expect(await callTool(app, 'habit_tracker_set_category', { id, categoryId: 'nope' })).toEqual({
      text: expect.stringContaining('No category has the id nope.'),
      isError: true,
    })
    expect(
      await callTool(app, 'habit_tracker_set_category', { id: 'nope', categoryId: 'learning' }),
    ).toEqual({ text: expect.stringContaining('No habit has the id nope.'), isError: true })
    expect(await listed(app, 'habits')).toEqual([
      expect.objectContaining({ categoryId: 'learning' }),
    ])
  })

  test('the screen sets it, and is refused a category that is gone', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const app = register(ctx)
    await callTool(app, 'habit_tracker_create_habit', { title: 'Read', categoryId: null })
    const id = await idOf(app, 'habits', 'Read')

    const set = await requestRoute(app, 'POST', '/set-habit-category', { id, categoryId: 'health' })
    expect(set.status).toBe(200)
    expect(await listed(app, 'habits')).toEqual([expect.objectContaining({ categoryId: 'health' })])

    const gone = await requestRoute(app, 'POST', '/set-habit-category', { id, categoryId: 'nope' })
    expect(gone.status).toBe(404)
    const cleared = await requestRoute(app, 'POST', '/set-habit-category', { id, categoryId: null })
    expect(cleared.status).toBe(200)
    expect(await listed(app, 'habits')).toEqual([expect.objectContaining({ categoryId: null })])
  })

  test('marking a day keeps the category, and the screen’s own changes do too', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const app = register(ctx)
    await callTool(app, 'habit_tracker_create_habit', { title: 'Read', categoryId: 'learning' })
    const id = await idOf(app, 'habits', 'Read')

    await callTool(app, 'habit_tracker_set_completion', { id, done: true, date: day() })
    await requestRoute(app, 'PATCH', `/habits/${id}`, { days: [day(), day(-1)] })

    expect(await listed(app, 'habits')).toEqual([
      expect.objectContaining({ categoryId: 'learning', days: [day(), day(-1)] }),
    ])
    await requestRoute(app, 'PATCH', `/habits/${id}`, { categoryId: 'health' })
    expect(await listed(app, 'habits')).toEqual([
      expect.objectContaining({ categoryId: 'health', days: [day(), day(-1)] }),
    ])
  })
})
