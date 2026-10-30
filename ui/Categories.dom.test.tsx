import { describe, expect, test } from 'bun:test'
import type { Category, Habit } from '../shared/model'
import { renderApp, useDom } from './test-harness'

useDom()

const categories: Category[] = [
  { id: 'health', name: 'Health & fitness' },
  { id: 'learning', name: 'Learning' },
]
const habit = (id: string, categoryId: string | null): Habit => ({
  id,
  title: id,
  categoryId,
  days: [],
})
const habits = [habit('run', 'health'), habit('rust', 'learning'), habit('go', 'learning')]

const rows = (section: HTMLElement) =>
  [...section.querySelectorAll('li')].map((li) => li.textContent)

describe('the categories on the screen', () => {
  test('lists each with how many habits are in it', async () => {
    const screen = await renderApp({ categories, habits })
    try {
      expect(rows(screen.named('Categories'))).toEqual([
        expect.stringContaining('Health & fitness1 habit'),
        expect.stringContaining('Learning2 habits'),
      ])
    } finally {
      await screen.unmount()
    }
  })

  test('with none, says what they are for and how to add one', async () => {
    const screen = await renderApp({ categories: [], habits: [] })
    try {
      expect(screen.named('Categories').textContent).toContain('No categories yet')
      expect(screen.named('Add a category')).toBeDefined()
    } finally {
      await screen.unmount()
    }
  })
})

describe('adding a category', () => {
  test('sends the name without its surrounding spaces, and shows the new category', async () => {
    const screen = await renderApp({ categories, habits })
    try {
      await screen.type(screen.named('New category name'), '  Finance ')
      await screen.submit(screen.named('Add a category'))

      expect(screen.backend.calls).toEqual([
        { method: 'POST', route: '/create-category', body: { name: 'Finance' } },
      ])
      expect(rows(screen.named('Categories')).at(-1)).toContain('Finance0 habits')
      expect((screen.named('New category name') as HTMLInputElement).value).toBe('')
    } finally {
      await screen.unmount()
    }
  })

  test('is refused a name that is taken, in any case, before anything is sent', async () => {
    const screen = await renderApp({ categories, habits })
    try {
      await screen.type(screen.named('New category name'), ' learning')

      expect(screen.named('Categories').textContent).toContain(
        'You already have a category called "Learning".',
      )
      expect(screen.withText('Add category').hasAttribute('disabled')).toBe(true)
      await screen.submit(screen.named('Add a category'))
      expect(screen.backend.calls).toEqual([])
    } finally {
      await screen.unmount()
    }
  })

  test('is not offered without a name', async () => {
    const screen = await renderApp({ categories, habits })
    try {
      expect(screen.withText('Add category').hasAttribute('disabled')).toBe(true)
      await screen.type(screen.named('New category name'), '   ')
      expect(screen.withText('Add category').hasAttribute('disabled')).toBe(true)
    } finally {
      await screen.unmount()
    }
  })
})

describe('renaming a category', () => {
  test('sends the new name and shows it, with the habits still in it', async () => {
    const screen = await renderApp({ categories, habits })
    try {
      await screen.click(screen.named('Rename Learning'))
      const field = screen.named('Category name') as HTMLInputElement
      expect(field.value).toBe('Learning')
      await screen.type(field, 'Study')
      await screen.click(screen.named('Save name'))

      expect(screen.backend.calls).toEqual([
        { method: 'POST', route: '/rename-category', body: { id: 'learning', name: 'Study' } },
      ])
      expect(rows(screen.named('Categories'))[1]).toContain('Study2 habits')
    } finally {
      await screen.unmount()
    }
  })

  test('is cancelled with Escape, and sends nothing', async () => {
    const screen = await renderApp({ categories, habits })
    try {
      await screen.click(screen.named('Rename Learning'))
      await screen.type(screen.named('Category name'), 'Study')
      await screen.press(screen.named('Category name'), 'Escape')

      expect(screen.backend.calls).toEqual([])
      expect(screen.find('[aria-label="Category name"]')).toBeUndefined()
      expect(rows(screen.named('Categories'))[1]).toContain('Learning')
    } finally {
      await screen.unmount()
    }
  })

  test('is refused the name of another category, but may change the case of its own', async () => {
    const screen = await renderApp({ categories, habits })
    try {
      await screen.click(screen.named('Rename Learning'))
      await screen.type(screen.named('Category name'), 'health & fitness')
      expect(screen.named('Categories').textContent).toContain(
        'You already have a category called "Health & fitness".',
      )
      expect(screen.named('Save name').hasAttribute('disabled')).toBe(true)

      await screen.type(screen.named('Category name'), 'LEARNING')
      expect(screen.named('Save name').hasAttribute('disabled')).toBe(false)
    } finally {
      await screen.unmount()
    }
  })
})

describe('deleting a category', () => {
  test('asks first, and says its habits stay', async () => {
    const screen = await renderApp({ categories, habits })
    try {
      await screen.click(screen.named('Delete Learning'))
      expect(screen.text()).toContain('Delete "Learning"?')
      expect(screen.text()).toContain('The 2 habits in it stay, with no category.')

      await screen.click(screen.withText('Cancel'))
      expect(screen.backend.calls).toEqual([])
      expect(screen.named('Categories').textContent).toContain('Learning')
    } finally {
      await screen.unmount()
    }
  })

  test('removes the category and leaves its habits on the screen, uncategorized', async () => {
    const screen = await renderApp({ categories, habits })
    try {
      await screen.click(screen.named('Delete Learning'))
      await screen.click(screen.withText('Delete category'))

      expect(screen.backend.calls).toEqual([
        { method: 'POST', route: '/delete-category', body: { id: 'learning' } },
      ])
      expect(rows(screen.named('Categories')).length).toBe(1)
      const headings = [...document.body.querySelectorAll('h3')].map((h) => h.textContent)
      expect(headings).toEqual(['Health & fitness1', 'Uncategorized2'])
    } finally {
      await screen.unmount()
    }
  })

  test('says so when no habit is in it', async () => {
    const screen = await renderApp({ categories, habits: [] })
    try {
      await screen.click(screen.named('Delete Learning'))
      expect(screen.text()).toContain('No habit is in it.')
    } finally {
      await screen.unmount()
    }
  })
})
