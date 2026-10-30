/**
 * What a change to the app's data comes to, told the same way to the agent's tools and to the
 * screen's routes: it worked and here is the result, or it was refused and here is why — with the
 * HTTP status the screen's route answers with and a code the screen can tell apart.
 */
export interface Refusal {
  ok: false
  status: 400 | 404 | 409
  code: string
  message: string
}

export type Outcome<T> = { ok: true; value: T } | Refusal

export const done = <T>(value: T): Outcome<T> => ({ ok: true, value })

export const refuse = (status: Refusal['status'], code: string, message: string): Refusal => ({
  ok: false,
  status,
  code,
  message,
})

export const categoryNotFound = (id: string) =>
  refuse(404, 'category_not_found', `No category has the id ${id}.`)

export const habitNotFound = (id: string) =>
  refuse(404, 'habit_not_found', `No habit has the id ${id}.`)
