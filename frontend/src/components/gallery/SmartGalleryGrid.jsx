import { useEffect, useRef, useState } from 'react'
import LazyImage from './LazyImage'
import Lightbox from './Lightbox'

/** Masonry-style grid of downscaled previews. */
export default function SmartGalleryGrid({ eventId, images, canDownloadOriginal, targetPhotoId = null }) {
  const [open, setOpen] = useState(null)
  const [highlightedPhotoId, setHighlightedPhotoId] = useState(null)
  const photoRefs = useRef(new Map())

  useEffect(() => {
    if (targetPhotoId === null) return undefined
    const index = images.findIndex((image) => image.id === targetPhotoId)
    if (index < 0) return undefined

    const element = photoRefs.current.get(targetPhotoId)
    if (!element) return undefined

    setHighlightedPhotoId(targetPhotoId)
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const timeoutId = window.setTimeout(() => setHighlightedPhotoId(null), 5000)
    return () => window.clearTimeout(timeoutId)
  }, [images, targetPhotoId])

  return (
    <>
      <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>*]:mb-3">
        {images.map((im, i) => (
          <button key={im.id} ref={(element) => {
            if (element) photoRefs.current.set(im.id, element)
            else photoRefs.current.delete(im.id)
          }} onClick={() => setOpen(i)}
            className={`group relative block w-full overflow-hidden rounded-xl shadow-sm ring-1 transition hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 dark:ring-white/10 ${highlightedPhotoId === im.id ? 'z-10 ring-4 ring-gold-400 shadow-xl shadow-gold-500/30' : 'ring-ink-900/10'}`}
            aria-label={`Open ${im.file_name}`}>
            <LazyImage src={im.url} alt={im.file_name} width={im.width} height={im.height}
              className="transition duration-500 group-hover:scale-[1.03]" />
          </button>
        ))}
      </div>
      {open !== null && (
        <Lightbox
          eventId={eventId}
          images={images}
          index={open}
          canDownloadOriginal={canDownloadOriginal}
          onClose={() => setOpen(null)}
          onIndex={setOpen}
        />
      )}
    </>
  )
}
