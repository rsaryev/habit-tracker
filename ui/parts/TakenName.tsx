/** Why a category name is refused: another category already has it. */
export function TakenName({ name }: { name: string }) {
  return (
    <p role="alert" className="text-xs text-status-error">
      You already have a category called "{name}".
    </p>
  )
}
