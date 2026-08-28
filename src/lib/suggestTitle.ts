import { kindLabel } from './labels'
import { plainText } from './richText'
import type { ItemKind } from '../types'

// Home is a place to dump a thought, not to name one. Retyping the sentence you
// just wrote as a title is the fastest way to stop capturing things, so the
// first line becomes a short suggested title and the thought itself stays whole
// in the body. A truncated sentence with an ellipsis is not a title, so this
// never produces one: it shortens, or it falls back to something plain.

const LEADING_FILLER = /^(?:ok(?:ay)?[,: ]+|so[,: ]+|todo[,: ]+|note[,: ]+|reminder[,: ]+|i\s+|we\s+)?(?:really\s+)?(?:need(?:s)?\s+to|needed\s+to|have\s+to|has\s+to|had\s+to|want\s+to|would\s+like\s+to|should|must|remember\s+to|don't\s+forget\s+to|let'?s|gotta|going\s+to|plan\s+to)\s+/i

// Words that leave a title dangling if it ends on them.
const TRAILING_STOPWORDS = new Set(['the', 'a', 'an', 'of', 'for', 'to', 'and', 'with', 'in', 'on', 'at', 'is', 'are', 'was', 'were', 'need', 'needs', 'about', 'from', 'by', 'or', 'if', 'that', 'their', 'its', 'our'])
const LEADING_FLUFF = new Set(['the', 'a', 'an', 'their', 'its', 'our', 'this', 'that', 'these', 'those', 'they', 'it'])
// Where a sentence stops being the point and starts being the detail.
const CLAUSE_BREAK = /\s+(?:because|since|after|before|when|while|so that|so|which|that|although|though|but|and then|until|unless)\s+/i
const ASK_PATTERN = /^ask\s+(.{2,40}?)\s+(?:whether|if|about|regarding|for)\s+(.+)$/i

const MAX_WORDS = 8

function words(value: string) {
  return value.trim().split(/\s+/).filter(Boolean)
}

function trimStopwords(list: string[]) {
  const result = [...list]
  while (result.length > 2 && TRAILING_STOPWORDS.has(result[result.length - 1].toLowerCase().replace(/[^a-z']/g, ''))) result.pop()
  return result
}

function tidy(value: string) {
  const trimmed = value.trim().replace(/\s+/g, ' ').replace(/[.,;:!?\s]+$/, '')
  if (!trimmed) return ''
  return trimmed[0].toUpperCase() + trimmed.slice(1)
}

function shorten(sentence: string) {
  // Prefer an honest cut at a clause boundary over an arbitrary word count.
  const beforeClause = sentence.split(CLAUSE_BREAK)[0]
  const beforeComma = beforeClause.split(',')[0]
  const candidate = words(beforeComma).length >= 3 ? beforeComma : beforeClause
  return tidy(trimStopwords(words(candidate).slice(0, MAX_WORDS)).join(' '))
}

function fallbackTitle(kind: ItemKind) {
  if (kind === 'Note') return 'New note'
  return `New ${kindLabel(kind).toLowerCase()}`
}

// "Ask Tea Planet whether the popping boba containers need refrigeration" is a
// question for a supplier, and that shape survives shortening much better than
// a word count does.
function askPattern(sentence: string) {
  const match = sentence.match(ASK_PATTERN)
  if (!match) return ''
  const who = words(match[1]).slice(0, 3).join(' ')
  const subject = words(match[2])
  if (subject.length > 1 && LEADING_FLUFF.has(subject[0].toLowerCase())) subject.shift()
  const topic = trimStopwords(subject.slice(0, 3)).join(' ')
  if (!who || !topic) return ''
  return tidy(`Ask ${who} about ${topic}`)
}

export function suggestTitle(text: string, kind: ItemKind = 'Note') {
  // A note may open on a checkbox or a bullet. "☐ Ask MOQ" is a fine thing to
  // write and a poor thing to be called, so the marker comes off first.
  const firstLine = plainText(text).split(/\r?\n/).map(line => line.trim()).find(Boolean) ?? ''
  if (!firstLine) return ''
  // One sentence is a title. A paragraph is a note that happens to start with one.
  const firstSentence = (firstLine.split(/(?<=[.!?])\s+/)[0] ?? firstLine).replace(LEADING_FILLER, '')
  const suggestion = askPattern(firstSentence) || shorten(firstSentence)
  return words(suggestion).length >= 2 ? suggestion : fallbackTitle(kind)
}

export function suggestTitleFromUrl(url: string) {
  try {
    const parsed = new URL(url.trim())
    const segments = parsed.pathname.split('/').filter(Boolean)
    const last = [...segments].reverse().find(segment => /[a-z]{3}/i.test(segment.replace(/\.[a-z0-9]+$/i, '')))
    const host = parsed.hostname.replace(/^www\./, '')
    if (!last) return tidy(host)
    const readable = last.replace(/\.[a-z0-9]+$/i, '').replace(/[-_+]+/g, ' ').replace(/%[0-9a-f]{2}/gi, ' ')
    return shorten(readable) || tidy(host)
  } catch {
    return ''
  }
}

export function suggestTitleFromFiles(files: File[]) {
  const first = files[0]
  if (!first) return ''
  if (files.length > 1) return tidy(`${files.length} files`)
  return shorten(first.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ')) || 'New document'
}

// Lists still need something to show, so a record saved without a title borrows
// one from what was written. Nothing is ever rejected for lacking a title.
export function ensureTitle(title: string, body: string, kind: ItemKind = 'Note') {
  const typed = title.trim()
  if (typed) return typed
  return suggestTitle(body, kind) || fallbackTitle(kind)
}
