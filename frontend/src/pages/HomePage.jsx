import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { endpoints } from '../api/client'
import { useAsync } from '../hooks/useAsync'

const heroSlides = [
  {
    image: 'IMG_1425',
    title: 'Welcome to Honour Nation Church',
    description: 'A family of believers after God’s heart. Passionate about worship, fellowship, and sharing the good news. There’s a place for you here.',
    action: 'Explore our gallery',
    href: '/gallery',
  },
  {
    image: 'IMG_1653',
    title: 'Worship together. Grow together.',
    description: 'Come as you are and join a church family growing in faith, love, and worship.',
    action: 'Learn about our church',
    href: '#about',
  },
  {
    image: 'IMG_1401',
    title: 'There’s a place for you this week.',
    description: 'Beholding Jesus on Wednesday, Friends of God on Friday, and Kings and Priests on Sunday.',
    action: 'See our service times',
    href: '#services',
  },
  {
    image: 'IMG_1778',
    title: 'Faith is better when shared.',
    description: 'Celebrate the joy, fellowship, and special moments of life at Honour Nation Church.',
    action: 'See life at Honour Nation',
    href: '/gallery',
  },
]

const services = [
  { day: 'Wednesday', name: 'Beholding Jesus', time: '6:00 PM' },
  { day: 'Friday', name: 'Friends of God Service', time: '6:00 PM' },
  { day: 'Sunday', name: 'Kings and Priests Service', time: '8:00 AM' },
]

export default function HomePage() {
  const feed = useAsync(endpoints.announcements, [])
  const eventFeed = useAsync(endpoints.programEvents, [])
  const streamFeed = useAsync(endpoints.streamItems, [])
  const today = new Date().toISOString().slice(0, 10)
  const nextEvent = eventFeed.data
    ?.filter((event) => (event.end_date || event.start_date) >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0]
  const liveStream = streamFeed.data?.find((item) => item.kind === 'live')
  const [activeSlide, setActiveSlide] = useState(0)
  const [typedTitle, setTypedTitle] = useState('')
  const [typedDescription, setTypedDescription] = useState('')
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const currentSlide = heroSlides[activeSlide]

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = (event) => setReducedMotion(event.matches)
    preference.addEventListener('change', updatePreference)
    return () => preference.removeEventListener('change', updatePreference)
  }, [])

  useEffect(() => {
    const slide = heroSlides[activeSlide]
    if (reducedMotion) {
      setTypedTitle(slide.title)
      setTypedDescription(slide.description)
      return undefined
    }

    let titleIndex = 0
    let descriptionIndex = 0
    let timer
    setTypedTitle('')
    setTypedDescription('')

    function typeTitle() {
      titleIndex += 1
      setTypedTitle(slide.title.slice(0, titleIndex))
      if (titleIndex < slide.title.length) {
        timer = window.setTimeout(typeTitle, 42)
      } else {
        timer = window.setTimeout(typeDescription, 280)
      }
    }

    function typeDescription() {
      descriptionIndex += 1
      setTypedDescription(slide.description.slice(0, descriptionIndex))
      if (descriptionIndex < slide.description.length) {
        timer = window.setTimeout(typeDescription, 19)
      }
    }

    typeTitle()
    return () => window.clearTimeout(timer)
  }, [activeSlide, reducedMotion])

  useEffect(() => {
    if (paused || hovered || focused || reducedMotion) return undefined
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length)
    }, Math.max(
      7000,
      5000 + currentSlide.title.length * 42 + currentSlide.description.length * 19,
    ))
    return () => window.clearInterval(timer)
  }, [activeSlide, currentSlide, paused, hovered, focused, reducedMotion])

  function showSlide(index) {
    setActiveSlide((index + heroSlides.length) % heroSlides.length)
  }

  return (
    <main className="space-y-20 px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <section
        className="relative isolate mx-auto flex min-h-[560px] max-w-7xl flex-col justify-between overflow-hidden rounded-[2rem] bg-ink-900 text-white shadow-2xl shadow-ink-900/15 dark:bg-ink-800 sm:min-h-[600px]"
        aria-label="Welcome to Honour Nation Church"
        aria-roledescription="carousel"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
        }}
      >
        <div className="absolute inset-0 -z-20 bg-ink-950">
          {heroSlides.map((slide, index) => (
            <img
              key={slide.image}
              src={`/home/optimized/${slide.image}.webp`}
              alt=""
              aria-hidden="true"
              fetchpriority={index === 0 ? 'high' : 'auto'}
              loading={index === 0 ? 'eager' : 'lazy'}
              className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700 ${index === activeSlide ? 'opacity-100' : 'opacity-0'}`}
            />
          ))}
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink-950/90 via-ink-950/65 to-ink-950/25" />
        <div
          key={currentSlide.image}
          className="max-w-4xl px-7 pb-10 pt-20 sm:px-12 sm:pb-12 lg:px-16 lg:pt-28"
          role="group"
          aria-roledescription="slide"
          aria-label={`${activeSlide + 1} of ${heroSlides.length}`}
        >
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold-300/40 bg-ink-950/30 px-3 py-1.5 text-xs font-bold uppercase tracking-[.2em] text-gold-300 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-300" />
            Honour Nation Church
          </p>
          <h1
            className="max-w-4xl font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-7xl"
          >
            <span className="sr-only">{currentSlide.title}</span>
            <span aria-hidden="true">{typedTitle}</span>
          </h1>
          <p
            className="mt-6 max-w-2xl text-base leading-7 text-white/80 sm:text-lg"
          >
            <span className="sr-only">{currentSlide.description}</span>
            <span aria-hidden="true">{typedDescription}</span>
            {!reducedMotion && <span className="hero-typing-cursor" aria-hidden="true" />}
          </p>
          <div className="mt-9">
            {currentSlide.href.startsWith('#') ? (
              <a href={currentSlide.href} className="btn-primary !px-5 !py-3">
                {currentSlide.action} <span aria-hidden>→</span>
              </a>
            ) : (
              <Link to={currentSlide.href} className="btn-primary !px-5 !py-3">
                {currentSlide.action} <span aria-hidden>→</span>
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/15 bg-ink-950/20 px-5 py-4 backdrop-blur-sm sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[.15em] text-white/70">University of Ghana Miracle Centre</p>
          <div className="flex items-center gap-2" aria-label="Hero slide controls">
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-lg text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
              onClick={() => showSlide(activeSlide - 1)}
              aria-label="Previous slide"
            >
              <span aria-hidden>‹</span>
            </button>
            {heroSlides.map((slide, index) => (
              <button
                key={slide.image}
                type="button"
                className={`h-2.5 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 ${index === activeSlide ? 'w-7 bg-gold-300' : 'w-2.5 bg-white/45 hover:bg-white/75'}`}
                onClick={() => showSlide(index)}
                aria-label={`Show slide ${index + 1}: ${slide.title}`}
                aria-current={index === activeSlide ? 'true' : undefined}
              />
            ))}
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-lg text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
              onClick={() => showSlide(activeSlide + 1)}
              aria-label="Next slide"
            >
              <span aria-hidden>›</span>
            </button>
            <button
              type="button"
              className="ml-1 rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
              onClick={() => setPaused((value) => !value)}
              aria-pressed={paused}
            >
              {paused ? 'Play' : 'Pause'}
            </button>
          </div>
        </div>
      </section>

      <section id="services" className="mx-auto max-w-7xl scroll-mt-28">
        <div className="mb-8 max-w-2xl">
          <p className="mb-2 text-xs font-bold uppercase tracking-[.22em] text-gold-600 dark:text-gold-400">Come worship with us</p>
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">There’s a place for you this week.</h2>
          <p className="mt-3 leading-7 opacity-70">Join us at the University of Ghana Miracle Centre for worship, fellowship, and the Word.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {services.map((service) => (
            <article key={service.day} className="card p-6 sm:p-7">
              <p className="text-xs font-bold uppercase tracking-[.18em] text-gold-600 dark:text-gold-400">{service.day}</p>
              <h3 className="mt-3 font-display text-2xl font-semibold">{service.name}</h3>
              <p className="mt-4 flex items-center gap-2 text-sm font-semibold opacity-70">
                <span aria-hidden>◷</span>{service.time}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="upcoming-gathering-title" className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[.22em] text-gold-600 dark:text-gold-400">Mark your calendar</p>
            <h2 id="upcoming-gathering-title" className="font-display text-3xl font-semibold sm:text-4xl">Upcoming gathering</h2>
          </div>
          <Link to="/events" className="text-sm font-semibold text-gold-700 hover:underline dark:text-gold-300">Explore all events <span aria-hidden>→</span></Link>
        </div>
        {eventFeed.error && <p role="alert" className="text-sm text-rose-600">Could not load upcoming events: {eventFeed.error.message}</p>}
        {!eventFeed.loading && !eventFeed.error && !nextEvent && (
          <div className="card p-6 text-sm opacity-65">No upcoming events have been announced yet. Please check back soon.</div>
        )}
        {nextEvent && (
          <Link to={`/events/programs/${nextEvent.id}`} className="card group grid overflow-hidden transition hover:shadow-xl md:grid-cols-[.8fr_1.2fr]">
            {nextEvent.poster_url
              ? <img src={nextEvent.poster_url} alt={`Poster for ${nextEvent.title}`} loading="lazy" className="aspect-[16/9] h-full w-full object-cover md:aspect-auto" />
              : <div className="grid min-h-48 place-items-center bg-gradient-to-br from-ink-900 via-ink-800 to-ink-700 text-white">
                  <div className="text-center"><p className="text-xs font-bold uppercase tracking-[.2em] text-gold-300">{new Date(`${nextEvent.start_date}T00:00:00`).toLocaleDateString(undefined, { month: 'long' })}</p><p className="font-display text-6xl font-semibold">{new Date(`${nextEvent.start_date}T00:00:00`).getDate()}</p></div>
                </div>}
            <div className="flex flex-col justify-center p-6 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-wider text-gold-700 dark:text-gold-300">
                {new Date(`${nextEvent.start_date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <h3 className="mt-3 font-display text-2xl font-semibold">{nextEvent.title}</h3>
              {nextEvent.venue && <p className="mt-2 text-sm opacity-65">{nextEvent.venue}</p>}
              {nextEvent.description && <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 opacity-70">{nextEvent.description}</p>}
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-gold-700 dark:text-gold-300">Event details <span aria-hidden>→</span></span>
              {nextEvent.gallery_event_id && <span className="mt-2 text-xs font-semibold text-gold-700 dark:text-gold-300">Photos from {nextEvent.gallery_event_title || 'this event'} are available</span>}
            </div>
          </Link>
        )}
      </section>

      <section aria-labelledby="latest-updates-title" className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[.22em] text-gold-600 dark:text-gold-400">From our church</p>
            <h2 id="latest-updates-title" className="font-display text-3xl font-semibold sm:text-4xl">Latest updates</h2>
          </div>
          <Link to="/feed" className="text-sm font-semibold text-gold-700 hover:underline dark:text-gold-300">View all updates <span aria-hidden>→</span></Link>
        </div>
        {feed.loading && <p role="status" className="text-sm opacity-60">Loading church updates…</p>}
        {feed.error && <p role="alert" className="text-sm text-rose-600">Could not load church updates: {feed.error.message}</p>}
        {!feed.loading && !feed.error && feed.data?.length === 0 && (
          <p className="card p-6 text-sm opacity-65">No announcements yet. Check back soon for updates from the church.</p>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          {feed.data?.slice(0, 3).map((announcement) => (
            <article key={announcement.id} className="card p-5">
              <time className="text-xs font-semibold uppercase tracking-wider opacity-55" dateTime={announcement.published_at || announcement.updated_at}>
                {new Date(announcement.published_at || announcement.updated_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
              </time>
              <h3 className="mt-3 font-display text-xl font-semibold">{announcement.title}</h3>
              <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-6 opacity-70">{announcement.content}</p>
              {announcement.is_pinned && <p className="mt-3 text-xs font-bold uppercase tracking-wider text-gold-700 dark:text-gold-300">Pinned update</p>}
            </article>
          ))}
        </div>
      </section>

      <section id="about" className="mx-auto grid max-w-7xl scroll-mt-28 items-center gap-8 lg:grid-cols-2 lg:gap-14">
        <div className="relative overflow-hidden rounded-[1.75rem]">
          <img
            src="/home/optimized/IMG_1424.webp"
            alt="Members of the Honour Nation Church community gathered together"
            loading="lazy"
            decoding="async"
            className="aspect-[4/3] h-full w-full object-cover"
          />
        </div>
        <div className="py-2">
          <p className="mb-2 text-xs font-bold uppercase tracking-[.22em] text-gold-600 dark:text-gold-400">Who we are</p>
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">Faith grows when we grow together.</h2>
          <p className="mt-5 leading-7 opacity-75">
            Honour Nation Church is a family of believers after God’s heart, passionate about worship,
            fellowship, and spreading the good news. We come together to behold Jesus, encourage one
            another, and share the hope of the Gospel.
          </p>
          <Link to="/gallery" className="btn-primary mt-7">See life in our church <span aria-hidden>→</span></Link>
        </div>
      </section>

      <section aria-labelledby="church-life-title" className="mx-auto max-w-7xl">
        <div className="mb-7 max-w-2xl">
          <p className="mb-2 text-xs font-bold uppercase tracking-[.22em] text-gold-600 dark:text-gold-400">Life at Honour Nation</p>
          <h2 id="church-life-title" className="font-display text-3xl font-semibold sm:text-4xl">Worship, fellowship, and growing together.</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { file: 'IMG_1653', alt: 'Church members worshipping together' },
            { file: 'IMG_1764', alt: 'A church member singing during worship' },
            { file: 'IMG_1801', alt: 'A church member praying with hands raised' },
          ].map((photo) => (
            <div key={photo.file} className="group overflow-hidden rounded-2xl">
              <img
                src={`/home/optimized/${photo.file}.webp`}
                alt={photo.alt}
                loading="lazy"
                decoding="async"
                className="aspect-[4/3] h-full w-full object-cover transition duration-700 group-hover:scale-105"
              />
            </div>
          ))}
        </div>
      </section>

      <section id="visit" className="mx-auto max-w-7xl scroll-mt-28">
        <div className="card grid gap-6 p-6 sm:p-9 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[.22em] text-gold-600 dark:text-gold-400">Plan your visit</p>
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">We’d love to welcome you.</h2>
            <p className="mt-3 leading-7 opacity-70">Find us at the University of Ghana Miracle Centre. Sunday service begins at 8:00 AM.</p>
            <Link to="/visit" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-gold-700 hover:underline dark:text-gold-300">
              First time? Plan your visit <span aria-hidden>→</span>
            </Link>
          </div>
          <a
            href="https://www.google.com/maps/search/?api=1&query=University+of+Ghana+Miracle+Centre"
            target="_blank"
            rel="noreferrer"
            className="btn-primary whitespace-nowrap"
          >
            Find us on the map <span aria-hidden>↗</span>
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-7xl rounded-[1.75rem] bg-ink-900 px-6 py-10 text-center text-white dark:bg-ink-800 sm:px-10 sm:py-14">
        <p className="text-xs font-bold uppercase tracking-[.22em] text-gold-300">Stay connected</p>
        <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">Come as you are. Grow with us.</h2>
        <p className="mx-auto mt-4 max-w-xl leading-7 text-white/70">Join a church gathering online, watch a service recording, or explore moments from our community.</p>
        {streamFeed.error && <p role="alert" className="mt-3 text-sm text-rose-200">Could not load live streaming links: {streamFeed.error.message}</p>}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {liveStream && (
            <a href={liveStream.url} target="_blank" rel="noopener noreferrer" className="btn-primary !px-5 !py-3">
              Join {liveStream.provider === 'zoom' ? 'on Zoom' : `on ${liveStream.provider}`} <span aria-hidden>↗</span>
            </a>
          )}
          <Link to="/watch" className={liveStream ? 'btn-ghost border-white/30 bg-white/10 text-white hover:bg-white/20' : 'btn-primary !px-5 !py-3'}>
            Live streaming &amp; videos
          </Link>
          <Link to="/gallery" className="btn-ghost border-white/30 bg-white/10 text-white hover:bg-white/20">Visit the gallery</Link>
        </div>
      </section>

    </main>
  )
}
