import { describe, expect, test } from 'bun:test'
import type { MiniAppContext } from '@localixai/mini-app-sdk/backend'
import { callTool, requestRoute, testMiniAppContext } from '@localixai/mini-app-sdk/backend/testing'
import { register } from './index'
import { idOf, listed } from './test-helpers'

/** The app with one habit, "Read", in the Learning category. */
async function appWithHabit(ctx: MiniAppContext) {
  const app = register(ctx)
  await callTool(app, 'habit_tracker_create_habit', { title: 'Read', categoryId: 'learning' })
  return app
}

describe('the agent adds a category', () => {
  test('and the screen lists it, with the id the agent needs next', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const app = register(ctx)

    const added = await callTool(app, 'habit_tracker_create_category', { name: '  Finance ' })

    expect(added.isError).toBe(false)
    expect(added.text).toContain('Added the category "Finance".')
    const id = await idOf(app, 'categories', 'Finance')
    expect(added.text).toContain(`- Finance (id ${id}): 0 habits`)
  })

  test('unless the name is taken, in any case, or is blank', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const app = register(ctx)

    const taken = await callTool(app, 'habit_tracker_create_category', { name: ' LEARNING ' })
    expect(taken).toEqual({
      text: expect.stringContaining('A category named "Learning" already exists (id learning).'),
      isError: true,
    })
    await expect(callTool(app, 'habit_tracker_create_category', { name: '   ' })).rejects.toThrow(
      'Name the category.',
    )
    expect((await listed(app, 'categories')).length).toBe(5)
  })
})

describe('the agent renames a category', () => {
  test('and the habits in it follow', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const app = await appWithHabit(ctx)

    const renamed = await callTool(app, 'habit_tracker_rename_category', {
      id: 'learning',
      name: ' Study ',
    })

    expect(renamed.text).toContain('Renamed the category "Learning" to "Study".')
    expect((await callTool(app, 'habit_tracker_summary', {})).text).toMatch(
      /- Read \(id [^)]+\), Study: /,
    )
  })

  test('to another case of its own name, but not to the name of another category', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const app = register(ctx)

    const recased = await callTool(app, 'habit_tracker_rename_category', {
      id: 'learning',
      name: 'LEARNING',
    })
    expect(recased.isError).toBe(false)
    const clash = await callTool(app, 'habit_tracker_rename_category', {
      id: 'learning',
      name: 'wellbeing',
    })
    expect(clash.isError).toBe(true)
    expect(clash.text).toContain('A category named "Wellbeing" already exists (id wellbeing).')
    expect(await listed(app, 'categories')).toContainEqual({ id: 'learning', name: 'LEARNING' })
  })

  test('only one that exists', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const app = register(ctx)

    expect(
      await callTool(app, 'habit_tracker_rename_category', { id: 'nope', name: 'Sleep' }),
    ).toEqual({ text: expect.stringContaining('No category has the id nope.'), isError: true })
  })
})

describe('the agent deletes a category', () => {
  test('and its habits stay, uncategorized, with their history', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const app = await appWithHabit(ctx)
    await callTool(app, 'habit_tracker_set_completion', {
      id: await idOf(app, 'habits', 'Read'),
      done: true,
      date: '2026-10-27',
    })

    const deleted = await callTool(app, 'habit_tracker_delete_category', { id: 'learning' })

    expect(deleted.isError).toBe(false)
    expect(deleted.text).toContain('Deleted the category "Learning". 1 habit is now uncategorized.')
    expect(await listed(app, 'habits')).toEqual([
      expect.objectContaining({ title: 'Read', categoryId: null, days: ['2026-10-27'] }),
    ])
    expect((await listed(app, 'categories')).map((category) => category.id)).not.toContain(
      'learning',
    )
  })

  test('only one that exists', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const app = register(ctx)

    expect(await callTool(app, 'habit_tracker_delete_category', { id: 'nope' })).toEqual({
      text: expect.stringContaining('No category has the id nope.'),
      isError: true,
    })
  })

  test('removed by any other route, its habits still read as uncategorized', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const app = await appWithHabit(ctx)

    await requestRoute(app, 'DELETE', '/categories/learning')

    expect((await callTool(app, 'habit_tracker_summary', {})).text).toMatch(
      /- Read \(id [^)]+\), Uncategorized: /,
    )
  })
})

describe('the agent lists the categories', () => {
  test('with their ids and how many habits are in each', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const app = await appWithHabit(ctx)

    const list = await callTool(app, 'habit_tracker_list_categories', {})

    expect(list.text).toContain('- Learning (id learning): 1 habit')
    expect(list.text).toContain('- Health & fitness (id health): 0 habits')
  })

  test('and is told what to do when there are none', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const app = register(ctx)
    for (const { id } of await listed(app, 'categories')) {
      await callTool(app, 'habit_tracker_delete_category', { id })
    }

    expect((await callTool(app, 'habit_tracker_list_categories', {})).text).toContain(
      'No categories yet. Add one with habit_tracker_create_category.',
    )
  })

  test('without changing anything', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const tool = register(ctx).tools?.find((t) => t.name === 'habit_tracker_list_categories')
    expect(tool).toMatchObject({ mutates: false, executionMode: 'parallel' })
    expect(tool?.classify?.({})).toMatchObject({ effect: 'read' })
  })
})

describe('the screen manages categories', () => {
  test('adds one, and is refused a name that is taken', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const app = register(ctx)

    const added = await requestRoute(app, 'POST', '/create-category', { name: ' Sleep ' })
    expect(added.status).toBe(200)
    expect(added.json).toMatchObject({ category: { name: 'Sleep' } })

    const { id } = (added.json as { category: { id: string } }).category
    const taken = await requestRoute(app, 'POST', '/create-category', { name: 'sleep' })
    expect(taken.status).toBe(409)
    expect(taken.json).toMatchObject({
      error: {
        code: 'name_taken',
        message: `A category named "Sleep" already exists (id ${id}).`,
      },
    })
    expect((await listed(app, 'categories')).length).toBe(6)
  })

  test('is refused a blank name', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const app = register(ctx)

    expect((await requestRoute(app, 'POST', '/create-category', { name: '  ' })).status).toBe(400)
  })

  test('renames one, and is told when it is gone or the name is taken', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const app = register(ctx)

    const renamed = await requestRoute(app, 'POST', '/rename-category', {
      id: 'learning',
      name: 'Study',
    })
    expect(renamed.status).toBe(200)
    expect((await listed(app, 'categories')).map((c) => c.name)).toContain('Study')
    const taken = await requestRoute(app, 'POST', '/rename-category', {
      id: 'learning',
      name: 'wellbeing',
    })
    expect(taken.status).toBe(409)
    const gone = await requestRoute(app, 'POST', '/rename-category', { id: 'nope', name: 'Sleep' })
    expect(gone.status).toBe(404)
  })

  test('deletes one and leaves its habits uncategorized', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const app = await appWithHabit(ctx)

    const deleted = await requestRoute(app, 'POST', '/delete-category', { id: 'learning' })

    expect(deleted.status).toBe(200)
    expect(deleted.json).toMatchObject({ category: { id: 'learning' }, unlinked: 1 })
    expect(await listed(app, 'habits')).toEqual([
      expect.objectContaining({ title: 'Read', categoryId: null }),
    ])
    expect((await requestRoute(app, 'POST', '/delete-category', { id: 'learning' })).status).toBe(
      404,
    )
  })
})
