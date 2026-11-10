import { Link, useParams, useSearchParams } from 'react-router-dom'
import { endpoints } from '../api/client'
import AccessPanel from '../components/gallery/AccessPanel'
import SmartGalleryGrid from '../components/gallery/SmartGalleryGrid'
import { useAuth } from '../context/AuthContext'
import { useAsync } from '../hooks/useAsync'

export default function EventGallery() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const ev = useAsync(() => endpoints.galleryEvent(id), [id, user?.id])
  const imgs = useAsync(() => endpoints.galleryImages(id), [id])
  const photoId = Number(searchParams.get('photo'))
  const targetPhotoId = Number.isSafeInteger(photoId) && photoId > 0 ? photoId : null

  if (ev.error) return <main className="mx-auto max-w-3xl p-10"><p className="card p-6">Event not found. <Link className="underline" to="/gallery">Back to gallery</Link></p></main>
  return (
    <main className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6 sm:py-10">
      <Link to="/gallery" className="inline-flex items-center gap-2 text-sm font-semibold opacity-70 transition hover:opacity-100"><span aria-hidden>←</span> All galleries</Link>
      {ev.loading && <div className="card h-36 animate-pulse" />}
      {ev.data && (
        <>
          <header className="animate-rise rounded-3xl border border-ink-900/10 bg-white/60 p-6 dark:border-white/10 dark:bg-ink-800/50 sm:p-8">
            <p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-gold-600 dark:text-gold-400">
              {new Date(ev.data.event_date + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
              <span className="mx-2 opacity-40">·</span>{ev.data.image_count} {ev.data.image_count === 1 ? 'photo' : 'photos'}
            </p>
            <h1 className="font-display text-3xl font-semibold sm:text-4xl">{ev.data.title}</h1>
            {ev.data.description && <p className="mt-3 max-w-2xl leading-7 opacity-70">{ev.data.description}</p>}
          </header>
          <AccessPanel event={ev.data} onChanged={() => ev.reload(true)} />
        </>
      )}
      {imgs.error && <p role="alert" className="card p-6 text-rose-600">Could not load photos: {imgs.error.message}</p>}
      {imgs.loading && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="card aspect-[3/4] animate-pulse" />)}</div>}
      {imgs.data && (
        <SmartGalleryGrid
          eventId={id}
          images={imgs.data}
          targetPhotoId={targetPhotoId}
          canDownloadOriginal={['approved', 'staff'].includes(ev.data?.access_status)}
        />
      )}
      {!imgs.loading && !imgs.error && imgs.data?.length === 0 && (
        <div className="card p-10 text-center text-sm opacity-70">Photos for this gallery are not available yet.</div>
      )}
    </main>
  )
}
