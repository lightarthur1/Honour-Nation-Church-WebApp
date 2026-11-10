import { useState } from 'react'
import { endpoints } from '../../api/client'
import { useAsync } from '../../hooks/useAsync'
import { useToast } from '../ui/Toast'

const initialForm = {
  title: '',
  description: '',
  start_date: '',
  end_date: '',
  start_time: '',
  end_time: '',
  venue: 'University of Ghana Miracle Centre',
  status: 'draft',
  gallery_event_id: '',
}

function formatDate(event) {
  const start = new Date(`${event.start_date}T00:00:00`)
  const end = event.end_date ? new Date(`${event.end_date}T00:00:00`) : null
  const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' }
  if (!end || event.end_date === event.start_date) return start.toLocaleDateString(undefined, dateOptions)
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.toLocaleDateString(undefined, dateOptions)}`
  }
  return `${start.toLocaleDateString(undefined, dateOptions)} – ${end.toLocaleDateString(undefined, dateOptions)}`
}

export default function ProgramEventsPanel({ events, onChange }) {
  const galleries = useAsync(endpoints.galleryEvents, [])
  const [form, setForm] = useState(initialForm)
  const [poster, setPoster] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  function resetForm() {
    setForm(initialForm)
    setPoster(null)
    setEditingId(null)
  }

  function edit(event) {
    setForm({
      title: event.title,
      description: event.description,
      start_date: event.start_date,
      end_date: event.end_date || '',
      start_time: event.start_time?.slice(0, 5) || '',
      end_time: event.end_time?.slice(0, 5) || '',
      venue: event.venue,
      status: event.status,
      gallery_event_id: event.gallery_event_id ? String(event.gallery_event_id) : '',
    })
    setPoster(null)
    setEditingId(event.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    let savedEvent = null
    try {
      const body = {
        ...form,
        end_date: form.end_date || null,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        gallery_event_id: form.gallery_event_id ? Number(form.gallery_event_id) : null,
      }
      savedEvent = editingId
        ? await endpoints.updateProgramEvent(editingId, body)
        : await endpoints.createProgramEvent(body)
      if (poster) {
        try {
          await endpoints.uploadProgramEventPoster(savedEvent.id, poster)
        } catch (error) {
          toast(`Event saved, but its poster could not be uploaded: ${error.message}`, 'error')
          onChange()
          return
        }
      }
      toast(form.status === 'published' ? 'Church event published' : 'Event draft saved')
      resetForm()
      onChange()
    } catch (error) {
      toast(error.message, 'error')
      onChange()
    } finally {
      setBusy(false)
    }
  }

  async function remove(event) {
    if (!window.confirm(`Delete "${event.title}"? This cannot be undone.`)) return
    try {
      await endpoints.deleteProgramEvent(event.id)
      if (editingId === event.id) resetForm()
      toast('Event deleted')
      onChange()
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  async function removePoster(event) {
    try {
      await endpoints.deleteProgramEventPoster(event.id)
      toast('Event poster removed')
      onChange()
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  return (
    <section className="space-y-5">
      <form onSubmit={submit} className="card space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="font-display text-xl font-semibold">{editingId ? 'Edit church event' : 'Schedule a church event'}</h2>
          <p className="mt-1 text-sm opacity-65">Only published events appear on the public Events page. You can add a poster now or later.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="program-event-title">Event title</label>
            <input id="program-event-title" className="input" required minLength={2} maxLength={200} value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Church anniversary celebration" />
          </div>
          <div>
            <label className="label" htmlFor="program-event-start-date">Start date</label>
            <input id="program-event-start-date" className="input" type="date" required value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="program-event-end-date">End date (optional)</label>
            <input id="program-event-end-date" className="input" type="date" min={form.start_date} value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="program-event-start-time">Start time (optional)</label>
            <input id="program-event-start-time" className="input" type="time" value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="program-event-end-time">End time (optional)</label>
            <input id="program-event-end-time" className="input" type="time" value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="program-event-venue">Location</label>
            <input id="program-event-venue" className="input" maxLength={200} value={form.venue}
              onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="Venue or online meeting details" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="program-event-description">Event details</label>
            <textarea id="program-event-description" className="input min-h-28 resize-y" maxLength={10000} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Share the theme, schedule, or anything guests should know." />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="program-event-poster">Event poster (optional)</label>
            <input
              id="program-event-poster"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="input file:mr-3 file:rounded-lg file:border-0 file:bg-gold-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold"
              onChange={(e) => setPoster(e.target.files?.[0] || null)}
            />
            <p className="mt-1 text-xs opacity-55">JPEG, PNG, or WebP; up to 8 MB. It will be optimized for the website.</p>
          </div>
          <div>
            <label className="label" htmlFor="program-event-status">Status</label>
            <select id="program-event-status" className="input" value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="program-event-gallery">Related photo gallery (optional)</label>
            <select
              id="program-event-gallery"
              className="input"
              value={form.gallery_event_id}
              onChange={(e) => setForm({ ...form, gallery_event_id: e.target.value })}
              disabled={galleries.loading || Boolean(galleries.error)}
            >
              <option value="">No related gallery</option>
              {galleries.data?.map((gallery) => (
                <option key={gallery.id} value={gallery.id}>{gallery.title} · {formatDate(gallery)}</option>
              ))}
            </select>
            {galleries.loading && <p className="mt-1 text-xs opacity-55">Loading available galleries…</p>}
            {galleries.error && <p role="alert" className="mt-1 text-xs text-rose-600">Could not load photo galleries: {galleries.error.message}</p>}
            {!galleries.loading && !galleries.error && galleries.data?.length === 0 && (
              <p className="mt-1 text-xs opacity-55">No galleries with published photos are available to link yet.</p>
            )}
            {form.gallery_event_id && !galleries.data?.some((gallery) => String(gallery.id) === form.gallery_event_id) && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">This gallery is no longer available. Choose another gallery or remove the link.</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          {editingId && <button type="button" className="btn-ghost" onClick={resetForm}>Cancel</button>}
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Save event'}</button>
        </div>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        {events.map((event) => (
          <article key={event.id} className="card overflow-hidden">
            {event.poster_url && <img src={event.poster_url} alt={`Poster for ${event.title}`} loading="lazy" className="aspect-[16/8] w-full object-cover" />}
            <div className="space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-xl font-semibold">{event.title}</h3>
                  <p className="mt-1 text-sm opacity-65">{formatDate(event)}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${event.status === 'published' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-ink-900/10 text-ink-700 dark:bg-white/10 dark:text-white/70'}`}>
                  {event.status === 'published' ? 'Published' : 'Draft'}
                </span>
              </div>
              {event.venue && <p className="text-sm opacity-70">{event.venue}</p>}
              <p className="line-clamp-3 whitespace-pre-wrap text-sm leading-6 opacity-65">{event.description || 'No event details added.'}</p>
              <div className="flex flex-wrap justify-end gap-2 border-t border-ink-900/10 pt-3 dark:border-white/10">
                {event.poster_url && <button type="button" className="btn-ghost" onClick={() => removePoster(event)}>Remove poster</button>}
                <button type="button" className="btn-ghost" onClick={() => edit(event)}>Edit</button>
                <button type="button" className="btn-ghost text-rose-600" onClick={() => remove(event)}>Delete</button>
              </div>
            </div>
          </article>
        ))}
        {events.length === 0 && <p className="card p-8 text-center text-sm opacity-65 lg:col-span-2">No scheduled events yet. Save a draft or publish an event above.</p>}
      </div>
    </section>
  )
}
