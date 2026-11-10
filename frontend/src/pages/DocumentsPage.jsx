import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { endpoints } from '../api/client'
import { useAsync } from '../hooks/useAsync'

const categories = [
  ['all', 'All'],
  ['bible_study', 'Bible study'],
  ['newsletter', 'Newsletters'],
  ['bulletin', 'Bulletins'],
  ['form', 'Forms'],
  ['other', 'Other'],
]

const categoryLabels = Object.fromEntries(categories.filter(([key]) => key !== 'all'))

function formatSize(bytes) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function DocumentIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-7 w-7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3.75h7l5 5v11.5H7a2 2 0 0 1-2-2v-12.5a2 2 0 0 1 2-2Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3.75v5h5M9 13h6M9 16.5h6" />
    </svg>
  )
}

export default function DocumentsPage() {
  const { data, loading, error } = useAsync(endpoints.documents, [])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const filteredDocuments = useMemo(() => {
    const search = query.trim().toLowerCase()
    return (data || []).filter((document) => {
      const matchesCategory = category === 'all' || document.category === category
      const matchesSearch = !search || `${document.title} ${document.description || ''} ${document.original_filename}`.toLowerCase().includes(search)
      return matchesCategory && matchesSearch
    })
  }, [data, query, category])

  return (
    <div className="space-y-0">
      <header className="relative isolate overflow-hidden bg-ink-900 px-4 py-16 text-center text-white sm:px-6 sm:py-24">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gold-500/15 via-ink-900 to-ink-950" />
        <p className="text-xs font-bold uppercase tracking-[.2em] text-gold-300">Resources for our church family</p>
        <h1 className="mt-4 font-display text-4xl font-semibold sm:text-5xl">Church documents</h1>
        <p className="mx-auto mt-4 max-w-2xl leading-7 text-white/70">Find Bible study guides, newsletters, bulletins, and other shared resources.</p>
      </header>

      <div className="bg-paper-100/70 pb-14 dark:bg-ink-900/40">
        <main className="mx-auto max-w-7xl px-4 sm:px-6">
          <section aria-label="Search and filter documents" className="mt-8 rounded-3xl border border-ink-900/10 bg-white p-4 shadow-lg dark:border-white/10 dark:bg-ink-800 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search documents</span>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 opacity-45">
                  <circle cx="10.8" cy="10.8" r="6.8" />
                  <path strokeLinecap="round" d="m16 16 4 4" />
                </svg>
                <input type="search" className="input !rounded-full !py-3 !pl-12" placeholder="Search documents…" value={query} onChange={(event) => setQuery(event.target.value)} />
              </label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter documents by category">
                {categories.map(([key, label]) => (
                  <button key={key} type="button" aria-pressed={category === key} onClick={() => setCategory(key)}
                    className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition ${category === key ? 'border-gold-500 bg-gold-500 text-ink-950' : 'border-ink-900/10 bg-paper-50 opacity-70 hover:opacity-100 dark:border-white/10 dark:bg-ink-900'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {loading && <div role="status" className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="card h-64 animate-pulse" />)}</div>}
          {error && <p role="alert" className="card mt-10 p-6 text-rose-600">Could not load documents: {error.message}</p>}
          {!loading && !error && data?.length === 0 && (
            <div className="card mt-10 px-6 py-16 text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gold-500/10 text-gold-700 dark:text-gold-300"><DocumentIcon /></span>
              <h2 className="mt-5 font-display text-2xl font-semibold">Church resources are on the way.</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 opacity-65">No documents have been published yet. Please check back soon.</p>
            </div>
          )}
          {!loading && !error && data?.length > 0 && filteredDocuments.length === 0 && (
            <div className="card mt-10 p-10 text-center">
              <h2 className="font-display text-xl font-semibold">No documents match your search.</h2>
              <button type="button" className="btn-ghost mt-4" onClick={() => { setQuery(''); setCategory('all') }}>Clear filters</button>
            </div>
          )}
          <section aria-label="Church documents" className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredDocuments.map((document) => (
              <article key={document.id} className="card flex min-h-64 flex-col p-6 transition hover:-translate-y-1 hover:shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-gold-500/10 text-gold-700 dark:text-gold-300"><DocumentIcon /></span>
                  <span className="rounded-full bg-ink-900/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider opacity-60 dark:bg-white/5">
                    {categoryLabels[document.category]}
                  </span>
                </div>
                <h2 className="mt-5 font-display text-xl font-semibold">{document.title}</h2>
                {document.description && <p className="mt-2 line-clamp-3 text-sm leading-6 opacity-65">{document.description}</p>}
                <p className="mt-3 truncate text-xs opacity-45">{document.original_filename} · {formatSize(document.size_bytes)}</p>
                <div className="mt-auto flex items-center justify-between gap-3 border-t border-ink-900/10 pt-4 dark:border-white/10">
                  <time className="text-[10px] font-bold uppercase tracking-wider opacity-45" dateTime={document.created_at}>
                    Added {new Date(document.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                  </time>
                  <a href={endpoints.documentDownloadUrl(document.id)} className="btn-primary !rounded-full !px-4 !py-2">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75v11m0 0 4-4m-4 4-4-4M5 16v3.25A1.75 1.75 0 0 0 6.75 21h10.5A1.75 1.75 0 0 0 19 19.25V16" />
                    </svg>
                    Download
                  </a>
                </div>
              </article>
            ))}
          </section>
        </main>
      </div>

      <section className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6">
        <h2 className="font-display text-2xl font-semibold italic sm:text-3xl">Need more information?</h2>
        <p className="mx-auto mt-3 max-w-xl leading-7 opacity-65">If you can’t find the document you need, please reach out to the church leadership.</p>
        <Link to="/" className="btn-primary mt-6 !rounded-full !px-7 !py-3">Back to home</Link>
      </section>
    </div>
  )
}
