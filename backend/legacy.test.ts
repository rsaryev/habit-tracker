import { describe, expect, test } from 'bun:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { MiniAppContext } from '@localixai/mini-app-sdk/backend'
import { callTool, testMiniAppContext } from '@localixai/mini-app-sdk/backend/testing'
import { register } from './index'
import { listed } from './test-helpers'

/** The habits file as the first version wrote it: a fixed `category` on every habit. */
const FIRST_VERSION = [
  { id: 'run', title: 'Run', category: 'health', days: ['2026-10-26', '2026-10-27'] },
  { id: 'rust', title: 'Learn Rust', category: 'learning', days: ['2026-10-27'] },
  { id: 'water', title: 'Drink water', category: 'other', days: [] },
  { id: 'old', title: 'Stretch', days: ['2026-01-02'] },
]

async function storeFirstVersion(ctx: MiniAppContext) {
  await mkdir(ctx.dataDir, { recursive: true })
  await writeFile(join(ctx.dataDir, 'habits.json'), JSON.stringify({ items: FIRST_VERSION }))
}

const storedHabits = async (ctx: MiniAppContext) =>
  (await Bun.file(join(ctx.dataDir, 'habits.json')).json()) as { items: Record<string, unknown>[] }

describe('habits stored by the first version', () => {
  test('all come through with their history, each in the category of its old key', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    await storeFirstVersion(ctx)
    const app = register(ctx)

    expect(await listed(app, 'habits')).toEqual([
      { id: 'run', title: 'Run', categoryId: 'health', days: ['2026-10-26', '2026-10-27'] },
      { id: 'rust', title: 'Learn Rust', categoryId: 'learning', days: ['2026-10-27'] },
      { id: 'water', title: 'Drink water', categoryId: null, days: [] },
      { id: 'old', title: 'Stretch', categoryId: null, days: ['2026-01-02'] },
    ])
    const summary = (await callTool(app, 'habit_tracker_summary', {})).text
    expect(summary).toContain('Run (id run), Health & fitness')
    expect(summary).toContain('Learn Rust (id rust), Learning')
    expect(summary).toContain('Drink water (id water), Uncategorized')
    expect(summary).toContain('Stretch (id old), Uncategorized')
  })

  test('the next change saves them all in the new shape and loses none', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    await storeFirstVersion(ctx)
    const app = register(ctx)

    await callTool(app, 'habit_tracker_set_completion', {
      id: 'water',
      done: true,
      date: '2026-10-28',
    })

    expect((await storedHabits(ctx)).items).toEqual([
      { id: 'run', title: 'Run', categoryId: 'health', days: ['2026-10-26', '2026-10-27'] },
      { id: 'rust', title: 'Learn Rust', categoryId: 'learning', days: ['2026-10-27'] },
      { id: 'water', title: 'Drink water', categoryId: null, days: ['2026-10-28'] },
      { id: 'old', title: 'Stretch', categoryId: null, days: ['2026-01-02'] },
    ])
  })

  test('deleting the category of an old habit leaves the habit, uncategorized', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    await storeFirstVersion(ctx)
    const app = register(ctx)

    await callTool(app, 'habit_tracker_delete_category', { id: 'health' })

    const run = (await listed(app, 'habits')).find((habit) => habit.id === 'run')
    expect(run).toMatchObject({ categoryId: null, days: ['2026-10-26', '2026-10-27'] })
  })
})

describe('the default categories', () => {
  const names = async (app: ReturnType<typeof register>) =>
    (await listed(app, 'categories')).map((category) => category.name)

  test('a new app starts with them', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    expect(await names(register(ctx))).toEqual([
      'Health & fitness',
      'Learning',
      'Wellbeing',
      'Productivity',
      'Relationships',
    ])
  })

  test('are written once: loading the app again keeps what the person changed', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const first = register(ctx)
    await callTool(first, 'habit_tracker_rename_category', { id: 'learning', name: 'Study' })
    await callTool(first, 'habit_tracker_delete_category', { id: 'wellbeing' })

    expect(await names(register(ctx))).toEqual([
      'Health & fitness',
      'Study',
      'Productivity',
      'Relationships',
    ])
  })

  test('do not come back for a person who deleted every category', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    const first = register(ctx)
    for (const { id } of await listed(first, 'categories')) {
      await callTool(first, 'habit_tracker_delete_category', { id })
    }

    expect(await names(register(ctx))).toEqual([])
  })

  test('are not written over habits that already exist', async () => {
    await using ctx = await testMiniAppContext({ name: 'habit-tracker' })
    await storeFirstVersion(ctx)
    register(ctx)
    const app = register(ctx)

    expect((await listed(app, 'habits')).length).toBe(FIRST_VERSION.length)
    expect((await listed(app, 'categories')).length).toBe(5)
  })
})
