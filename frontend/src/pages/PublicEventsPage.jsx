import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { endpoints } from '../api/client'
import { useAsync } from '../hooks/useAsync'

function formatEventDate(event, options = { day: 'numeric', month: 'long', year: 'numeric' }) {
  const start = new Date(`${event.start_date}T00:00:00`)
  const end = event.end_date ? new Date(`${event.end_date}T00:00:00`) : null
  if (!end || event.end_date === event.start_date) return start.toLocaleDateString(undefined, options)
  return `${start.toLocaleDateString(undefined, options)} – ${end.toLocaleDateString(undefined, options)}`
}

function formatTime(value) {
  if (!value) return null
  return new Date(`2000-01-01T${value}`).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function EventCard({ event }) {
  const eventDate = new Date(`${event.start_date}T00:00:00`)
  const time = event.start_time
    ? `${formatTime(event.start_time)}${event.end_time ? ` – ${formatTime(event.end_time)}` : ''}`
    : null

  return (
    <article id={`event-${event.id}`} className="card group scroll-mt-28 overflow-hidden transition hover:-translate-y-1 hover:shadow-xl">
      <Link to={`/events/programs/${event.id}`} className="block">
        {event.poster_url ? (
          <img src={event.poster_url} alt={`Poster for ${event.title}`} loading="lazy" decoding="async" className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.02]" />
        ) : (
          <div className="flex aspect-[16/10] items-center justify-center bg-gradient-to-br from-ink-900 via-ink-800 to-ink-700 text-white dark:from-ink-800 dark:via-ink-700 dark:to-ink-900">
            <div className="text-center">
              <span className="block text-xs font-bold uppercase tracking-[.2em] text-gold-300">
                {eventDate.toLocaleDateString(undefined, { month: 'long' })}
              </span>
              <span className="mt-1 block font-display text-6xl font-semibold">{eventDate.getDate()}</span>
              <span className="mt-1 block text-sm text-white/65">{eventDate.getFullYear()}</span>
            </div>
          </div>
        )}
        <div className="space-y-3 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-gold-700 dark:text-gold-300">{formatEventDate(event)}</p>
          <h3 className="font-display text-xl font-semibold leading-snug">{event.title}</h3>
          {event.description && <p className="line-clamp-3 whitespace-pre-wrap text-sm leading-6 opacity-70">{event.description}</p>}
          <div className="space-y-1 border-t border-ink-900/10 pt-3 text-sm opacity-65 dark:border-white/10">
            {time && <p>{time}</p>}
            {event.venue && <p className="truncate">{event.venue}</p>}
          </div>
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-gold-700 dark:text-gold-300">View event details <span aria-hidden>→</span></span>
        </div>
      </Link>
      {event.gallery_event_id && (
        <div className="border-t border-ink-900/10 px-5 pb-4 dark:border-white/10">
          <Link to={`/events/${event.gallery_event_id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-gold-700 hover:underline dark:text-gold-300">
            View {event.gallery_event_title ? `photos from ${event.gallery_event_title}` : 'event photos'} <span aria-hidden>→</span>
          </Link>
        </div>
      )}
    </article>
  )
}

function EmptyState({ title, children }) {
  return (
    <div className="rounded-3xl border border-dashed border-ink-900/15 bg-white/40 px-6 py-14 text-center dark:border-white/15 dark:bg-white/[.02]">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gold-500/10 text-2xl text-gold-700 dark:text-gold-300" aria-hidden>▦</span>
      <h3 className="mt-4 font-display text-xl font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 opacity-65">{children}</p>
    </div>
  )
}

export default function PublicEventsPage() {
  const { data, loading, error } = useAsync(endpoints.programEvents, [])
  const [pastYear, setPastYear] = useState('all')
  const today = new Date().toISOString().slice(0, 10)

  const { upcoming, past, years, months } = useMemo(() => {
    const allEvents = data || []
    const upcomingEvents = allEvents
      .filter((event) => (event.end_date || event.start_date) >= today)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
    const pastEvents = allEvents
      .filter((event) => (event.end_date || event.start_date) < today)
      .sort((a, b) => b.start_date.localeCompare(a.start_date))
    const eventYears = [...new Set(pastEvents.map((event) => event.start_date.slice(0, 4)))].sort().reverse()
    const monthGroups = [...new Set(upcomingEvents.map((event) => event.start_date.slice(0, 7)))]
      .map((month) => ({
        key: month,
        label: new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
        events: upcomingEvents.filter((event) => event.start_date.startsWith(month)),
      }))
    return { upcoming: upcomingEvents, past: pastEvents, years: eventYears, months: monthGroups }
  }, [data, today])

  const filteredPast = pastYear === 'all' ? past : past.filter((event) => event.start_date.startsWith(pastYear))

  return (
    <main className="mx-auto max-w-7xl space-y-14 px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-ink-900 px-6 py-16 text-center text-white shadow-2xl sm:px-12 sm:py-24">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gold-500/20 via-ink-900 to-ink-950" />
        <p className="inline-flex items-center gap-2 rounded-full border border-gold-300/30 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[.2em] text-gold-300">
          Gather, worship, and grow
        </p>
        <h1 className="mx-auto mt-6 max-w-4xl font-display text-4xl font-semibold tracking-tight sm:text-6xl">Events &amp; programmes</h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
          Find a gathering to look forward to, and revisit the moments we have shared as a church family.
        </p>
        <a href="#upcoming-events" className="btn-primary mt-8 !px-5 !py-3">Explore upcoming events <span aria-hidden>↓</span></a>
        <div className="pointer-events-none absolute -bottom-5 left-0 right-0 h-10 rounded-[50%] bg-paper-50 dark:bg-ink-950" />
      </section>

      <section aria-labelledby="event-discovery-title" className="text-center">
        <h2 id="event-discovery-title" className="font-display text-3xl font-semibold sm:text-4xl">Event discovery</h2>
        <p className="mt-3 text-sm opacity-65">Explore upcoming gatherings and moments from our church journey.</p>
      </section>

      {error && <p role="alert" className="card p-6 text-rose-600">Could not load events: {error.message}</p>}
      {loading && <div role="status" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="card aspect-[4/5] animate-pulse" />)}</div>}

      {!loading && !error && (
        <>
          <section id="upcoming-events" className="scroll-mt-24 space-y-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-gold-700 dark:text-gold-300">Happening soon</p>
                <h2 className="font-display text-3xl font-semibold">Upcoming events</h2>
              </div>
              {upcoming.length > 0 && <span className="text-sm opacity-60">{upcoming.length} {upcoming.length === 1 ? 'gathering' : 'gatherings'}</span>}
            </div>

            {upcoming.length === 0 ? (
              <EmptyState title="Stay tuned for more!">
                The church is preparing upcoming gatherings. Check back soon to see what’s next in our church life.
              </EmptyState>
            ) : (
              <>
                <nav aria-label="Upcoming event timeline" className="flex gap-3 overflow-x-auto pb-2">
                  {months.map((month) => (
                    <a key={month.key} href={`#event-${month.events[0].id}`} className="shrink-0 rounded-2xl border border-ink-900/10 bg-white/60 px-4 py-3 text-sm font-semibold transition hover:border-gold-500/50 dark:border-white/10 dark:bg-white/5">
                      <span className="block text-[10px] uppercase tracking-[.15em] opacity-50">{month.label}</span>
                      <span className="mt-1 block">{month.events.length} {month.events.length === 1 ? 'event' : 'events'}</span>
                    </a>
                  ))}
                </nav>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {upcoming.map((event) => <EventCard key={event.id} event={event} />)}
                </div>
              </>
            )}
          </section>

          <section id="past-events" className="scroll-mt-24 space-y-7 border-t border-ink-900/10 pt-10 dark:border-white/10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[.2em] opacity-50">Archive</p>
                <h2 className="font-display text-3xl font-semibold">Past events</h2>
              </div>
              {years.length > 1 && (
                <div className="w-40">
                  <label className="sr-only" htmlFor="past-event-year">Filter past events by year</label>
                  <select id="past-event-year" className="input" value={pastYear} onChange={(e) => setPastYear(e.target.value)}>
                    <option value="all">All years</option>
                    {years.map((year) => <option key={year} value={year}>{year}</option>)}
                  </select>
                </div>
              )}
            </div>
            {past.length === 0 ? (
              <EmptyState title="Our archive is just getting started.">
                Past gatherings will appear here after they have taken place.
              </EmptyState>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredPast.map((event) => <EventCard key={event.id} event={event} />)}
              </div>
            )}
          </section>
        </>
      )}
      <div className="text-center">
        <Link to="/feed" className="text-sm font-semibold text-gold-700 hover:underline dark:text-gold-300">Read church announcements <span aria-hidden>→</span></Link>
      </div>
    </main>
  )
}
