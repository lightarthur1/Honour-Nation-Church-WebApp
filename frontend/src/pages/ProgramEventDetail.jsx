import { Link, useParams } from 'react-router-dom'
import { endpoints } from '../api/client'
import { useAsync } from '../hooks/useAsync'

function formatEventDate(event) {
  const start = new Date(`${event.start_date}T00:00:00`)
  const end = event.end_date ? new Date(`${event.end_date}T00:00:00`) : null
  const options = { day: 'numeric', month: 'long', year: 'numeric' }
  if (!end || event.start_date === event.end_date) return start.toLocaleDateString(undefined, options)
  return `${start.toLocaleDateString(undefined, options)} – ${end.toLocaleDateString(undefined, options)}`
}

function formatTime(value) {
  return value
    ? new Date(`2000-01-01T${value}`).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : null
}

export default function ProgramEventDetail() {
  const { id } = useParams()
  const { data, loading, error } = useAsync(() => endpoints.programEvent(id), [id])

  if (loading) return <main className="mx-auto max-w-4xl px-4 py-10"><div role="status" className="card h-96 animate-pulse" /></main>
  if (error || !data) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div role="alert" className="card p-6">
          <h1 className="font-display text-xl font-semibold">Event not found</h1>
          <p className="mt-2 text-sm opacity-65">This event may have been removed or is not published.</p>
          <Link className="mt-4 inline-flex text-sm font-semibold text-gold-700 hover:underline dark:text-gold-300" to="/events">Back to events</Link>
        </div>
      </main>
    )
  }

  const startTime = formatTime(data.start_time)
  const endTime = formatTime(data.end_time)
  const time = startTime ? `${startTime}${endTime ? ` – ${endTime}` : ''}` : null
  const mapUrl = data.venue ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.venue)}` : null

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <Link to="/events" className="inline-flex items-center gap-2 text-sm font-semibold opacity-70 transition hover:opacity-100"><span aria-hidden>←</span> All events</Link>
      <article className="overflow-hidden rounded-[2rem] border border-ink-900/10 bg-white/70 shadow-xl dark:border-white/10 dark:bg-ink-800/60">
        <header className="relative isolate grid min-h-64 place-items-center overflow-hidden bg-gradient-to-br from-ink-900 via-ink-800 to-ink-700 px-6 py-14 text-center text-white sm:px-12">
          {data.poster_url && <img src={data.poster_url} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />}
          <div className="absolute inset-0 -z-10 bg-ink-950/75" />
          <div className="max-w-3xl">
            <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[.17em] text-gold-300">Honour Nation Church · Event</p>
            <h1 className="mt-5 font-display text-3xl font-semibold sm:text-5xl">{data.title}</h1>
            <div className="mt-6 flex flex-wrap justify-center gap-2 text-sm">
              <span className="rounded-full bg-white/10 px-4 py-2">{formatEventDate(data)}</span>
              {time && <span className="rounded-full bg-white/10 px-4 py-2">{time}</span>}
              {data.venue && <span className="rounded-full bg-white/10 px-4 py-2">{data.venue}</span>}
            </div>
          </div>
        </header>
        {data.poster_url && (
          <div className="mx-auto -mt-7 max-w-3xl px-4 sm:px-8">
            <img src={data.poster_url} alt={`Event poster for ${data.title}`} className="relative rounded-3xl border border-ink-900/10 shadow-2xl dark:border-white/10" />
          </div>
        )}
        <div className="grid gap-8 p-6 sm:p-10 md:grid-cols-[1fr_auto]">
          <section>
            <h2 className="font-display text-2xl font-semibold">About this event</h2>
            <p className="mt-4 whitespace-pre-wrap break-words leading-7 opacity-75">{data.description || 'More information about this gathering will be shared soon.'}</p>
          </section>
          <aside className="flex flex-col gap-3 md:min-w-48">
            {mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" className="btn-primary">View location <span aria-hidden>↗</span></a>}
            {data.gallery_event_id && (
              <Link to={`/events/${data.gallery_event_id}`} className="btn-ghost">
                View {data.gallery_event_title ? `photos from ${data.gallery_event_title}` : 'event photos'} <span aria-hidden>→</span>
              </Link>
            )}
            <Link to="/feed" className="btn-ghost">Church announcements</Link>
          </aside>
        </div>
        <footer className="border-t border-ink-900/10 bg-ink-900/[.03] px-6 py-4 text-xs font-semibold uppercase tracking-wider opacity-60 dark:border-white/10">
          Honour Nation Church
        </footer>
      </article>
    </main>
  )
}
