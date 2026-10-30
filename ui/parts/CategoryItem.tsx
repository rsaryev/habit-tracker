import { useEffect, useRef, useState } from 'react'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import { IconButton } from '@localixai/kit/icon-button'
import { Input } from '@localixai/kit/input'
import { findByName } from '../../shared/categories'
import { categoryNameSchema, type Category } from '../../shared/model'
import { countHabits, type CategoryRow } from '../../shared/summary'
import { TakenName } from './TakenName'

/** The name of a category being renamed: Enter saves, Escape leaves it as it was. */
function RenameForm({
  category,
  categories,
  busy,
  onRename,
  onDone,
}: {
  category: Category
  categories: readonly Category[]
  busy: boolean
  onRename: (name: string) => Promise<boolean>
  onDone: () => void
}) {
  const [name, setName] = useState(category.name)
  const field = useRef<HTMLInputElement>(null)
  useEffect(() => field.current?.focus(), [])
  // Another category's name is taken; a different case of this one's own is not.
  const taken = findByName(categories, name, category.id)
  const ready = categoryNameSchema.safeParse(name).success && !taken
  return (
    <form
      aria-label="Rename category"
      className="flex flex-col gap-1.5"
      onSubmit={async (event) => {
        event.preventDefault()
        if (ready && !busy && (await onRename(name.trim()))) onDone()
      }}
    >
      <div className="flex items-center gap-2">
        <Input
          ref={field}
          aria-label="Category name"
          aria-invalid={taken ? true : undefined}
          value={name}
          maxLength={categoryNameSchema.maxLength ?? undefined}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => event.key === 'Escape' && onDone()}
          className="min-w-0 flex-1"
        />
        <IconButton
          aria-label="Save name"
          tooltip="Save"
          type="submit"
          size="sm"
          disabled={busy || !ready}
        >
          <Check />
        </IconButton>
        <IconButton aria-label="Cancel renaming" tooltip="Cancel" size="sm" onClick={onDone}>
          <X />
        </IconButton>
      </div>
      {taken && <TakenName name={taken.name} />}
    </form>
  )
}

/** One category: its name and how many habits are in it, to rename or delete. */
export function CategoryItem({
  category,
  categories,
  busy,
  onRename,
  onDelete,
}: {
  category: CategoryRow
  categories: readonly Category[]
  busy: boolean
  onRename: (name: string) => Promise<boolean>
  onDelete: () => void
}) {
  const [renaming, setRenaming] = useState(false)
  if (renaming) {
    return (
      <li className="px-3 py-2">
        <RenameForm
          category={category}
          categories={categories}
          busy={busy}
          onRename={onRename}
          onDone={() => setRenaming(false)}
        />
      </li>
    )
  }
  return (
    <li className="flex items-center gap-2 px-3 py-2">
      <p className="min-w-0 flex-1 truncate text-sm text-foreground">{category.name}</p>
      <span className="shrink-0 text-xs tabular-nums text-text-faint">
        {countHabits(category.habits)}
      </span>
      <IconButton
        aria-label={`Rename ${category.name}`}
        tooltip="Rename"
        size="sm"
        disabled={busy}
        onClick={() => setRenaming(true)}
      >
        <Pencil />
      </IconButton>
      <IconButton
        aria-label={`Delete ${category.name}`}
        tooltip="Delete category"
        size="sm"
        tone="danger"
        disabled={busy}
        onClick={onDelete}
      >
        <Trash2 />
      </IconButton>
    </li>
  )
}
