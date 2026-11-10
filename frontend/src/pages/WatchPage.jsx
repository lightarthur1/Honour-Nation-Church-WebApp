import { Link } from 'react-router-dom'
import { endpoints } from '../api/client'
import { useAsync } from '../hooks/useAsync'

const providerName = { zoom: 'Zoom', youtube: 'YouTube', facebook: 'Facebook' }

function StreamCard({ item, live = false }) {
  const scheduled = item.scheduled_at ? new Date(item.scheduled_at) : null
  const action = item.kind === 'live' ? `Open on ${providerName[item.provider]}` : `Watch on ${providerName[item.provider]}`

  return (
    <article className="card flex flex-col overflow-hidden sm:flex-row">
      <div className={`grid min-h-44 shrink-0 place-items-center px-8 py-6 text-white sm:w-56 ${live ? 'bg-gradient-to-br from-rose-800 to-ink-900' : 'bg-gradient-to-br from-ink-900 to-ink-700'}`}>
        <div className="text-center">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[.18em] ${live ? 'border-rose-200/30 bg-rose-100/10 text-rose-100' : 'border-gold-200/30 bg-gold-100/10 text-gold-100'}`}>
            {live && <span className="h-1.5 w-1.5 rounded-full bg-rose-300" />}
            {live ? 'Live gathering' : `${providerName[item.provider]} recording`}
          </span>
          <p className="mt-4 font-display text-2xl font-semibold">{providerName[item.provider]}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col items-start p-5 sm:p-6">
        {scheduled && (
          <time className="text-xs font-bold uppercase tracking-wider text-gold-700 dark:text-gold-300" dateTime={scheduled.toISOString()}>
            {scheduled.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </time>
        )}
        <h2 className="mt-2 font-display text-xl font-semibold">{item.title}</h2>
        {item.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 opacity-70">{item.description}</p>}
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="btn-primary mt-5">
          {action} <span aria-hidden>↗</span>
        </a>
      </div>
    </article>
  )
}

function EmptyState({ children }) {
  return <div className="card px-6 py-10 text-center text-sm leading-6 opacity-65">{children}</div>
}

export default function WatchPage() {
  const { data, loading, error } = useAsync(endpoints.streamItems, [])
  const liveItems = data?.filter((item) => item.kind === 'live') || []
  const recordings = data?.filter((item) => item.kind === 'recording') || []

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:px-6">
      <header className="relative isolate overflow-hidden rounded-[2rem] bg-ink-900 px-6 py-12 text-center text-white sm:px-12 sm:py-16">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gold-500/20 via-ink-900 to-ink-950" />
        <p className="text-xs font-bold uppercase tracking-[.2em] text-gold-300">Join us from wherever you are</p>
        <h1 className="mt-4 font-display text-3xl font-semibold sm:text-5xl">Live streaming &amp; videos</h1>
        <p className="mx-auto mt-4 max-w-xl leading-7 text-white/70">Join a live church gathering online or watch a service recording.</p>
      </header>

      <nav aria-label="Feed sections" className="flex flex-wrap gap-2">
        <Link to="/events" className="btn-ghost">Events</Link>
        <Link to="/feed" className="btn-ghost">Announcements</Link>
        <Link to="/watch" aria-current="page" className="btn-primary">Live streaming &amp; videos</Link>
        <Link to="/notices" className="btn-ghost">Notice board</Link>
        <Link to="/documents" className="btn-ghost">Documents</Link>
      </nav>

      {loading && <div role="status" className="card p-6 text-sm opacity-65">Loading streams and videos…</div>}
      {error && <p role="alert" className="card p-6 text-rose-600">Could not load streams and videos: {error.message}</p>}
      {!loading && !error && data?.length === 0 && (
        <EmptyState>There are no live streams or video recordings posted yet. Please check back soon.</EmptyState>
      )}
      {!loading && !error && data?.length > 0 && (
        <>
          <section aria-labelledby="live-gatherings-heading" className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-gold-700 dark:text-gold-300">Worship together</p>
              <h2 id="live-gatherings-heading" className="mt-1 font-display text-2xl font-semibold">Live gatherings</h2>
            </div>
            {liveItems.length
              ? <div className="space-y-4">{liveItems.map((item) => <StreamCard key={item.id} item={item} live />)}</div>
              : <EmptyState>No live meetings are listed right now. Check the announcements for service updates.</EmptyState>}
          </section>

          <section aria-labelledby="recordings-heading" className="space-y-4 border-t border-ink-900/10 pt-8 dark:border-white/10">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] opacity-50">Watch again</p>
              <h2 id="recordings-heading" className="mt-1 font-display text-2xl font-semibold">Video recordings</h2>
            </div>
            {recordings.length
              ? <div className="space-y-4">{recordings.map((item) => <StreamCard key={item.id} item={item} />)}</div>
              : <EmptyState>No recordings have been added yet.</EmptyState>}
          </section>
        </>
      )}

      <Link to="/" className="inline-flex text-sm font-semibold text-gold-700 hover:underline dark:text-gold-300">← Back home</Link>
    </main>
  )
}
