import { useState } from 'react'
import { endpoints } from '../../api/client'
import { useToast } from '../ui/Toast'

const initialForm = { title: '', description: '', category: 'other', status: 'draft' }
const categories = {
  bible_study: 'Bible study',
  newsletter: 'Newsletter',
  bulletin: 'Bulletin',
  form: 'Form',
  other: 'Other',
}

function formatSize(bytes) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DocumentsPanel({ documents, onChange }) {
  const [form, setForm] = useState(initialForm)
  const [file, setFile] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  function resetForm() {
    setForm(initialForm)
    setFile(null)
    setEditingId(null)
  }

  function edit(document) {
    setForm({
      title: document.title,
      description: document.description,
      category: document.category,
      status: document.status,
    })
    setFile(null)
    setEditingId(document.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    try {
      if (!editingId) {
        const body = new FormData()
        body.append('title', form.title)
        body.append('description', form.description)
        body.append('category', form.category)
        body.append('status', form.status)
        body.append('file', file)
        await endpoints.createDocument(body)
        toast(form.status === 'published' ? 'Document published' : 'Document draft saved')
      } else {
        await endpoints.updateDocument(editingId, form)
        if (file) {
          try {
            await endpoints.replaceDocumentFile(editingId, file)
          } catch (error) {
            toast(`Document details were saved, but the replacement PDF failed: ${error.message}`, 'error')
            onChange()
            return
          }
        }
        toast('Document updated')
      }
      resetForm()
      onChange()
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function remove(document) {
    if (!window.confirm(`Delete "${document.title}" and its PDF? This cannot be undone.`)) return
    try {
      await endpoints.deleteDocument(document.id)
      if (editingId === document.id) resetForm()
      toast('Document deleted')
      onChange()
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  return (
    <section className="space-y-5">
      <form onSubmit={submit} className="card space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="font-display text-xl font-semibold">{editingId ? 'Edit church document' : 'Add a church document'}</h2>
          <p className="mt-1 text-sm opacity-65">Only published PDFs are available to visitors. Documents can be up to 20 MB.</p>
        </div>
        <div>
          <label className="label" htmlFor="document-title">Title</label>
          <input id="document-title" className="input" required minLength={2} maxLength={200} value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Bible Study Outline 2026" />
        </div>
        <div>
          <label className="label" htmlFor="document-description">Description (optional)</label>
          <textarea id="document-description" className="input min-h-24 resize-y" maxLength={2000} value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="document-category">Category</label>
            <select id="document-category" className="input" value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}>
              {Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="document-status">Status</label>
            <select id="document-status" className="input" value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="draft">Draft (private)</option>
              <option value="published">Published</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="document-file">{editingId ? 'Replace PDF (optional)' : 'PDF file'}</label>
            <input id="document-file" type="file" accept=".pdf,application/pdf" required={!editingId}
              className="input file:mr-3 file:rounded-lg file:border-0 file:bg-gold-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold"
              onChange={(event) => setFile(event.target.files?.[0] || null)} />
            <p className="mt-1 text-xs opacity-55">
              {editingId ? `Current file: ${documents.find((document) => document.id === editingId)?.original_filename || 'PDF document'}. ` : ''}
              PDF only, maximum 20 MB.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          {editingId && <button type="button" className="btn-ghost" onClick={resetForm}>Cancel</button>}
          <button type="submit" className="btn-primary" disabled={busy || (!editingId && !file)}>
            {busy ? 'Saving…' : editingId ? 'Save changes' : 'Upload document'}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {documents.map((document) => (
          <article key={document.id} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg font-semibold">{document.title}</h3>
                <span className="rounded-full bg-gold-500/15 px-2.5 py-1 text-xs font-semibold">{categories[document.category]}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${document.status === 'published' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-ink-900/10 text-ink-700 dark:bg-white/10 dark:text-white/70'}`}>
                  {document.status === 'published' ? 'Published' : 'Draft'}
                </span>
              </div>
              {document.description && <p className="mt-1 text-sm opacity-65">{document.description}</p>}
              <p className="mt-1 truncate text-xs opacity-50">{document.original_filename} · {formatSize(document.size_bytes)}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" className="btn-ghost" onClick={() => edit(document)}>Edit</button>
              <button type="button" className="btn-ghost text-rose-600" onClick={() => remove(document)}>Delete</button>
            </div>
          </article>
        ))}
        {documents.length === 0 && <p className="card p-8 text-center text-sm opacity-65">No documents yet. Upload an approved public church resource above.</p>}
      </div>
    </section>
  )
}
