import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { endpoints } from '../api/client'
import { useAsync } from '../hooks/useAsync'

const categories = [
  ['all', 'All notices'],
  ['general', 'General'],
  ['service', 'Service information'],
  ['registration', 'Registration'],
  ['reminder', 'Reminders'],
]

const categoryLabels = Object.fromEntries(categories.filter(([key]) => key !== 'all'))

export default function NoticeBoardPage() {
  const { data, loading, error } = useAsync(endpoints.notices, [])
  const [category, setCategory] = useState('all')
  const filteredNotices = useMemo(
    () => (data || []).filter((notice) => category === 'all' || notice.category === category),
    [data, category],
  )

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
      <header className="relative isolate overflow-hidden rounded-[2rem] bg-ink-900 px-6 py-12 text-center text-white sm:px-12 sm:py-16">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gold-500/20 via-ink-900 to-ink-950" />
        <p className="text-xs font-bold uppercase tracking-[.2em] text-gold-300">Practical information for our church family</p>
        <h1 className="mt-4 font-display text-3xl font-semibold sm:text-5xl">Notice board</h1>
        <p className="mx-auto mt-4 max-w-xl leading-7 text-white/70">Service updates, registration details, and reminders from Honour Nation Church.</p>
      </header>

      <nav aria-label="Feed sections" className="flex flex-wrap gap-2">
        <Link to="/events" className="btn-ghost">Events</Link>
        <Link to="/feed" className="btn-ghost">Announcements</Link>
        <Link to="/watch" className="btn-ghost">Live streaming &amp; videos</Link>
        <Link to="/notices" aria-current="page" className="btn-primary">Notice board</Link>
        <Link to="/documents" className="btn-ghost">Documents</Link>
      </nav>

      {!loading && !error && data?.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter notices by category">
          {categories.map(([key, label]) => (
            <button key={key} type="button" aria-pressed={category === key}
              onClick={() => setCategory(key)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${category === key ? 'border-gold-500 bg-gold-500 text-ink-950' : 'border-ink-900/10 bg-white/60 opacity-70 hover:opacity-100 dark:border-white/10 dark:bg-white/5'}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {loading && <div role="status" className="card p-6 text-sm opacity-65">Loading notices…</div>}
      {error && <p role="alert" className="card p-6 text-rose-600">Could not load notices: {error.message}</p>}
      {!loading && !error && data?.length === 0 && (
        <div className="card px-6 py-14 text-center">
          <h2 className="font-display text-2xl font-semibold">No notices right now.</h2>
          <p className="mt-2 text-sm opacity-65">Please check back for practical updates from the church.</p>
        </div>
      )}
      {!loading && !error && data?.length > 0 && filteredNotices.length === 0 && (
        <p className="card p-8 text-center text-sm opacity-65">There are no {categoryLabels[category]?.toLowerCase()} notices right now.</p>
      )}
      <div className="space-y-4">
        {filteredNotices.map((notice) => (
          <article key={notice.id} className="card p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-gold-500/15 px-2.5 py-1 text-xs font-semibold text-gold-700 dark:text-gold-300">{categoryLabels[notice.category]}</span>
              {notice.is_pinned && <span className="rounded-full bg-ink-900/10 px-2.5 py-1 text-xs font-semibold dark:bg-white/10">Important</span>}
              <time className="text-xs font-semibold uppercase tracking-wider opacity-50" dateTime={notice.updated_at}>
                Updated {new Date(notice.updated_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
              </time>
            </div>
            <h2 className="mt-3 font-display text-2xl font-semibold">{notice.title}</h2>
            <p className="mt-3 whitespace-pre-wrap break-words leading-7 opacity-75">{notice.content}</p>
            {notice.expires_on && (
              <p className="mt-4 border-t border-ink-900/10 pt-3 text-xs opacity-55 dark:border-white/10">
                Applies through {new Date(`${notice.expires_on}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </article>
        ))}
      </div>
      <Link to="/" className="inline-flex text-sm font-semibold text-gold-700 hover:underline dark:text-gold-300">← Back home</Link>
    </main>
  )
}
