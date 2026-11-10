import { useState } from 'react'
import { endpoints } from '../../api/client'
import { useToast } from '../ui/Toast'

export default function EventForm({ onCreated }) {
  const toast = useToast()
  const [f, setF] = useState({ title: '', description: '', event_date: new Date().toISOString().slice(0, 10) })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault(); setBusy(true)
    try { await endpoints.createEvent(f); setF({ ...f, title: '', description: '' }); toast('Event created'); onCreated() }
    catch (err) { toast(err.message, 'error') } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="card grid gap-4 p-5 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
      <div><label className="label" htmlFor="t">Event title</label><input id="t" required minLength={2} className="input" placeholder="Easter Sunday Service" value={f.title} onChange={set('title')} /></div>
      <div><label className="label" htmlFor="d">Date</label><input id="d" type="date" required className="input" value={f.event_date} onChange={set('event_date')} /></div>
      <button className="btn-primary" disabled={busy}>Create event</button>
      <div className="sm:col-span-3"><label className="label" htmlFor="ds">Description (optional)</label><input id="ds" className="input" value={f.description} onChange={set('description')} /></div>
    </form>
  )
}
