import { useCallback, useEffect, useState } from 'react'
import { events, users } from '../../api'
import { errorMessage } from '../../api/client'
import { Empty, ErrorNotice, Spinner } from '../ui/Feedback'
import EventWorkCard from '../media/EventWorkCard'

export default function EventsPanel() {
  const [list, setList] = useState(null)
  const [editors, setEditors] = useState([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({ title: '', event_date: '', description: '' })
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const [evs, eds] = await Promise.all([events.list(), users.list({ role: 'editor' })])
      setList(evs)
      setEditors(eds.filter((u) => u.is_active))
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function create(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const ev = await events.create({
        title: form.title,
        event_date: form.event_date || null,
        description: form.description || null,
      })
      setList((l) => [ev, ...(l || [])])
      setForm({ title: '', event_date: '', description: '' })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={create} className="panel grid gap-4 p-5 sm:grid-cols-[1fr_200px_auto] sm:items-end">
        <div>
          <label htmlFor="ev-title" className="mb-1.5 block text-sm font-medium">New event</label>
          <input
            id="ev-title"
            className="field"
            required
            maxLength={200}
            placeholder="Easter Sunday service"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="ev-date" className="mb-1.5 block text-sm font-medium">Date</label>
          <input
            id="ev-date"
            type="date"
            className="field"
            value={form.event_date}
            onChange={(e) => setForm({ ...form, event_date: e.target.value })}
          />
        </div>
        <button className="btn-primary" disabled={busy}>
          Create event
        </button>
      </form>

      <ErrorNotice onRetry={load}>{error}</ErrorNotice>
      {!list && !error && <Spinner />}
      {list?.length === 0 && <Empty title="No events yet">Create one above, then upload its raw photos.</Empty>}
      <div className="space-y-4">
        {list?.map((ev) => (
          <EventWorkCard
            key={ev.id}
            initial={ev}
            isAdmin
            allEditors={editors}
            onRemoved={(id) => setList((l) => l.filter((x) => x.id !== id))}
          />
        ))}
      </div>
    </div>
  )
}
