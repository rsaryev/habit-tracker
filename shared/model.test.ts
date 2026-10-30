import { describe, expect, test } from 'bun:test'
import {
  SEED_CATEGORIES,
  categoryInputSchema,
  dateSchema,
  habitInputSchema,
  habitSchema,
} from './model'

describe('a habit stored by the first version', () => {
  const stored = (category?: string) => ({
    id: 'h',
    title: 'Read',
    days: ['2026-10-27'],
    ...(category === undefined ? {} : { category }),
  })

  test.each(SEED_CATEGORIES.map((category) => category.id))(
    'keeps its days and moves "%s" onto the category of that id',
    (key) => {
      expect(habitSchema.parse(stored(key))).toEqual({
        id: 'h',
        title: 'Read',
        days: ['2026-10-27'],
        categoryId: key,
      })
    },
  )

  test('"other", an unknown key and no category at all read as uncategorized', () => {
    expect(habitSchema.parse(stored('other')).categoryId).toBeNull()
    expect(habitSchema.parse(stored('gardening')).categoryId).toBeNull()
    expect(habitSchema.parse(stored()).categoryId).toBeNull()
  })

  test('reads the same once migrated, so every later write keeps it', () => {
    const migrated = habitSchema.parse(stored('learning'))
    expect(habitSchema.parse(migrated)).toEqual(migrated)
    expect(habitSchema.parse({ ...migrated, days: [] }).categoryId).toBe('learning')
  })

  test('a category the person cleared stays cleared', () => {
    const cleared = habitSchema.parse({ ...habitSchema.parse(stored('health')), categoryId: null })
    expect(cleared.categoryId).toBeNull()
    expect(habitSchema.parse(cleared).categoryId).toBeNull()
  })

  test('keeps a title and a history as long as the first version allowed', () => {
    const days = Array.from({ length: 10000 }, (_, index) =>
      new Date(Date.UTC(2000, 0, 1 + index)).toISOString().slice(0, 10),
    )
    expect(habitSchema.safeParse({ id: 'h', title: 'x'.repeat(120), days }).success).toBe(true)
  })
})

describe('a change to a habit', () => {
  test('names only what it changes, so it never resets the rest', () => {
    expect(habitInputSchema.partial().parse({ categoryId: 'learning' })).toEqual({
      categoryId: 'learning',
    })
    expect(habitInputSchema.partial().parse({ days: ['2026-10-28'] })).toEqual({
      days: ['2026-10-28'],
    })
    expect(habitInputSchema.partial().parse({ categoryId: null })).toEqual({ categoryId: null })
  })
})

describe('a category name', () => {
  test('is trimmed and cannot be empty or long', () => {
    expect(categoryInputSchema.parse({ name: '  Reading  ' })).toEqual({ name: 'Reading' })
    expect(categoryInputSchema.safeParse({ name: '   ' }).success).toBe(false)
    expect(categoryInputSchema.safeParse({ name: 'x'.repeat(41) }).success).toBe(false)
  })
})

test('a date must exist', () => {
  expect(dateSchema.safeParse('2026-02-31').success).toBe(false)
  expect(dateSchema.safeParse('2024-02-29').success).toBe(true)
})
