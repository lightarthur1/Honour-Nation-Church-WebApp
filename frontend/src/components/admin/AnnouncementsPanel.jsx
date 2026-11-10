import { useState } from 'react'
import { endpoints } from '../../api/client'
import { useToast } from '../ui/Toast'

const emptyForm = { title: '', content: '', status: 'draft', is_pinned: false }

export default function AnnouncementsPanel({ announcements, onChange }) {
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
  }

  function edit(announcement) {
    setForm({
      title: announcement.title,
      content: announcement.content,
      status: announcement.status,
      is_pinned: announcement.is_pinned,
    })
    setEditingId(announcement.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    try {
      if (editingId) {
        await endpoints.updateAnnouncement(editingId, form)
        toast('Announcement updated')
      } else {
        await endpoints.createAnnouncement(form)
        toast(form.status === 'published' ? 'Announcement published' : 'Draft saved')
      }
      resetForm()
      onChange()
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function remove(announcement) {
    if (!window.confirm(`Delete "${announcement.title}"? This cannot be undone.`)) return
    try {
      await endpoints.deleteAnnouncement(announcement.id)
      if (editingId === announcement.id) resetForm()
      toast('Announcement deleted')
      onChange()
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  return (
    <section className="space-y-5">
      <form onSubmit={submit} className="card space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="font-display text-xl font-semibold">{editingId ? 'Edit announcement' : 'Write an announcement'}</h2>
          <p className="mt-1 text-sm opacity-65">Drafts stay private. Published announcements appear on Home and the public feed.</p>
        </div>
        <div>
          <label className="label" htmlFor="announcement-title">Title</label>
          <input
            id="announcement-title"
            className="input"
            required
            minLength={2}
            maxLength={200}
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor="announcement-content">Message</label>
          <textarea
            id="announcement-content"
            className="input min-h-36 resize-y"
            required
            minLength={2}
            maxLength={10000}
            value={form.content}
            onChange={(event) => setForm({ ...form, content: event.target.value })}
          />
          <p className="mt-1 text-right text-xs opacity-50">{form.content.length}/10000</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-36">
            <label className="label" htmlFor="announcement-status">Status</label>
            <select id="announcement-status" className="input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
          <label className="mt-5 inline-flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.is_pinned}
              onChange={(event) => setForm({ ...form, is_pinned: event.target.checked })}
              className="h-4 w-4 accent-amber-500"
            />
            Pin this announcement
          </label>
          <div className="ml-auto flex gap-2">
            {editingId && <button type="button" className="btn-ghost" onClick={resetForm}>Cancel</button>}
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Save announcement'}</button>
          </div>
        </div>
      </form>

      <div className="space-y-3">
        {announcements.map((announcement) => (
          <article key={announcement.id} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg font-semibold">{announcement.title}</h3>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${announcement.status === 'published' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-ink-900/10 text-ink-700 dark:bg-white/10 dark:text-white/70'}`}>
                  {announcement.status === 'published' ? 'Published' : 'Draft'}
                </span>
                {announcement.is_pinned && <span className="rounded-full bg-gold-500/15 px-2.5 py-1 text-xs font-semibold text-gold-700 dark:text-gold-300">Pinned</span>}
              </div>
              <p className="mt-1 text-xs opacity-55">
                {announcement.published_at ? `Published ${new Date(announcement.published_at).toLocaleString()}` : `Created ${new Date(announcement.created_at).toLocaleString()}`}
              </p>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 opacity-75">{announcement.content}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" className="btn-ghost" onClick={() => edit(announcement)}>Edit</button>
              <button type="button" className="btn-ghost text-rose-600" onClick={() => remove(announcement)}>Delete</button>
            </div>
          </article>
        ))}
        {announcements.length === 0 && <p className="card p-8 text-center text-sm opacity-65">No announcements yet. Create a draft or publish your first update above.</p>}
      </div>
    </section>
  )
}
