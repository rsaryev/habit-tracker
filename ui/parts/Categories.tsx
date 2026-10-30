import { ConfirmDialog } from '@localixai/kit/confirm-dialog'
import { EmptyHint } from '@localixai/kit/empty-hint'
import { SectionLabel } from '@localixai/kit/section-label'
import type { CategoryRow } from '../../shared/summary'
import { useConfirmation } from '../useConfirmation'
import { AddCategory } from './AddCategory'
import { CategoryItem } from './CategoryItem'
import { RowList } from './RowList'

/** What deleting a category does to the habits in it, in words. */
function consequence(habits: number): string {
  if (habits === 0) return 'No habit is in it.'
  if (habits === 1) return 'The habit in it stays, with no category.'
  return `The ${habits} habits in it stay, with no category.`
}

/**
 * The person's own categories: add, rename, delete. Deleting asks first, and says that the habits
 * in the category are kept.
 */
export function Categories({
  categories,
  busy,
  onAdd,
  onRename,
  onDelete,
}: {
  categories: readonly CategoryRow[]
  busy: boolean
  onAdd: (name: string) => Promise<boolean>
  onRename: (id: string, name: string) => Promise<boolean>
  onDelete: (id: string) => void
}) {
  const deletion = useConfirmation<CategoryRow>()
  return (
    <section aria-label="Categories" className="flex flex-col gap-3">
      <SectionLabel as="h2">Categories</SectionLabel>
      {categories.length === 0 ? (
        <EmptyHint>No categories yet. Add one to sort your habits.</EmptyHint>
      ) : (
        <RowList>
          {categories.map((category) => (
            <CategoryItem
              key={category.id}
              category={category}
              categories={categories}
              busy={busy}
              onRename={(name) => onRename(category.id, name)}
              onDelete={() => deletion.ask(category)}
            />
          ))}
        </RowList>
      )}
      <AddCategory categories={categories} busy={busy} onAdd={onAdd} />
      <ConfirmDialog
        open={deletion.open}
        title={`Delete "${deletion.target?.name ?? ''}"?`}
        description={consequence(deletion.target?.habits ?? 0)}
        confirmLabel="Delete category"
        onConfirm={() => deletion.target && onDelete(deletion.target.id)}
        onClose={deletion.close}
      />
    </section>
  )
}
