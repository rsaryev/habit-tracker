import { describe, expect, test } from 'bun:test'
import { callTool, requestRoute, testMiniAppContext } from '@localixai/mini-app-sdk/backend/testing'
import { register } from './index'
import { decisionModel, listed, silentDecisionModel } from './test-helpers'

const SEEDED = ['health', 'learning', 'wellbeing', 'productivity', 'relationships']

describe('a new habit with a category given', () => {
  test('is put in it without asking the decision model', async () => {
    const { decisions, asked } = decisionModel('health')
    await using ctx = await testMiniAppContext({ name: 'habit-tracker', host: { decisions } })
    const app = register(ctx)

    const created = await callTool(app, 'habit_tracker_create_habit', {
      title: 'Read',
      categoryId: 'learning',
    })

    expect(created.text).toContain('Added the habit "Read". Category: Learning.')
    expect(await listed(app, 'habits')).toEqual([
      expect.objectContaining({ categoryId: 'learning' }),
    ])
    expect(asked).toEqual([])
  })

  test('can be given none, which skips the decision model too', async () => {
    const { decisions, asked } = decisionModel('health')
    await using ctx = await testMiniAppContext({ name: 'habit-tracker', host: { decisions } })
    const app = register(ctx)

    const created = await callTool(app, 'habit_tracker_create_habit', {
      title: 'Read',
      categoryId: null,
    })

    expect(created.text).toContain('Category: Uncategorized.')
    expect(asked).toEqual([])
  })

  test('is refused when the category does not exist, and nothing is added', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const app = register(ctx)

    const refused = await callTool(app, 'habit_tracker_create_habit', {
      title: 'Read',
      categoryId: 'nope',
    })
    const refusedByScreen = await requestRoute(app, 'POST', '/create-habit', {
      title: 'Read',
      categoryId: 'nope',
    })

    expect(refused).toEqual({
      text: expect.stringContaining('No category has the id nope.'),
      isError: true,
    })
    expect(refusedByScreen.status).toBe(404)
    expect(await listed(app, 'habits')).toEqual([])
  })
})

describe('a new habit with no category given', () => {
  test('is put by the decision model in one of the categories there are now', async () => {
    const { decisions, asked } = decisionModel('learning')
    await using ctx = await testMiniAppContext({ name: 'habit-tracker', host: { decisions } })
    const app = register(ctx)
    await callTool(app, 'habit_tracker_delete_category', { id: 'wellbeing' })
    await callTool(app, 'habit_tracker_rename_category', { id: 'learning', name: 'Study' })
    await callTool(app, 'habit_tracker_create_category', { name: 'Finance' })

    const created = await callTool(app, 'habit_tracker_create_habit', { title: 'Learn Rust' })

    expect(created.text).toContain('Category: Study (picked by the decision model).')
    expect(await listed(app, 'habits')).toEqual([
      expect.objectContaining({ categoryId: 'learning' }),
    ])
    const [question] = asked
    expect(question?.state).toEqual({ title: 'Learn Rust' })
    expect(Object.values(question?.criteria ?? {})).toEqual([
      'Health & fitness',
      'Study',
      'Productivity',
      'Relationships',
      'Finance',
      'None of these categories fits',
    ])
  })

  test('is uncategorized when the model says none fits', async () => {
    const { decisions } = decisionModel('none')
    await using ctx = await testMiniAppContext({ name: 'habit-tracker', host: { decisions } })
    const app = register(ctx)

    const created = await callTool(app, 'habit_tracker_create_habit', { title: 'Feed the cat' })

    expect(created.text).toContain('Category: Uncategorized (no category fits).')
    expect(await listed(app, 'habits')).toEqual([expect.objectContaining({ categoryId: null })])
  })

  test.each([
    ['unavailable', 'no decision model is available'],
    ['deadline', 'the decision model took too long'],
    ['failed', 'the decision model could not answer'],
  ] as const)('is uncategorized, with the reason, when the model is %s', async (status, reason) => {
    const { decisions } = silentDecisionModel(status)
    await using ctx = await testMiniAppContext({ name: 'habit-tracker', host: { decisions } })
    const app = register(ctx)

    const created = await callTool(app, 'habit_tracker_create_habit', { title: 'Read' })

    expect(created.text).toContain(`Category: Uncategorized (${reason}).`)
    expect(created.text).toContain('habit_tracker_set_category')
    expect(await listed(app, 'habits')).toEqual([expect.objectContaining({ categoryId: null })])
  })

  test('is uncategorized when the model is not sure', async () => {
    const { decisions } = decisionModel('learning', 0.4)
    await using ctx = await testMiniAppContext({ name: 'habit-tracker', host: { decisions } })
    const app = register(ctx)

    const created = await callTool(app, 'habit_tracker_create_habit', { title: 'Read' })

    expect(created.text).toContain('Category: Uncategorized (the decision model was not sure).')
  })

  test('is uncategorized when there is no host to ask', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const app = register(ctx)

    const created = await callTool(app, 'habit_tracker_create_habit', { title: 'Read' })

    expect(created.text).toContain('Category: Uncategorized (no decision model is available).')
  })

  test('is not put to the model when there are no categories to choose from', async () => {
    const { decisions, asked } = decisionModel('learning')
    await using ctx = await testMiniAppContext({ name: 'habit-tracker', host: { decisions } })
    const app = register(ctx)
    for (const id of SEEDED) await callTool(app, 'habit_tracker_delete_category', { id })

    const created = await callTool(app, 'habit_tracker_create_habit', { title: 'Read' })

    expect(created.text).toContain('Category: Uncategorized (there are no categories yet).')
    expect(created.text).not.toContain('habit_tracker_set_category')
    expect(asked).toEqual([])
  })
})

describe('a habit added on the screen', () => {
  test('is put in the category chosen, or by the model when none is', async () => {
    const { decisions } = decisionModel('wellbeing')
    await using ctx = await testMiniAppContext({ name: 'habit-tracker', host: { decisions } })
    const app = register(ctx)

    const chosen = await requestRoute(
      app,
      'POST',
      '/create-habit',
      { title: 'Read', categoryId: 'learning' },
      { sessionId: 'chat-1' },
    )
    const picked = await requestRoute(
      app,
      'POST',
      '/create-habit',
      { title: 'Meditate' },
      { sessionId: 'chat-1' },
    )

    expect(chosen.json).toMatchObject({
      habit: { title: 'Read', categoryId: 'learning' },
      decision: { by: 'given' },
    })
    expect(picked.json).toMatchObject({
      habit: { title: 'Meditate', categoryId: 'wellbeing' },
      decision: { by: 'model' },
    })
  })

  test('is uncategorized, saying why, when it is added outside a chat', async () => {
    const { decisions, asked } = decisionModel('wellbeing')
    await using ctx = await testMiniAppContext({ name: 'habit-tracker', host: { decisions } })
    const app = register(ctx)

    const created = await requestRoute(app, 'POST', '/create-habit', { title: 'Meditate' })

    expect(created.status).toBe(200)
    expect(created.json).toMatchObject({
      habit: { categoryId: null },
      decision: { by: 'fallback', reason: 'there is no chat to ask from' },
    })
    expect(asked).toEqual([])
  })
})
