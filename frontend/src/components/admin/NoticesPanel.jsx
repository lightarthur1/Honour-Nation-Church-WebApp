import { useState } from 'react'
import { endpoints } from '../../api/client'
import { useToast } from '../ui/Toast'

const initialForm = {
  title: '',
  content: '',
  category: 'general',
  status: 'draft',
  is_pinned: false,
  expires_on: '',
}

const categoryLabels = {
  general: 'General',
  service: 'Service information',
  registration: 'Registration',
  reminder: 'Reminder',
}

export default function NoticesPanel({ notices, onChange }) {
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  function resetForm() {
    setForm(initialForm)
    setEditingId(null)
  }

  function edit(notice) {
    setForm({
      title: notice.title,
      content: notice.content,
      category: notice.category,
      status: notice.status,
      is_pinned: notice.is_pinned,
      expires_on: notice.expires_on || '',
    })
    setEditingId(notice.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const body = { ...form, expires_on: form.expires_on || null }
      if (editingId) {
        await endpoints.updateNotice(editingId, body)
        toast('Notice updated')
      } else {
        await endpoints.createNotice(body)
        toast(form.status === 'published' ? 'Notice published' : 'Draft saved')
      }
      resetForm()
      onChange()
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function remove(notice) {
    if (!window.confirm(`Delete "${notice.title}"? This cannot be undone.`)) return
    try {
      await endpoints.deleteNotice(notice.id)
      if (editingId === notice.id) resetForm()
      toast('Notice deleted')
      onChange()
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  return (
    <section className="space-y-5">
      <form onSubmit={submit} className="card space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="font-display text-xl font-semibold">{editingId ? 'Edit notice' : 'Create a notice'}</h2>
          <p className="mt-1 text-sm opacity-65">Use this board for practical church information. Drafts are private; expired notices are hidden automatically.</p>
        </div>
        <div>
          <label className="label" htmlFor="notice-title">Title</label>
          <input id="notice-title" className="input" required minLength={2} maxLength={200} value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="notice-content">Notice details</label>
          <textarea id="notice-content" className="input min-h-32 resize-y" required minLength={2} maxLength={10000} value={form.content}
            onChange={(event) => setForm({ ...form, content: event.target.value })} />
          <p className="mt-1 text-right text-xs opacity-50">{form.content.length}/10000</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="notice-category">Category</label>
            <select id="notice-category" className="input" value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}>
              {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="notice-expiry">Expiry date (optional)</label>
            <input id="notice-expiry" className="input" type="date" min={new Date().toISOString().slice(0, 10)} value={form.expires_on}
              onChange={(event) => setForm({ ...form, expires_on: event.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="notice-status">Status</label>
            <select id="notice-status" className="input" value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="draft">Draft (private)</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="h-4 w-4 accent-amber-500" checked={form.is_pinned}
              onChange={(event) => setForm({ ...form, is_pinned: event.target.checked })} />
            Pin this notice
          </label>
          <div className="flex gap-2">
            {editingId && <button type="button" className="btn-ghost" onClick={resetForm}>Cancel</button>}
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Save notice'}</button>
          </div>
        </div>
      </form>

      <div className="space-y-3">
        {notices.map((notice) => (
          <article key={notice.id} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg font-semibold">{notice.title}</h3>
                <span className="rounded-full bg-gold-500/15 px-2.5 py-1 text-xs font-semibold">{categoryLabels[notice.category]}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${notice.status === 'published' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-ink-900/10 text-ink-700 dark:bg-white/10 dark:text-white/70'}`}>
                  {notice.status === 'published' ? 'Published' : 'Draft'}
                </span>
                {notice.is_pinned && <span className="rounded-full bg-gold-500/15 px-2.5 py-1 text-xs font-semibold">Pinned</span>}
              </div>
              <p className="mt-1 text-xs opacity-55">
                {notice.expires_on ? `Expires ${new Date(`${notice.expires_on}T00:00:00`).toLocaleDateString()}` : 'No expiry date'}
              </p>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 opacity-75">{notice.content}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" className="btn-ghost" onClick={() => edit(notice)}>Edit</button>
              <button type="button" className="btn-ghost text-rose-600" onClick={() => remove(notice)}>Delete</button>
            </div>
          </article>
        ))}
        {notices.length === 0 && <p className="card p-8 text-center text-sm opacity-65">No notices yet. Add practical information for your church community.</p>}
      </div>
    </section>
  )
}
