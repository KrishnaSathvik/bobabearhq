import { useEffect, useRef, type ReactNode } from 'react'
import { Check } from 'lucide-react'

// Mobile answers questions with a sheet that rises from the thumb, not with a
// page you have to navigate back out of. On a desktop the same markup settles
// into a small centred panel — one component, because the filter, the type
// picker and the more-menu are all the same question in different words.
export function BottomSheet({ title, onClose, children }: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Focus moves into the sheet so the first option is one key away, and
    // Escape closes it the way every other overlay on a laptop closes.
    panel.current?.querySelector<HTMLElement>('button, [href], input, select')?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="sheet-scrim" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={panel}>
        <div className="sheet-grip" aria-hidden="true" />
        <p className="sheet-title">{title}</p>
        {children}
      </div>
    </div>
  )
}

// One row of a sheet. A tick marks the current answer rather than a highlighted
// pill, because the sheet is a list of choices, not a row of buttons.
export function SheetOption({ selected, onClick, children, danger = false }: {
  selected?: boolean
  onClick: () => void
  children: ReactNode
  danger?: boolean
}) {
  return (
    <button type="button" className={['sheet-option', selected ? 'selected' : '', danger ? 'danger' : ''].filter(Boolean).join(' ')}
      aria-checked={selected} role="menuitemradio" onClick={onClick}>
      <span className="sheet-tick" aria-hidden="true">{selected && <Check size={16} strokeWidth={2} />}</span>
      <span>{children}</span>
    </button>
  )
}
