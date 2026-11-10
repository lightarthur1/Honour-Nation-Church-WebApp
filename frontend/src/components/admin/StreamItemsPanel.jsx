import { useState } from 'react'
import { endpoints } from '../../api/client'
import { useToast } from '../ui/Toast'

const initialForm = {
  title: '',
  description: '',
  provider: 'zoom',
  kind: 'live',
  url: '',
  scheduled_at: '',
  status: 'draft',
}

const providerLabels = { zoom: 'Zoom', youtube: 'YouTube', facebook: 'Facebook' }
const placeholderUrls = {
  zoom: 'https://zoom.us/j/your-meeting-id',
  youtube: 'https://www.youtube.com/watch?v=...',
  facebook: 'https://www.facebook.com/your-live-video',
}

function localDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

export default function StreamItemsPanel({ items, onChange }) {
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  function resetForm() {
    setForm(initialForm)
    setEditingId(null)
  }

  function edit(item) {
    setForm({
      title: item.title,
      description: item.description,
      provider: item.provider,
      kind: item.kind,
      url: item.url,
      scheduled_at: localDateTime(item.scheduled_at),
      status: item.status,
    })
    setEditingId(item.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const body = {
        ...form,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      }
      if (editingId) {
        await endpoints.updateStreamItem(editingId, body)
        toast('Streaming link updated')
      } else {
        await endpoints.createStreamItem(body)
        toast(form.status === 'published' ? 'Streaming link published' : 'Draft saved')
      }
      resetForm()
      onChange()
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function remove(item) {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return
    try {
      await endpoints.deleteStreamItem(item.id)
      if (editingId === item.id) resetForm()
      toast('Streaming link deleted')
      onChange()
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  return (
    <section className="space-y-5">
      <form onSubmit={submit} className="card space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="font-display text-xl font-semibold">{editingId ? 'Edit live stream or video' : 'Add a live stream or video'}</h2>
          <p className="mt-1 text-sm leading-6 opacity-65">
          Published links are visible to everyone. Use the Zoom participant invite link only—not a host link or account credentials. Anyone who visits the page can try to join a published meeting.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="stream-title">Title</label>
            <input id="stream-title" className="input" required minLength={2} maxLength={200} value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Sunday worship service" />
          </div>
          <div>
            <label className="label" htmlFor="stream-provider">Platform</label>
            <select id="stream-provider" className="input" value={form.provider}
              onChange={(event) => setForm({ ...form, provider: event.target.value })}>
              <option value="zoom">Zoom</option>
              <option value="youtube">YouTube</option>
              <option value="facebook">Facebook</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="stream-kind">Content type</label>
            <select id="stream-kind" className="input" value={form.kind}
              onChange={(event) => setForm({ ...form, kind: event.target.value })}>
              <option value="live">Live service / meeting</option>
              <option value="recording">Recorded video</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="stream-url">{form.provider === 'zoom' ? 'Zoom join link' : `${providerLabels[form.provider]} video link`}</label>
            <input id="stream-url" className="input" type="url" required minLength={10} maxLength={2048} value={form.url}
              onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder={placeholderUrls[form.provider]} />
            <p className="mt-1 text-xs opacity-55">Use a secure HTTPS link from {providerLabels[form.provider]}. Any passcode included in a published link will also be public.</p>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="stream-description">Details (optional)</label>
            <textarea id="stream-description" className="input min-h-24 resize-y" maxLength={10000} value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Share a short message for viewers." />
          </div>
          <div>
            <label className="label" htmlFor="stream-time">{form.kind === 'live' ? 'Meeting / service time (optional)' : 'Recording date (optional)'}</label>
            <input id="stream-time" className="input" type="datetime-local" value={form.scheduled_at}
              onChange={(event) => setForm({ ...form, scheduled_at: event.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="stream-status">Status</label>
            <select id="stream-status" className="input" value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="draft">Draft (private)</option>
              <option value="published">Published (public)</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          {editingId && <button type="button" className="btn-ghost" onClick={resetForm}>Cancel</button>}
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Save link'}</button>
        </div>
      </form>

      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg font-semibold">{item.title}</h3>
                <span className="rounded-full bg-gold-500/15 px-2.5 py-1 text-xs font-semibold">{providerLabels[item.provider]}</span>
                <span className="rounded-full bg-ink-900/10 px-2.5 py-1 text-xs font-semibold dark:bg-white/10">{item.kind === 'live' ? 'Live' : 'Recording'}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === 'published' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-ink-900/10 text-ink-700 dark:bg-white/10 dark:text-white/70'}`}>
                  {item.status === 'published' ? 'Published' : 'Draft'}
                </span>
              </div>
              {item.scheduled_at && <p className="mt-2 text-xs opacity-55">{new Date(item.scheduled_at).toLocaleString()}</p>}
              {item.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 opacity-70">{item.description}</p>}
              <p className="mt-2 break-all text-xs opacity-45">{item.url}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" className="btn-ghost" onClick={() => edit(item)}>Edit</button>
              <button type="button" className="btn-ghost text-rose-600" onClick={() => remove(item)}>Delete</button>
            </div>
          </article>
        ))}
        {items.length === 0 && <p className="card p-8 text-center text-sm opacity-65">No live streams or videos yet. Add a Zoom meeting link or a recording above.</p>}
      </div>
    </section>
  )
}
