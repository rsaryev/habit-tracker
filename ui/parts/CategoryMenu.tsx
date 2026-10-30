import { ChevronDown } from 'lucide-react'
import type { MenuEntry } from '@localixai/mini-app-sdk/ui'
import { Button } from '@localixai/kit/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@localixai/kit/dropdown-menu'
import { MenuEntries } from '@localixai/kit/menu-entries'
import { UNCATEGORIZED } from '../../shared/categories'
import type { Category } from '../../shared/model'

/**
 * A habit's category as a quiet trigger that opens the choice: the current answer and a chevron,
 * onto one row per category and a last one for none. A pick is a menu, not a form field.
 */
export function CategoryMenu({
  title,
  categoryId,
  categories,
  disabled,
  onChoose,
}: {
  /** The habit's title, for the trigger's accessible name. */
  title: string
  categoryId: string | null
  categories: readonly Category[]
  disabled: boolean
  onChoose: (categoryId: string | null) => void
}) {
  const current = categories.find((category) => category.id === categoryId)
  const name = current?.name ?? UNCATEGORIZED
  const entries: MenuEntry[] = [
    { header: 'Category' },
    ...categories.map((category) => ({
      id: category.id,
      label: category.name,
      selected: category.id === current?.id,
      onSelect: () => onChoose(category.id),
    })),
    { separator: true },
    {
      id: 'none',
      label: 'No category',
      selected: current === undefined,
      onSelect: () => onChoose(null),
    },
  ]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          aria-label={`Category of ${title}: ${name}. Change`}
          className="max-w-full text-text-soft @lg:max-w-48"
        >
          <span className="min-w-0 truncate">{name}</span>
          <ChevronDown data-icon="inline-end" aria-hidden className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <MenuEntries entries={entries} family="dropdown" />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
