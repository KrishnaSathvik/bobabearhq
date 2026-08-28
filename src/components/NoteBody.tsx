import { Check } from 'lucide-react'
import { isTodo, parseBody, segments, toggleTodoLine } from '../lib/richText'

// A link in the writing is pressable, and pressing it opens the page rather
// than the editor — so the click is stopped here before it reaches the block
// behind it, which is listening for "tap the writing to write in it".
function Written({ text }: { text: string }) {
  const parts = segments(text)
  if (parts.length === 1 && !parts[0].url) return <>{text}</>
  return <>{parts.map((part, index) => part.url
    ? <a className="body-link" key={index} href={part.url} target="_blank" rel="noreferrer"
      onClick={event => event.stopPropagation()}>{part.text}</a>
    : <span key={index}>{part.text}</span>)}</>
}

// Reading what was written. A note with no markers in it is one block of text
// you tap to edit, exactly as before — the whole point of keeping the writing a
// string is that nothing changes for the notes that are only writing.
//
// A note that does carry boxes gets real ones: tapping a box saves immediately,
// the way ticking anything else in the app does, and tapping the words opens
// the writing. Two targets on one line, and the box is the smaller one, so the
// common act — reading and ticking — never opens an editor by accident.
export function NoteBody({ body, lead, onEdit, onChange }: {
  body: string
  // A captured note whose title is its own first words reads as the heading.
  lead: boolean
  onEdit: () => void
  onChange: (body: string) => Promise<void>
}) {
  const lines = parseBody(body)
  const className = lead ? 'detail-body detail-body-lead' : 'detail-body'

  if (!lines.some(line => line.kind !== 'text')) return (
    <div className={className} role="button" tabIndex={0}
      onClick={onEdit} onKeyDown={event => { if (event.key === 'Enter') onEdit() }}><Written text={body} /></div>
  )

  return (
    <div className={`${className} detail-body-rich`}>
      {lines.map((line, index) => {
        const key = `${index}-${line.kind}`
        if (isTodo(line.kind)) return (
          <div className={line.kind === 'done' ? 'body-task done' : 'body-task'} key={key}>
            <button className="check-toggle" type="button"
              aria-label={line.kind === 'done' ? `Mark ${line.text} not done` : `Mark ${line.text} done`}
              onClick={() => { void onChange(toggleTodoLine(body, index)) }}>
              {line.kind === 'done' && <Check size={13} strokeWidth={2.5} />}
            </button>
            <button className="body-task-text" type="button" onClick={onEdit}><Written text={line.text} /></button>
          </div>
        )
        if (line.kind === 'heading') return <h3 className="body-heading" key={key} onClick={onEdit}>{line.text}</h3>
        if (line.kind === 'subheading') return <h4 className="body-subheading" key={key} onClick={onEdit}>{line.text}</h4>
        if (line.kind === 'bullet') return (
          <div className="body-bullet" key={key} onClick={onEdit}><span aria-hidden="true">•</span><span><Written text={line.text} /></span></div>
        )
        if (line.kind === 'numbered') return (
          <div className="body-bullet" key={key} onClick={onEdit}><span aria-hidden="true">{line.number}.</span><span><Written text={line.text} /></span></div>
        )
        // A blank line between blocks is spacing the writer chose, so it is
        // kept rather than collapsed.
        if (!line.text) return <div className="body-gap" key={key} />
        return <p className="body-line" key={key} onClick={onEdit}><Written text={line.text} /></p>
      })}
    </div>
  )
}
