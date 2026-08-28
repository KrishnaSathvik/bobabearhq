import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Image as ImageIcon } from 'lucide-react'
import type { WorkspaceAttachment } from '../types'

export function isImageAttachment(attachment: Pick<WorkspaceAttachment, 'name' | 'mimeType'>) {
  return /^image\//i.test(attachment.mimeType ?? '') || /\.(png|jpe?g|gif|webp|heic|heif|avif|bmp)$/i.test(attachment.name)
}

// A photograph of a price list is unreadable as the words "IMG_4413.jpg". The
// thumbnail is the whole reason the camera button exists, so it is worth the
// signed URL it costs.
//
// Falling back to an icon is a normal outcome, not an error: without Supabase
// there is no storage to sign against, and a link that has expired should show
// the row rather than a broken image.
// Signing a storage path, shared by the 40px thumbnail in a list and the full
// preview on a record. Both want the same URL and the same graceful failure.
function useSignedImage(attachment: WorkspaceAttachment, resolveUrl: (storagePath: string) => Promise<string>) {
  const [url, setUrl] = useState('')
  const [failed, setFailed] = useState(false)
  const isImage = isImageAttachment(attachment)
  // The resolver is rebuilt on every render of the workspace hook, so holding
  // it in a ref is what keeps this from re-fetching forever.
  const resolve = useRef(resolveUrl)
  useEffect(() => { resolve.current = resolveUrl })

  useEffect(() => {
    if (!isImage) return
    let alive = true
    resolve.current(attachment.storagePath)
      .then(signed => { if (alive) setUrl(signed) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [attachment.storagePath, isImage])

  return { isImage, url, failed, onError: () => setFailed(true) }
}

export function AttachmentThumb({ attachment, resolveUrl }: {
  attachment: WorkspaceAttachment
  resolveUrl: (storagePath: string) => Promise<string>
}) {
  const { isImage, url, failed, onError } = useSignedImage(attachment, resolveUrl)
  if (isImage && url && !failed) return <img className="thumb" src={url} alt="" loading="lazy" onError={onError} />
  return <span className="thumb thumb-icon">{isImage ? <ImageIcon size={16} /> : <FileText size={16} />}</span>
}

// A photograph of a storefront, a price list or a competitor's menu is the
// whole reason you took it. Listed as a 40px square beside "IMG_4413.jpg" it
// might as well not be there — you would have to open every one to find the
// one you meant. On a record they are shown at a size you can actually read.
export function AttachmentPhoto({ attachment, resolveUrl, onOpen }: {
  attachment: WorkspaceAttachment
  resolveUrl: (storagePath: string) => Promise<string>
  onOpen: () => void
}) {
  const { url, failed, onError } = useSignedImage(attachment, resolveUrl)
  return (
    <button type="button" className="detail-photo" onClick={onOpen} aria-label={`Open ${attachment.name}`}>
      {url && !failed
        ? <img src={url} alt={attachment.name} loading="lazy" onError={onError} />
        // A tile that cannot load its picture says which of the two things went
        // wrong. It used to show the same mute grey square either way, so
        // "storage is not connected" and "this photo would not load" were
        // indistinguishable — and neither of them said anything at all.
        : <span className="detail-photo-placeholder">
          <ImageIcon size={22} />
          <em>{failed ? 'Could not load this photo' : 'Loading…'}</em>
        </span>}
      <small>{attachment.name}</small>
    </button>
  )
}

// A photo you have just picked, before it has been uploaded anywhere. The file
// is already in the browser, so there is nothing to wait for and nothing to
// sign — and seeing the picture you chose is the whole point of choosing it.
export function PendingPhoto({ file }: { file: File }) {
  // Derived during render rather than set from an effect: the URL depends only
  // on the file, so there is nothing to synchronise and no reason to paint once
  // without it. The effect exists solely to hand the URL back when it goes.
  const url = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return <img className="attachment-preview" src={url} alt={file.name} />
}

export function isImageFile(file: File) {
  return isImageAttachment({ name: file.name, mimeType: file.type })
}
