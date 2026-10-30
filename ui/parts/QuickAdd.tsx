import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@localixai/kit/button'
import { Input } from '@localixai/kit/input'
import { Select } from '@localixai/kit/select'
import type { Category } from '../../shared/model'

// The two choices that are not a category. Ids never look like these.
const PICK_FOR_ME = 'auto'
const NO_CATEGORY = 'none'

/**
 * Add a habit by hand. Beside the name, a choice of category: by default Localix picks one, which
 * is what the agent does too. The form clears only when the habit was added, so a refused one keeps
 * what the person typed.
 */
export function QuickAdd({
  categories,
  busy,
  onAdd,
}: {
  categories: readonly Category[]
  busy: boolean
  /** `categoryId` left out has one picked; `null` leaves the habit with none. */
  onAdd: (title: string, categoryId?: string | null) => Promise<boolean>
}) {
  const [title, setTitle] = useState('')
  const [chosen, setChosen] = useState(PICK_FOR_ME)
  // A category deleted since it was chosen is no longer a choice.
  const stillThere = chosen === NO_CATEGORY || categories.some((category) => category.id === chosen)
  const choice = stillThere ? chosen : PICK_FOR_ME
  const ready = title.trim() !== ''
  const options = [
    { value: PICK_FOR_ME, label: 'Pick a category for me' },
    ...categories.map((category) => ({ value: category.id, label: category.name })),
    { value: NO_CATEGORY, label: 'No category' },
  ]

  const add = async () => {
    const categoryId = choice === PICK_FOR_ME ? undefined : choice === NO_CATEGORY ? null : choice
    if (await onAdd(title.trim(), categoryId)) setTitle('')
  }
  return (
    <form
      aria-label="Add a habit"
      className="flex flex-wrap gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (ready && !busy) void add()
      }}
    >
      <Input
        aria-label="Habit name"
        placeholder="For example, read for 10 minutes"
        value={title}
        maxLength={120}
        onChange={(event) => setTitle(event.target.value)}
        className="min-w-0 flex-1 basis-48"
      />
      {categories.length > 0 && (
        <Select
          aria-label="Category for the new habit"
          size="md"
          value={choice}
          options={options}
          onValueChange={setChosen}
          className="w-48"
        />
      )}
      <Button type="submit" variant="secondary" disabled={busy || !ready}>
        <Plus data-icon="inline-start" />
        Add habit
      </Button>
    </form>
  )
}
