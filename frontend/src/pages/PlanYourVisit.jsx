import { Link } from 'react-router-dom'

const services = [
  { day: 'Wednesday', name: 'Beholding Jesus', time: '6:00 PM' },
  { day: 'Friday', name: 'Friends of God Service', time: '6:00 PM' },
  { day: 'Sunday', name: 'Kings and Priests Service', time: '8:00 AM' },
]

const mapUrl = 'https://www.google.com/maps/search/?api=1&query=University+of+Ghana+Miracle+Centre'

export default function PlanYourVisit() {
  return (
    <main className="space-y-14 px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <header className="relative isolate mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-ink-900 px-6 py-16 text-center text-white shadow-2xl sm:px-12 sm:py-24">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gold-500/20 via-ink-900 to-ink-950" />
        <p className="text-xs font-bold uppercase tracking-[.2em] text-gold-300">You’re welcome here</p>
        <h1 className="mx-auto mt-4 max-w-4xl font-display text-4xl font-semibold sm:text-6xl">Plan your visit</h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
          We’d love to welcome you to Honour Nation Church for worship, fellowship, and the Word.
        </p>
        <a href="#service-times" className="btn-primary mt-8 !px-5 !py-3">See service times <span aria-hidden>↓</span></a>
      </header>

      <section id="service-times" aria-labelledby="service-times-title" className="mx-auto max-w-7xl scroll-mt-28">
        <div className="mb-8 max-w-2xl">
          <p className="mb-2 text-xs font-bold uppercase tracking-[.22em] text-gold-600 dark:text-gold-400">Join us this week</p>
          <h2 id="service-times-title" className="font-display text-3xl font-semibold sm:text-4xl">Our service times</h2>
          <p className="mt-3 leading-7 opacity-70">Choose a gathering that works for you. We look forward to worshipping together.</p>
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

      <section aria-labelledby="find-us-title" className="mx-auto grid max-w-7xl gap-6 md:grid-cols-[1.1fr_.9fr]">
        <article className="card flex flex-col justify-center p-7 sm:p-10">
          <p className="mb-2 text-xs font-bold uppercase tracking-[.22em] text-gold-600 dark:text-gold-400">Find us</p>
          <h2 id="find-us-title" className="font-display text-3xl font-semibold">We meet at the University of Ghana Miracle Centre.</h2>
          <p className="mt-4 max-w-xl leading-7 opacity-70">Use the directions link to view the location in Google Maps and plan your route.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href={mapUrl} target="_blank" rel="noreferrer" className="btn-primary !px-5 !py-3">
              Get directions <span aria-hidden>↗</span>
            </a>
            <Link to="/events" className="btn-ghost !px-5 !py-3">Explore church events</Link>
          </div>
        </article>
        <article className="relative isolate flex min-h-64 flex-col justify-end overflow-hidden rounded-3xl bg-gradient-to-br from-ink-900 via-ink-800 to-ink-700 p-7 text-white sm:p-10">
          <div className="absolute right-8 top-8 grid h-16 w-16 place-items-center rounded-full border border-gold-300/30 bg-gold-300/10 text-gold-300">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-8 w-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
          </div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-gold-300">Honour Nation Church</p>
          <h2 className="mt-3 max-w-sm font-display text-2xl font-semibold">University of Ghana Miracle Centre</h2>
          <a href={mapUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex w-fit items-center gap-2 text-sm font-semibold text-gold-300 hover:underline">
            Open location in Maps <span aria-hidden>↗</span>
          </a>
        </article>
      </section>

      <section aria-labelledby="first-visit-title" className="mx-auto max-w-7xl">
        <div className="card grid gap-8 p-7 sm:p-10 md:grid-cols-[.8fr_1.2fr] md:items-center">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[.22em] text-gold-600 dark:text-gold-400">Your first time?</p>
            <h2 id="first-visit-title" className="font-display text-3xl font-semibold">Come as you are.</h2>
          </div>
          <div>
            <p className="leading-7 opacity-75">
              Expect a time of worship, fellowship, and teaching from the Word. Whether you’re visiting for the first time or looking for a church community, you’re welcome to join us.
            </p>
            <p className="mt-4 text-sm leading-6 opacity-60">Service times and location are listed above. We’ll share more visitor information here as it becomes available.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl rounded-[1.75rem] bg-ink-900 px-6 py-10 text-center text-white dark:bg-ink-800 sm:px-10 sm:py-14">
        <p className="text-xs font-bold uppercase tracking-[.22em] text-gold-300">We hope to see you</p>
        <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">There’s a place for you this week.</h2>
        <p className="mx-auto mt-4 max-w-xl leading-7 text-white/70">Take a look at our upcoming gatherings and find a time to join the church family.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <a href={mapUrl} target="_blank" rel="noreferrer" className="btn-primary !px-5 !py-3">Get directions <span aria-hidden>↗</span></a>
          <Link to="/events" className="btn-ghost border-white/30 bg-white/10 text-white hover:bg-white/20">View upcoming events</Link>
        </div>
      </section>
    </main>
  )
}
