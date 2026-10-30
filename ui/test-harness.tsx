import { afterAll, beforeAll } from 'bun:test'
import { registerDom } from '@localixai/kit/testing'
import type { PublishedMessageContext } from '@localixai/mini-app-sdk/ui'
import { bindMiniAppUiTestDoubles } from '@localixai/mini-app-sdk/ui/testing'
import { bindMiniAppUiTransport } from '@localixai/mini-app-sdk/ui/transport'
import type { Category, Habit } from '../shared/model'

/** A browser for the tests of this file, and the host's stand-ins the screen draws through. */
export function useDom() {
  const react = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  const before = react.IS_REACT_ACT_ENVIRONMENT
  let teardown: () => Promise<void>
  let unbindDoubles: () => void
  beforeAll(() => {
    teardown = registerDom()
    unbindDoubles = bindMiniAppUiTestDoubles()
    react.IS_REACT_ACT_ENVIRONMENT = true
  })
  afterAll(async () => {
    unbindDoubles()
    await teardown()
    if (before === undefined) delete react.IS_REACT_ACT_ENVIRONMENT
    else react.IS_REACT_ACT_ENVIRONMENT = before
  })
}

/**
 * A stand-in for the app's backend, enough for the screen to be driven: it answers the lists the
 * screen reads and applies each change the screen sends, so what the person sees afterwards is
 * what the screen made of the answers. The rules (unique names, who is unlinked) are the
 * backend's own and tested there; `refuse` scripts an answer for a test of how a refusal shows.
 */
export interface Call {
  method: string
  route: string
  body: unknown
}

export function fakeBackend(initial: { habits: Habit[]; categories: Category[] }) {
  let habits = [...initial.habits]
  let categories = [...initial.categories]
  const calls: Call[] = []
  const refusals = new Map<string, { status: number; code: string; message: string }>()
  let created = 0

  const change = (route: string, body: Record<string, unknown>) => {
    const id = String(body.id ?? '')
    if (route === '/create-habit') {
      habits.push({
        id: `new-${++created}`,
        days: [],
        categoryId: null,
        ...(body as { title: string }),
      })
    } else if (route === '/set-habit-category') {
      habits = habits.map((h) =>
        h.id === id ? { ...h, categoryId: body.categoryId as string } : h,
      )
    } else if (route === '/create-category') {
      categories.push({ id: `cat-${++created}`, name: String(body.name) })
    } else if (route === '/rename-category') {
      categories = categories.map((c) => (c.id === id ? { ...c, name: String(body.name) } : c))
    } else if (route === '/delete-category') {
      categories = categories.filter((c) => c.id !== id)
      habits = habits.map((h) => (h.categoryId === id ? { ...h, categoryId: null } : h))
    }
  }

  const unbind = bindMiniAppUiTransport({
    url: (path) => path,
    request: async (path, init) => {
      const method = init?.method ?? 'GET'
      const route = path.replace('/rpc/habit-tracker', '').split('?')[0]!
      const body = init?.body ? JSON.parse(String(init.body)) : undefined
      if (method === 'GET') {
        return Response.json({ items: route === '/habits' ? habits : categories })
      }
      calls.push({ method, route, body })
      const refusal = refusals.get(route)
      if (refusal) {
        const { status, code, message } = refusal
        return Response.json({ error: { code, message } }, { status })
      }
      const item = route.match(/^\/habits\/(.+)$/)?.[1]
      if (method === 'PATCH' && item) {
        habits = habits.map((h) => (h.id === item ? { ...h, ...body } : h))
      } else if (method === 'DELETE' && item) {
        habits = habits.filter((h) => h.id !== item)
      } else {
        change(route, body)
      }
      return Response.json(method === 'POST' ? {} : { items: habits })
    },
  })
  return {
    calls,
    unbind,
    refuse: (route: string, status: number, code: string, message: string) =>
      refusals.set(route, { status, code, message }),
  }
}

/** Let the requests a change started finish and the screen draw their answers. */
async function settle(act: (callback: () => Promise<void>) => Promise<void>) {
  for (let turn = 0; turn < 10; turn++) {
    await act(async () => {
      await new Promise((resolve) => setImmediate(resolve))
    })
  }
}

/** The screen, rendered against a fake backend, with what a person does to it. */
export async function renderApp(initial: { habits: Habit[]; categories: Category[] }) {
  const { act } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { App } = await import('./App')
  const backend = fakeBackend(initial)
  const contexts: (PublishedMessageContext | null)[] = []
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () =>
    root.render(<App active publishMessageContext={(context) => contexts.push(context)} />),
  )
  await settle(act)

  const text = () => document.body.textContent ?? ''
  const find = <T extends HTMLElement>(selector: string) =>
    document.body.querySelector<T>(selector) ?? undefined
  const need = <T extends HTMLElement>(selector: string) => {
    const element = find<T>(selector)
    if (!element) throw new Error(`The screen shows nothing matching ${selector}.`)
    return element
  }
  /** The control or region with this name (not the anchor of a disabled control's tooltip). */
  const named = (label: string) => {
    const matches = document.body.querySelectorAll<HTMLElement>(
      `[aria-label="${label.replaceAll('"', '\\"')}"]:not([data-disabled-tooltip-anchor])`,
    )
    if (!matches[0]) throw new Error(`The screen shows nothing named "${label}".`)
    return matches[0]
  }
  const withText = (words: string, selector = 'button, [role^="menuitem"], [role="option"]') => {
    const found = [...document.body.querySelectorAll<HTMLElement>(selector)].find(
      (element) => element.textContent?.trim() === words,
    )
    if (!found) throw new Error(`The screen shows no ${selector} saying "${words}".`)
    return found
  }
  const run = async (action: () => void) => {
    await act(async () => action())
    await settle(act)
  }

  return {
    backend,
    contexts,
    text,
    find,
    named,
    withText,
    /** The latest context the screen gave the agent. */
    published: () =>
      contexts.findLast((context) => context !== null)?.bindings[0]?.target.attributes?.content,
    click: (element: HTMLElement) => run(() => element.click()),
    /** Open a menu or list the way a pointer does. */
    open: (trigger: HTMLElement) =>
      run(() =>
        trigger.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }),
        ),
      ),
    type: (input: HTMLElement, value: string) =>
      run(() => {
        const field = input as HTMLInputElement
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
          field,
          value,
        )
        field.dispatchEvent(new Event('input', { bubbles: true }))
      }),
    press: (element: HTMLElement, key: string) =>
      run(() => {
        element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      }),
    submit: (form: HTMLElement) => run(() => (form as HTMLFormElement).requestSubmit()),
    unmount: async () => {
      await act(async () => root.unmount())
      container.remove()
      backend.unbind()
    },
  }
}

export type Screen = Awaited<ReturnType<typeof renderApp>>

/** A date as the screen keys its days: local, `YYYY-MM-DD`. */
export function localDay(offset = 0): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, '0'))
    .join('-')
}
