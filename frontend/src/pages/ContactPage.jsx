import { Link } from 'react-router-dom'

const services = [
  { day: 'Wednesday', name: 'Beholding Jesus', time: '6:00 PM' },
  { day: 'Friday', name: 'Friends of God Service', time: '6:00 PM' },
  { day: 'Sunday', name: 'Kings and Priests Service', time: '8:00 AM' },
]

const mapUrl = 'https://www.google.com/maps/search/?api=1&query=University+of+Ghana+Miracle+Centre'

export default function ContactPage() {
  return (
    <main className="space-y-14 px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <header className="relative isolate mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-ink-900 px-6 py-16 text-center text-white shadow-2xl sm:px-12 sm:py-24">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gold-500/20 via-ink-900 to-ink-950" />
        <p className="text-xs font-bold uppercase tracking-[.2em] text-gold-300">We’d love to see you</p>
        <h1 className="mx-auto mt-4 max-w-4xl font-display text-4xl font-semibold sm:text-6xl">Get in touch</h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
          Find Honour Nation Church and join us for worship, fellowship, and the Word.
        </p>
      </header>

      <section aria-labelledby="contact-location-title" className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2">
        <article className="card flex flex-col justify-center p-7 sm:p-10">
          <p className="mb-2 text-xs font-bold uppercase tracking-[.22em] text-gold-600 dark:text-gold-400">Our location</p>
          <h2 id="contact-location-title" className="font-display text-3xl font-semibold">Visit Honour Nation Church</h2>
          <p className="mt-4 leading-7 opacity-70">University of Ghana Miracle Centre</p>
          <a href={mapUrl} target="_blank" rel="noreferrer" className="btn-primary mt-7 w-fit !px-5 !py-3">
            Get directions <span aria-hidden>↗</span>
          </a>
        </article>

        <article className="card p-7 sm:p-10">
          <p className="mb-2 text-xs font-bold uppercase tracking-[.22em] text-gold-600 dark:text-gold-400">Gather with us</p>
          <h2 className="font-display text-2xl font-semibold">Weekly service times</h2>
          <ul className="mt-5 divide-y divide-ink-900/10 dark:divide-white/10">
            {services.map((service) => (
              <li key={service.day} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
                <div>
                  <p className="font-semibold">{service.day}</p>
                  <p className="mt-1 text-sm opacity-60">{service.name}</p>
                </div>
                <span className="rounded-full bg-gold-500/15 px-3 py-1.5 text-sm font-semibold text-gold-700 dark:text-gold-300">{service.time}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="mx-auto max-w-7xl rounded-[1.75rem] bg-ink-900 px-6 py-10 text-center text-white dark:bg-ink-800 sm:px-10 sm:py-14">
        <p className="text-xs font-bold uppercase tracking-[.22em] text-gold-300">Plan your visit</p>
        <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">There’s a place for you here.</h2>
        <p className="mx-auto mt-4 max-w-xl leading-7 text-white/70">
          New to the church? Find out what to expect and get the details you need before you join us.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link to="/visit" className="btn-primary !px-5 !py-3">Plan your visit <span aria-hidden>→</span></Link>
          <Link to="/events" className="btn-ghost border-white/30 bg-white/10 text-white hover:bg-white/20">View church events</Link>
        </div>
      </section>
    </main>
  )
}
