import { Link } from 'react-router-dom'

const services = [
  { day: 'Wednesday', name: 'Beholding Jesus', time: '6:00 PM' },
  { day: 'Friday', name: 'Friends of God Service', time: '6:00 PM' },
  { day: 'Sunday', name: 'Kings and Priests Service', time: '8:00 AM' },
]

const mapUrl = 'https://www.google.com/maps/search/?api=1&query=University+of+Ghana+Miracle+Centre'

export default function Footer() {
  return (
    <footer className="bg-ink-950 text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.2fr_.7fr_1fr_1.2fr] lg:gap-12">
        <div>
          <Link to="/" className="inline-flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white">
              <img src="/branding/ChurchLogo.png" alt="" className="h-10 w-10 object-contain" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-lg font-bold">Honour Nation Church</span>
              <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[.17em] text-gold-300">
                Worship · Fellowship · Community
              </span>
            </span>
          </Link>
          <p className="mt-5 max-w-sm text-sm leading-6 text-white/65">
            A family of believers after God’s heart, passionate about worship, fellowship, and spreading the good news.
          </p>
        </div>

        <nav aria-label="Footer navigation">
          <h2 className="text-xs font-bold uppercase tracking-[.2em] text-gold-300">Explore</h2>
          <ul className="mt-5 space-y-3 text-sm text-white/70">
            <li><Link className="transition hover:text-white" to="/">Home</Link></li>
            <li><Link className="transition hover:text-white" to="/#about">About us</Link></li>
            <li><Link className="transition hover:text-white" to="/#services">Services</Link></li>
            <li><Link className="transition hover:text-white" to="/visit">Plan your visit</Link></li>
            <li><Link className="transition hover:text-white" to="/contact">Contact us</Link></li>
            <li><Link className="transition hover:text-white" to="/events">Events</Link></li>
            <li><Link className="transition hover:text-white" to="/feed">Announcements</Link></li>
            <li><Link className="transition hover:text-white" to="/watch">Live streaming &amp; videos</Link></li>
            <li><Link className="transition hover:text-white" to="/notices">Notice board</Link></li>
            <li><Link className="transition hover:text-white" to="/documents">Documents</Link></li>
            <li><Link className="transition hover:text-white" to="/gallery">Gallery</Link></li>
          </ul>
        </nav>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-[.2em] text-gold-300">Visit us</h2>
          <a
            href={mapUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-5 flex max-w-xs items-start gap-3 text-sm leading-6 text-white/70 transition hover:text-white"
          >
            <svg className="mt-1 h-5 w-5 shrink-0 text-gold-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
            <span>University of Ghana Miracle Centre</span>
          </a>
          <Link to="/contact" className="mt-5 inline-flex text-sm font-semibold text-gold-300 transition hover:text-white">Contact &amp; directions <span className="ml-2" aria-hidden>→</span></Link>
        </div>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-[.2em] text-gold-300">Service schedule</h2>
          <ul className="mt-5 space-y-3">
            {services.map((service) => (
              <li key={service.day} className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[.14em] text-gold-300">{service.name}</p>
                    <p className="mt-2 text-sm font-semibold text-white">{service.day}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/80">{service.time}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs font-medium text-white/45 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} Honour Nation Church. All rights reserved.</span>
          <span>University of Ghana Miracle Centre</span>
        </div>
      </div>
    </footer>
  )
}
