// Writing is a string. It stays a string.
//
// A note that can hold checkboxes needs the boxes to survive the same save, the
// same realtime channel, the same offline copy and the same search as the rest
// of the writing. Anything richer — a document model, a separate table of
// lines — would have to be kept in step with the text, and the two would drift.
// So a checkbox is a character at the front of a line: what you see in the
// writing box is exactly what is stored, and searching for "MOQ" finds a note
// that only ever mentions it inside a box.
//
// The glyphs are the real ones rather than "[ ]", because the writing box is a
// plain textarea and a person writing should already be looking at a checklist,
// not at the markup for one.

export const UNCHECKED = '☐ '
export const CHECKED = '☑ '
export const BULLET = '• '
export const NUMBER = /^(\d+)\. /
export const HEADING = '# '
// A second level, and only a second. Pasted documents routinely run three or
// four deep; a notebook that grew a type scale to match would be a document
// editor. Anything below a sub-heading folds up into one.
export const SUBHEADING = '## '

export type LineKind = 'text' | 'todo' | 'done' | 'bullet' | 'numbered' | 'heading' | 'subheading'

export type ParsedLine = {
  kind: LineKind
  // The line with its marker removed — what a person actually wrote.
  text: string
  // Present on a numbered line, so the read view can print the number the
  // writer chose rather than renumbering behind their back.
  number?: number
}

export function parseLine(line: string): ParsedLine {
  if (line.startsWith(UNCHECKED)) return { kind: 'todo', text: line.slice(UNCHECKED.length) }
  if (line.startsWith(CHECKED)) return { kind: 'done', text: line.slice(CHECKED.length) }
  if (line.startsWith(BULLET)) return { kind: 'bullet', text: line.slice(BULLET.length) }
  // Before the single hash, or "## Store Timing" reads as a heading named
  // "# Store Timing".
  if (line.startsWith(SUBHEADING)) return { kind: 'subheading', text: line.slice(SUBHEADING.length) }
  if (line.startsWith(HEADING)) return { kind: 'heading', text: line.slice(HEADING.length) }
  const numbered = line.match(NUMBER)
  if (numbered) return { kind: 'numbered', text: line.slice(numbered[0].length), number: Number(numbered[1]) }
  return { kind: 'text', text: line }
}

// The marker a line of this kind carries. A numbered line needs to know which
// number, so it is asked for one.
export function markerFor(kind: LineKind, number = 1): string {
  switch (kind) {
    case 'todo': return UNCHECKED
    case 'done': return CHECKED
    case 'bullet': return BULLET
    case 'heading': return HEADING
    case 'subheading': return SUBHEADING
    case 'numbered': return `${number}. `
    case 'text': return ''
  }
}

export function isTodo(kind: LineKind) {
  return kind === 'todo' || kind === 'done'
}

export function parseBody(body: string): ParsedLine[] {
  return body.split('\n').map(parseLine)
}

export function hasChecklist(body: string) {
  return body.split('\n').some(line => isTodo(parseLine(line).kind))
}

// ── Editing the string ──────────────────────────────────────────────────────
//
// Every edit below is expressed as "rewrite line N", so the caret can be put
// back where the writer left it rather than jumping to the end of the box.

export type LineEdit = { body: string; caret: number }

export function lineBounds(body: string, caret: number) {
  const start = body.lastIndexOf('\n', Math.max(0, caret - 1)) + 1
  const end = body.indexOf('\n', caret)
  return { start, end: end === -1 ? body.length : end }
}

function replaceRange(body: string, start: number, end: number, text: string): string {
  return body.slice(0, start) + text + body.slice(end)
}

// Turn the line the caret is on into `kind`, or back into plain text if it is
// already that kind. This is what every toolbar button does.
export function setLineKind(body: string, caret: number, kind: LineKind): LineEdit {
  const { start, end } = lineBounds(body, caret)
  const line = body.slice(start, end)
  const parsed = parseLine(line)
  // Pressing the button a line is already wearing takes the marker off, which
  // is how you leave a list without reaching for the mouse twice.
  const target: LineKind = parsed.kind === kind || (kind === 'todo' && parsed.kind === 'done') ? 'text' : kind
  const marker = markerFor(target, numberFor(body, start))
  const rewritten = marker + parsed.text
  return {
    body: replaceRange(body, start, end, rewritten),
    caret: Math.max(start + marker.length, caret + (rewritten.length - line.length)),
  }
}

// What number a new numbered line should carry: one more than the numbered line
// above it, and 1 when there isn't one.
function numberFor(body: string, start: number): number {
  if (start === 0) return 1
  const previous = parseLine(body.slice(lineBounds(body, start - 1).start, start - 1))
  return previous.kind === 'numbered' ? (previous.number ?? 0) + 1 : 1
}

// Enter inside a list. Three outcomes, and the third is the one that makes a
// list feel like a list rather than a trap:
//   - on a list line with writing on it, start the next one already marked
//   - on an empty list line, take the marker off and stop — Enter twice leaves
//   - anywhere else, this is not our business; the textarea handles it
export function continueList(body: string, caret: number): LineEdit | null {
  const { start, end } = lineBounds(body, caret)
  // Splitting a line in the middle is ordinary typing, not continuing a list.
  if (caret !== end) return null
  const parsed = parseLine(body.slice(start, end))
  if (parsed.kind === 'text' || parsed.kind === 'heading' || parsed.kind === 'subheading') return null

  if (!parsed.text.trim()) {
    // An empty box, bullet or number is the writer saying "that's the lot".
    return { body: replaceRange(body, start, end, ''), caret: start }
  }

  // A ticked line continues as an empty box, not as another ticked one.
  const nextKind: LineKind = parsed.kind === 'done' ? 'todo' : parsed.kind
  const marker = markerFor(nextKind, (parsed.number ?? 0) + 1)
  return { body: replaceRange(body, caret, caret, `\n${marker}`), caret: caret + 1 + marker.length }
}

// Tick or untick the Nth line. The read view calls this; it is the only way the
// writing changes without the editor being open, so it changes nothing else.
export function toggleTodoLine(body: string, index: number): string {
  const lines = body.split('\n')
  const parsed = parseLine(lines[index] ?? '')
  if (!isTodo(parsed.kind)) return body
  lines[index] = markerFor(parsed.kind === 'done' ? 'todo' : 'done') + parsed.text
  return lines.join('\n')
}

// What a note is called when its first line is a box. "☐ Ask MOQ" is a fine
// thing to write and a poor thing to be called, so the marker comes off.
export function plainText(body: string): string {
  return parseBody(body).map(line => line.text).join('\n')
}

// One line of writing, for a place that has room for one line: a row in a list,
// a cell in a comparison table. The markers are structure, and structure needs
// a page to be structure on — on a single line "## Store Timing" is not a
// heading, it is two hashes somebody has to read past.
export function preview(body: string): string {
  return plainText(body).replace(/\s+/g, ' ').trim()
}

// ── Pasting from somewhere else ─────────────────────────────────────────────
//
// Notes, guides and plans arrive from a chat window, a doc or a phone, and they
// arrive as Markdown. Pasted raw they read as punctuation: "## Store Timing",
// "**Staff arrives:** 8:30 AM", "* Wash hands", "---". The one marker that used
// to survive did so by accident, because a heading here happens to be spelled
// with the same character.
//
// So a paste is translated into the markers this app actually has, and anything
// it has no equivalent for is taken off rather than left lying in the text.
// Emphasis is lost — there is no bold here to keep it in, and a stray ** is
// worse than a missing one.

// Markers this app cannot express, removed rather than shown.
const INLINE: Array<[RegExp, string]> = [
  // Images before links: the syntax is a link with a bang on the front.
  [/!\[([^\]]*)\]\([^)]*\)/g, '$1'],
  [/`([^`]+)`/g, '$1'],
  [/\*\*([^*]+)\*\*/g, '$1'],
  [/__([^_]+)__/g, '$1'],
  // A single asterisk, only when it is clearly a pair and not part of a **.
  [/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, '$1$2'],
  [/~~([^~]+)~~/g, '$1'],
  // An escaped marker was meant to be read as the character itself.
  [/\\([\\`*_{}[\]()#+\-.!>])/g, '$1'],
]

// A link keeps its address. Losing where a reference points is losing the
// reference; the text on its own is a sentence about a page nobody can open.
function unlink(line: string): string {
  return line.replace(/\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (_, label: string, url: string) =>
    !label.trim() || label.trim() === url ? url : `${label} (${url})`)
}

function stripInline(line: string): string {
  return INLINE.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), unlink(line))
}

const RULE = /^\s*([-*_])\s*(?:\1\s*){2,}$/
const FENCE = /^\s*(?:```|~~~)/
const ATX = /^\s*(#{1,6})\s+(.*?)\s*#*\s*$/
const QUOTE = /^\s*>\s?/
const TASK = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/
const LIST = /^\s*[-*+]\s+(.*)$/
const ORDERED = /^\s*(\d+)[.)]\s+(.*)$/

// Whether this looks like it came from somewhere that speaks Markdown. Text
// that does not is inserted exactly as it was copied — a paste is not an
// invitation to reformat somebody's writing.
export function looksLikeMarkdown(text: string): boolean {
  return text.split('\n').some(line =>
    ATX.test(line) || RULE.test(line) || FENCE.test(line) || TASK.test(line)
    || LIST.test(line) || QUOTE.test(line)
    || /\*\*[^*]+\*\*|`[^`]+`|\[[^\]]*\]\([^)]*\)/.test(line))
}

// Returns null when there is nothing to translate, so the caller can leave the
// browser's own paste alone — cheaper, and it keeps the undo stack intact.
export function fromMarkdown(text: string): string | null {
  if (!looksLikeMarkdown(text)) return null

  const out: string[] = []
  let fenced = false

  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    // A fence is scaffolding. What is inside it is writing somebody indented on
    // purpose, so it passes through untouched.
    if (FENCE.test(raw)) { fenced = !fenced; continue }
    if (fenced) { out.push(raw); continue }

    // A rule is a gap drawn with punctuation. Here it is just the gap.
    if (RULE.test(raw)) { out.push(''); continue }

    const line = raw.replace(QUOTE, '')

    const heading = line.match(ATX)
    if (heading) {
      out.push(markerFor(heading[1].length === 1 ? 'heading' : 'subheading') + stripInline(heading[2]))
      continue
    }

    const task = line.match(TASK)
    if (task) {
      out.push(markerFor(task[1].trim() ? 'done' : 'todo') + stripInline(task[2]))
      continue
    }

    const ordered = line.match(ORDERED)
    if (ordered) {
      out.push(markerFor('numbered', Number(ordered[1])) + stripInline(ordered[2]))
      continue
    }

    const bullet = line.match(LIST)
    if (bullet) { out.push(markerFor('bullet') + stripInline(bullet[1])); continue }

    out.push(stripInline(line.trimEnd()))
  }

  // Rules became blank lines beside the blank lines that already surrounded
  // them. One gap is a gap; three is a hole in the page.
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

// ── Links inside writing ────────────────────────────────────────────────────
//
// A URL written into a note is not decoration. It is the one thing in the
// sentence you will want to press, and the one thing you will later want to
// find again without remembering which note it was in.
//
// Parentheses are excluded from the match on purpose: pasting a Markdown link
// produces "guide (https://…/g)", and the address has to stop before the
// bracket that closes it. The cost is that a URL which genuinely contains
// brackets is cut short — rarer than the case this protects.
const URL_PATTERN = /https?:\/\/[^\s<>()[\]{}"']+/g

// Trailing punctuation belongs to the sentence, not to the address.
const trimTrailing = (url: string) => url.replace(/[.,;:!?]+$/, '')

export type Segment = { text: string; url?: string }

// One line broken into what to print and what to make pressable.
export function segments(line: string): Segment[] {
  const out: Segment[] = []
  let index = 0
  for (const match of line.matchAll(URL_PATTERN)) {
    const url = trimTrailing(match[0])
    if (match.index > index) out.push({ text: line.slice(index, match.index) })
    out.push({ text: url, url })
    index = match.index + url.length
  }
  if (index < line.length) out.push({ text: line.slice(index) })
  return out.length ? out : [{ text: line }]
}

export function findUrls(text: string): string[] {
  return [...text.matchAll(URL_PATTERN)].map(match => trimTrailing(match[0]))
}
