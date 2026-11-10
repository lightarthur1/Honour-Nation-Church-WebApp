import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { endpoints } from '../api/client'
import EventCard from '../components/gallery/EventCard'
import PhotoSearch from '../components/gallery/PhotoSearch'
import { useAuth } from '../context/AuthContext'
import { useAsync } from '../hooks/useAsync'

const featuredPhotos = [
  'IMG_1098.webp',
  'IMG_1283.webp',
  'IMG_1305.webp',
  'IMG_1310.webp',
  'IMG_1361.webp',
  'IMG_1424.webp',
  'IMG_1422.webp',
  'IMG_1425.webp',
  'IMG_1644.webp',
  'IMG_1898.webp',
]

export default function PublicGallery() {
  const { user } = useAuth()
  const { data, loading, error } = useAsync(endpoints.galleryEvents, [user?.id])
  const [query, setQuery] = useState('')
  const [year, setYear] = useState('all')

  const years = useMemo(
    () => [...new Set((data || []).map((event) => event.event_date.slice(0, 4)))].sort().reverse(),
    [data],
  )
  const filteredEvents = useMemo(() => {
    const search = query.trim().toLowerCase()
    return (data || []).filter((event) => {
      const matchesSearch = !search || `${event.title} ${event.description || ''}`.toLowerCase().includes(search)
      const matchesYear = year === 'all' || event.event_date.startsWith(year)
      return matchesSearch && matchesYear
    })
  }, [data, query, year])

  return (
    <main className="mx-auto max-w-7xl space-y-14 px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-ink-900 text-white shadow-2xl shadow-ink-900/15 dark:bg-ink-800">
        <img src="/featured/optimized/IMG_1098.webp" alt="" fetchpriority="high" className="absolute inset-0 -z-20 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink-950/95 via-ink-950/75 to-ink-950/15" />
        <div className="grid min-h-[440px] items-center gap-10 p-7 sm:p-10 lg:grid-cols-[1.15fr_.85fr] lg:p-14">
          <div className="max-w-2xl animate-rise">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold-300/40 bg-ink-950/30 px-3 py-1.5 text-xs font-bold uppercase tracking-[.2em] text-gold-300 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-300" />
              Honour Nation Church
            </p>
            <h1 className="font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Faith, family, and the moments we share.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/75 sm:text-base">
              Revisit the joy of worship, fellowship, and every special gathering in our church family.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#event-galleries" className="btn-primary !px-5 !py-3">Explore the galleries <span aria-hidden>↓</span></a>
              {!user && <Link to="/login" className="btn-ghost border-white/30 bg-white/10 text-white hover:bg-white/20">Sign in for downloads</Link>}
            </div>
          </div>
          <div className="hidden h-[310px] grid-cols-5 grid-rows-2 gap-3 lg:grid">
            {featuredPhotos.slice(1, 5).map((photo, index) => (
              <div key={photo} className={`overflow-hidden rounded-2xl border border-white/20 shadow-xl ${index === 0 ? 'col-span-3 row-span-2' : 'col-span-2'}`}>
                <img src={`/featured/optimized/${photo}`} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-700 hover:scale-105" />
              </div>
            ))}
          </div>
          <p className="absolute bottom-4 right-5 text-[10px] font-semibold uppercase tracking-[.2em] text-white/60 lg:bottom-6 lg:right-8">
            A living collection of our church family
          </p>
        </div>
      </section>

      <PhotoSearch />

      <section aria-label="Featured church moments" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {featuredPhotos.slice(4).map((photo, index) => (
          <div key={photo} className={`group relative aspect-[4/3] overflow-hidden rounded-2xl ${index === 1 ? 'sm:col-span-2 sm:row-span-2 sm:aspect-auto' : ''}`}>
            <img src={`/featured/optimized/${photo}`} alt="A moment from the Honour Nation Church community" loading="lazy" decoding="async"
              className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
            {index === 1 && <div className="absolute inset-0 bg-gradient-to-t from-ink-950/65 via-transparent to-transparent" />}
            {index === 1 && <p className="absolute bottom-4 left-4 font-display text-lg font-semibold text-white sm:bottom-6 sm:left-6 sm:text-2xl">Together in faith</p>}
          </div>
        ))}
      </section>

      <section id="event-galleries" className="scroll-mt-24">
        <div className="mb-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[.22em] text-gold-600 dark:text-gold-400">Keep the memories close</p>
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">Recent galleries</h2>
            <p className="mt-2 text-sm opacity-65">Browse the moments and celebrations shared by our church.</p>
          </div>
          {data?.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_150px] md:min-w-[390px]">
              <label className="sr-only" htmlFor="gallery-search">Search galleries</label>
              <input id="gallery-search" className="input" type="search" placeholder="Search events…" value={query} onChange={(e) => setQuery(e.target.value)} />
              <label className="sr-only" htmlFor="gallery-year">Filter by year</label>
              <select id="gallery-year" className="input" value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="all">All years</option>
                {years.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
          )}
        </div>

        {loading && <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="card aspect-[4/3] animate-pulse" />)}</div>}
        {error && <p role="alert" className="card p-6 text-rose-600">Could not load galleries: {error.message}</p>}
        {!loading && !error && data?.length === 0 && (
          <div className="card px-6 py-14 text-center">
            <p className="font-display text-2xl font-semibold">The next memory is just around the corner.</p>
            <p className="mt-2 text-sm opacity-65">No galleries have been published yet. Check back soon.</p>
          </div>
        )}
        {!loading && !error && data?.length > 0 && filteredEvents.length === 0 && (
          <div className="card px-6 py-12 text-center">
            <p className="font-display text-xl font-semibold">No galleries match those filters.</p>
            <button type="button" className="btn-ghost mt-4" onClick={() => { setQuery(''); setYear('all') }}>Clear search</button>
          </div>
        )}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((e, i) => <EventCard key={e.id} event={e} user={user} index={i} />)}
        </div>
      </section>
    </main>
  )
}
