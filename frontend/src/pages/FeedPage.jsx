import { Link } from 'react-router-dom'
import { endpoints } from '../api/client'
import { useAsync } from '../hooks/useAsync'

export default function FeedPage() {
  const { data, loading, error } = useAsync(endpoints.announcements, [])

  return (
    <main className="mx-auto max-w-4xl space-y-7 px-4 py-10 sm:px-6">
      <header>
        <p className="mb-2 text-xs font-bold uppercase tracking-[.22em] text-gold-600 dark:text-gold-400">Stay connected</p>
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">Announcements</h1>
        <p className="mt-2 text-sm opacity-65">Announcements and news from Honour Nation Church.</p>
      </header>

      <nav aria-label="Feed sections" className="flex flex-wrap gap-2">
        <Link to="/events" className="btn-ghost">Events</Link>
        <Link to="/feed" aria-current="page" className="btn-primary">Announcements</Link>
        <Link to="/watch" className="btn-ghost">Live streaming &amp; videos</Link>
        <Link to="/notices" className="btn-ghost">Notice board</Link>
        <Link to="/documents" className="btn-ghost">Documents</Link>
      </nav>

      {loading && <div role="status" className="card p-6 text-sm opacity-65">Loading church updates…</div>}
      {error && <p role="alert" className="card p-6 text-rose-600">Could not load announcements: {error.message}</p>}
      {!loading && !error && data?.length === 0 && (
        <div className="card px-6 py-14 text-center">
          <h2 className="font-display text-2xl font-semibold">No updates just yet.</h2>
          <p className="mt-2 text-sm opacity-65">Please check back soon for news from the church.</p>
        </div>
      )}
      <div className="space-y-4">
        {data?.map((announcement) => (
          <article key={announcement.id} className="card p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              {announcement.is_pinned && <span className="rounded-full bg-gold-500/15 px-2.5 py-1 text-xs font-semibold text-gold-700 dark:text-gold-300">Pinned update</span>}
              <time className="text-xs font-semibold uppercase tracking-wider opacity-55" dateTime={announcement.published_at || announcement.updated_at}>
                {new Date(announcement.published_at || announcement.updated_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
              </time>
            </div>
            <h2 className="mt-3 font-display text-2xl font-semibold">{announcement.title}</h2>
            <p className="mt-3 whitespace-pre-wrap break-words leading-7 opacity-75">{announcement.content}</p>
          </article>
        ))}
      </div>
      <Link to="/" className="inline-flex text-sm font-semibold text-gold-700 hover:underline dark:text-gold-300">← Back home</Link>
    </main>
  )
}
