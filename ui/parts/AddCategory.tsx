import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@localixai/kit/button'
import { Input } from '@localixai/kit/input'
import { findByName } from '../../shared/categories'
import { categoryNameSchema, type Category } from '../../shared/model'
import { TakenName } from './TakenName'

/** Add a category. A name that is already taken is refused as it is typed. */
export function AddCategory({
  categories,
  busy,
  onAdd,
}: {
  categories: readonly Category[]
  busy: boolean
  onAdd: (name: string) => Promise<boolean>
}) {
  const [name, setName] = useState('')
  const taken = findByName(categories, name)
  const ready = categoryNameSchema.safeParse(name).success && !taken
  return (
    <form
      aria-label="Add a category"
      className="flex flex-col gap-1.5"
      onSubmit={async (event) => {
        event.preventDefault()
        if (ready && !busy && (await onAdd(name.trim()))) setName('')
      }}
    >
      <div className="flex gap-2">
        <Input
          aria-label="New category name"
          aria-invalid={taken ? true : undefined}
          placeholder="For example, Finance"
          value={name}
          maxLength={categoryNameSchema.maxLength ?? undefined}
          onChange={(event) => setName(event.target.value)}
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="secondary" disabled={busy || !ready}>
          <Plus data-icon="inline-start" />
          Add category
        </Button>
      </div>
      {taken && <TakenName name={taken.name} />}
    </form>
  )
}
