import { Link } from 'react-router-dom'
import LazyImage from './LazyImage'
import StatusBadge from '../ui/StatusBadge'

export default function EventCard({ event, user, index = 0 }) {
  const date = new Date(event.event_date + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  return (
    <Link to={`/events/${event.id}`} style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
      className="card group block animate-rise overflow-hidden transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-gold-500/10">
      <div className="relative overflow-hidden">
        <LazyImage src={event.cover_url} alt={event.title} className="aspect-[4/3] transition duration-700 group-hover:scale-105" width={4} height={3} />
        <span className="absolute bottom-3 left-3 rounded-full bg-ink-950/75 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
          {event.image_count} {event.image_count === 1 ? 'photo' : 'photos'}
        </span>
      </div>
      <div className="space-y-2.5 p-4 sm:p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-gold-600 dark:text-gold-400">{date}</p>
        <h3 className="font-display text-xl font-bold leading-snug">{event.title}</h3>
        <div className="flex items-center justify-between gap-2 border-t border-ink-900/10 pt-3 dark:border-white/10">
          <span className="text-sm font-semibold text-ink-700 transition group-hover:text-gold-600 dark:text-paper-100 dark:group-hover:text-gold-300">View gallery <span aria-hidden>→</span></span>
          {user && <StatusBadge status={event.access_status} />}
        </div>
      </div>
    </Link>
  )
}
