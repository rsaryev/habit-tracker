import { describe, expect, test } from 'bun:test'
import type { Category, Habit } from '../shared/model'
import { localDay, renderApp, useDom } from './test-harness'

useDom()

const categories: Category[] = [
  { id: 'health', name: 'Health & fitness' },
  { id: 'learning', name: 'Learning' },
  { id: 'wellbeing', name: 'Wellbeing' },
]
const habit = (
  id: string,
  title: string,
  categoryId: string | null,
  days: string[] = [],
): Habit => ({
  id,
  title,
  categoryId,
  days,
})

describe('the habits on the screen', () => {
  test('shows progress and habits under their categories, and tells the agent too', async () => {
    const screen = await renderApp({
      categories,
      habits: [
        habit('run', 'Run', 'health', [localDay()]),
        habit('rust', 'Learn Rust', 'learning'),
        habit('water', 'Drink water', null),
      ],
    })
    try {
      expect(screen.text()).toContain('Habit Tracker')
      expect(screen.named('1 of 3 habits done')).toBeDefined()
      const headings = [...document.body.querySelectorAll('h3')].map((h) => h.textContent)
      expect(headings).toEqual(['Health & fitness1', 'Learning1', 'Uncategorized1'])
      expect(screen.text()).toContain('Learn Rust')
      expect(screen.text()).toContain('Done today')
      expect(screen.published()).toContain(`Today (${localDay()}): 1 of 3 habits done.`)
      expect(screen.published()).toContain('Learn Rust (id rust), Learning')
    } finally {
      await screen.unmount()
    }
  })

  test('with no categories, lists the habits without headings for them', async () => {
    const screen = await renderApp({ categories: [], habits: [habit('run', 'Run', null)] })
    try {
      expect(screen.text()).toContain('Run')
      expect(document.body.querySelectorAll('h3').length).toBe(0)
      expect(screen.text()).toContain('No categories yet')
    } finally {
      await screen.unmount()
    }
  })

  test('with no habits, says how to add one', async () => {
    const screen = await renderApp({ categories, habits: [] })
    try {
      expect(screen.text()).toContain('No habits yet')
      expect(screen.text()).toContain('ask in the chat')
      expect(screen.named('0 of 0 habits done')).toBeDefined()
    } finally {
      await screen.unmount()
    }
  })

  test('marking one done sends only its days, and shows it done', async () => {
    const screen = await renderApp({
      categories,
      habits: [habit('run', 'Run', 'health', ['2026-01-02'])],
    })
    try {
      await screen.click(screen.named('Mark Run done'))

      expect(screen.backend.calls).toEqual([
        { method: 'PATCH', route: '/habits/run', body: { days: ['2026-01-02', localDay()] } },
      ])
      expect(screen.text()).toContain('Done today')
      await screen.click(screen.named('Mark Run not done'))
      expect(screen.backend.calls.at(-1)?.body).toEqual({ days: ['2026-01-02'] })
    } finally {
      await screen.unmount()
    }
  })

  test('deleting one asks first, and says its history goes with it', async () => {
    const screen = await renderApp({ categories, habits: [habit('run', 'Run', 'health')] })
    try {
      await screen.click(screen.named('Delete Run'))
      expect(screen.text()).toContain('Delete "Run"?')
      expect(screen.text()).toContain('its history')

      await screen.click(screen.withText('Cancel'))
      expect(screen.backend.calls).toEqual([])
      expect(screen.text()).toContain('Run')

      await screen.click(screen.named('Delete Run'))
      await screen.click(screen.withText('Delete habit'))
      expect(screen.backend.calls.map(({ method, route }) => ({ method, route }))).toEqual([
        { method: 'DELETE', route: '/habits/run' },
      ])
      expect(screen.text()).not.toContain('Delete "Run"?')
      expect(screen.text()).toContain('No habits yet')
    } finally {
      await screen.unmount()
    }
  })
})

describe('adding a habit', () => {
  test('leaves its category to be picked, unless one is chosen', async () => {
    const screen = await renderApp({ categories, habits: [] })
    try {
      await screen.type(screen.named('Habit name'), '  Read 10 minutes ')
      await screen.submit(screen.named('Add a habit'))

      expect(screen.backend.calls).toEqual([
        { method: 'POST', route: '/create-habit', body: { title: 'Read 10 minutes' } },
      ])
      expect(screen.text()).toContain('Read 10 minutes')
      expect((screen.named('Habit name') as HTMLInputElement).value).toBe('')
    } finally {
      await screen.unmount()
    }
  })

  test('puts it in the category chosen, or in none', async () => {
    const screen = await renderApp({ categories, habits: [] })
    try {
      await screen.type(screen.named('Habit name'), 'Read')
      await screen.open(screen.named('Category for the new habit'))
      await screen.click(screen.withText('Learning'))
      await screen.submit(screen.named('Add a habit'))

      await screen.type(screen.named('Habit name'), 'Stretch')
      await screen.open(screen.named('Category for the new habit'))
      await screen.click(screen.withText('No category'))
      await screen.submit(screen.named('Add a habit'))

      expect(screen.backend.calls.map((call) => call.body)).toEqual([
        { title: 'Read', categoryId: 'learning' },
        { title: 'Stretch', categoryId: null },
      ])
    } finally {
      await screen.unmount()
    }
  })

  test('is not offered without a name', async () => {
    const screen = await renderApp({ categories, habits: [] })
    try {
      expect(screen.withText('Add habit').hasAttribute('disabled')).toBe(true)
      await screen.type(screen.named('Habit name'), '   ')
      expect(screen.withText('Add habit').hasAttribute('disabled')).toBe(true)
    } finally {
      await screen.unmount()
    }
  })

  test('has no category to choose when there are none', async () => {
    const screen = await renderApp({ categories: [], habits: [] })
    try {
      expect(screen.find('[aria-label="Category for the new habit"]')).toBeUndefined()
    } finally {
      await screen.unmount()
    }
  })
})

describe('a habit’s category', () => {
  test('is changed from its row, to another category or to none', async () => {
    const screen = await renderApp({ categories, habits: [habit('run', 'Run', 'health')] })
    try {
      const trigger = screen.named('Category of Run: Health & fitness. Change')
      await screen.open(trigger)
      await screen.click(screen.withText('Wellbeing'))
      expect(screen.backend.calls.at(-1)).toEqual({
        method: 'POST',
        route: '/set-habit-category',
        body: { id: 'run', categoryId: 'wellbeing' },
      })
      expect(document.body.querySelectorAll('h3')[0]?.textContent).toBe('Wellbeing1')

      await screen.open(screen.named('Category of Run: Wellbeing. Change'))
      await screen.click(screen.withText('No category'))
      expect(screen.backend.calls.at(-1)?.body).toEqual({ id: 'run', categoryId: null })
      expect(document.body.querySelectorAll('h3')[0]?.textContent).toBe('Uncategorized1')
    } finally {
      await screen.unmount()
    }
  })

  test('shows why a change was refused', async () => {
    const screen = await renderApp({ categories, habits: [habit('run', 'Run', 'health')] })
    try {
      screen.backend.refuse(
        '/set-habit-category',
        404,
        'category_not_found',
        'No category has the id wellbeing.',
      )
      await screen.open(screen.named('Category of Run: Health & fitness. Change'))
      await screen.click(screen.withText('Wellbeing'))

      expect(screen.text()).toContain('That category no longer exists.')
    } finally {
      await screen.unmount()
    }
  })
})
