
import { viewName } from '../lib/labels'
import { useMemo } from 'react'
import { FileText, Link2 } from 'lucide-react'
import { AttachmentThumb } from './AttachmentThumb'
import { findUrls } from '../lib/richText'
import { suggestTitleFromUrl } from '../lib/suggestTitle'
import type { WorkspaceAttachment, WorkspaceItem } from '../types'

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

type Props = {
  items: WorkspaceItem[]
  onOpenFile: (attachment: WorkspaceAttachment) => void
  onOpenParent: (item: WorkspaceItem) => void
  resolveUrl: (storagePath: string) => Promise<string>
}

// Two kinds of thing live in the Library, and they are not interchangeable: a
// document is material we hold, a reference is a page that lives somewhere
// else. "Where is the material I need" has a different answer for each.
export type LibraryDocument = {
  id: string
  name: string
  type: string
  added: string
  item: WorkspaceItem
  // Absent on a document we only have the name of. The eight guides this
  // workspace was built from arrived that way: real documents, named on real
  // records, with the file itself still sitting on somebody's laptop.
  attachment?: WorkspaceAttachment
}

export type LibraryReference = {
  item: WorkspaceItem
  url: string
  // What to call it. A record captured as a link is named by its own title; a
  // link written inside a note is named after where it points, because the
  // note's title is about the note, not about the page.
  name: string
}

const isWebUrl = (url?: string) => Boolean(url && /^https?:\/\//i.test(url))

function fileType(name: string, mimeType?: string) {
  const extension = name.match(/\.([a-z0-9]+)$/i)?.[1]
  if (extension) return extension.toUpperCase()
  if (mimeType) return mimeType.split('/').pop()!.toUpperCase()
  return 'File'
}

function addedOn(stamp: string) {
  const date = new Date(stamp)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// The Library's whole population, worked out once. The view renders it, the
// heading counts it and the pin summarises it — so the screen can never again
// say "Library 8" over a body listing five things.
//
// A File record whose url is a bare filename is a document. It used to be
// invisible: the only test for "does this deserve to render" was "does it start
// with https", which threw away every one of the guides the workspace was built
// from. Holding a file and naming a file are both ways of having a document.
export function libraryEntries(items: WorkspaceItem[]): { documents: LibraryDocument[]; references: LibraryReference[] } {
  const documents: LibraryDocument[] = []
  for (const item of items) {
    for (const attachment of item.attachments ?? []) {
      documents.push({
        id: attachment.id,
        name: attachment.name,
        type: fileType(attachment.name, attachment.mimeType),
        added: attachment.createdAt ?? item.updatedAt,
        item,
        attachment,
      })
    }
    // Only when nothing is actually attached, or the record would be listed
    // twice — once as the file it holds and once as the file it names.
    if (item.kind === 'File' && !isWebUrl(item.url) && item.url?.trim() && !(item.attachments ?? []).length) {
      documents.push({
        id: `record-${item.id}`,
        name: item.title,
        type: fileType(item.url),
        added: item.updatedAt,
        item,
      })
    }
  }
  documents.sort((a, b) => b.added.localeCompare(a.added))

  // A supplier's website belongs to the supplier; a marketing contact's
  // Instagram belongs to marketing. Those have a home already, and pulling them
  // in here would turn the Library into a list of every URL in the workspace.
  //
  // A link *written into the writing* has no other home. Nothing else in the
  // app will ever show it to you again, and it is the one thing in a sentence
  // you will want to find later — so this is where it lives. Same rule as an
  // attachment: it is listed here and it stays attached to the record it came
  // from. Keyed by address, so one link mentioned in three notes is one row.
  const byUrl = new Map<string, LibraryReference>()
  // A record captured as a link wins over a passing mention of the same page.
  for (const item of items) {
    if ((item.kind === 'Note' || item.kind === 'Link' || item.kind === 'File') && isWebUrl(item.url)) {
      byUrl.set(item.url!, { item, url: item.url!, name: item.title })
    }
  }
  for (const item of items) {
    for (const url of findUrls(item.body)) {
      if (!byUrl.has(url)) byUrl.set(url, { item, url, name: suggestTitleFromUrl(url) || hostOf(url) })
    }
  }
  const references = [...byUrl.values()]

  return { documents, references }
}

export function libraryCount(items: WorkspaceItem[]) {
  const { documents, references } = libraryEntries(items)
  return documents.length + references.length
}

// Every document belongs to a record. The Library is a way to find something
// when you remember the file but not where you filed it — never a loose dump,
// so each row carries the record it came from and opens it on request.
export function LibraryFiles({ items, onOpenFile, onOpenParent, resolveUrl }: Props) {
  const all = useMemo(() => libraryEntries(items), [items])

  if (all.documents.length === 0 && all.references.length === 0) return (
    <p className="quiet-offer">Documents, photos and links you save show up here, and stay attached to the record they came from.</p>
  )

  const { documents, references } = all

  return (
    <section className="library-files" aria-label="All documents">
      <header><span>
        {documents.length} {documents.length === 1 ? 'document' : 'documents'}
        {references.length > 0 && ` · ${references.length} ${references.length === 1 ? 'reference' : 'references'}`}
      </span></header>
      {<>
          {documents.length > 0 && <>
            <p className="eyebrow">Documents</p>
            <div className="library-list">
              {documents.map(entry => (
                <div className="library-row" key={entry.id}>
                  {/* A document we hold opens. A document we only have the name
                      of opens its record, which is where the name is written —
                      it does not pretend to have a file behind it. */}
                  {entry.attachment
                    ? <button className="library-open" onClick={() => onOpenFile(entry.attachment!)}>
                      <AttachmentThumb attachment={entry.attachment} resolveUrl={resolveUrl} />
                      <strong>{entry.name}</strong>
                      <small>{entry.type} · added {addedOn(entry.added)}</small>
                    </button>
                    : <button className="library-open" onClick={() => onOpenParent(entry.item)}>
                      <span className="thumb thumb-icon"><FileText size={16} /></span>
                      <strong>{entry.name}</strong>
                      <small>{entry.type} · {entry.item.url}</small>
                    </button>}
                  <button className="library-parent" onClick={() => onOpenParent(entry.item)}>
                    <span>{entry.item.title}</span>
                    <small>{entry.item.area ? `${entry.item.area} · ${viewName(entry.item)}` : viewName(entry.item)}</small>
                  </button>
                </div>
              ))}
            </div>
          </>}

          {references.length > 0 && <>
            <p className="eyebrow">References</p>
            <div className="library-list">
              {references.map(({ item, url, name }) => (
                <div className="library-row" key={`link-${url}`}>
                  <a className="library-open" href={url} target="_blank" rel="noreferrer">
                    <span className="thumb thumb-icon"><Link2 size={16} /></span>
                    <strong>{name}</strong>
                    <small>{hostOf(url)}</small>
                  </a>
                  <button className="library-parent" onClick={() => onOpenParent(item)}>
                    <span>Open the record</span>
                    <small>{item.area ? `${item.area} · ${viewName(item)}` : viewName(item)}</small>
                  </button>
                </div>
              ))}
            </div>
          </>}
        </>}
    </section>
  )
}
