import { useEffect, useState } from 'react'
import { authedUrl } from '../../api/client'
import { useToast } from '../ui/Toast'

export default function Lightbox({ eventId, images, index, canDownloadOriginal, onClose, onIndex }) {
  const img = images[index]
  const toast = useToast()
  const [downloading, setDownloading] = useState(false)

  async function downloadOriginal() {
    setDownloading(true)
    try {
      const response = await fetch(authedUrl(`/gallery/events/${eventId}/images/${img.id}/download`))
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(typeof body?.detail === 'string' ? body.detail : 'Could not download the original image.')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = img.file_name
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not download the original image.', 'error')
    } finally {
      setDownloading(false)
    }
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onIndex((index + 1) % images.length)
      if (e.key === 'ArrowLeft') onIndex((index - 1 + images.length) % images.length)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [index, images.length, onClose, onIndex])

  if (!img) return null
  const btn = 'absolute grid h-11 w-11 place-items-center rounded-full bg-white/10 text-xl text-white backdrop-blur hover:bg-white/20'
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/95 animate-rise" onClick={onClose} role="dialog" aria-modal="true">
      <img src={img.url} alt={img.file_name} className="max-h-[88vh] max-w-[94vw] rounded-lg object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
      <button className={`${btn} right-4 top-4`} onClick={onClose} aria-label="Close">✕</button>
      <button className={`${btn} left-3 top-1/2 -translate-y-1/2`} onClick={(e) => { e.stopPropagation(); onIndex((index - 1 + images.length) % images.length) }} aria-label="Previous">‹</button>
      <button className={`${btn} right-3 top-1/2 -translate-y-1/2`} onClick={(e) => { e.stopPropagation(); onIndex((index + 1) % images.length) }} aria-label="Next">›</button>
      <p className="absolute bottom-4 text-sm text-white/70">{index + 1} / {images.length}</p>
      {canDownloadOriginal && (
        <button
          type="button"
          className="absolute bottom-3 right-4 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-ink-950 shadow hover:bg-white/90 disabled:opacity-60"
          onClick={(e) => {
            e.stopPropagation()
            downloadOriginal()
          }}
          disabled={downloading}
        >
          {downloading ? 'Preparing download…' : 'Download original'}
        </button>
      )}
    </div>
  )
}
