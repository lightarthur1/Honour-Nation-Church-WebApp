import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { endpoints } from '../../api/client'
import LazyImage from './LazyImage'

export default function PhotoSearch() {
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const requestId = useRef(0)
  const timer = useRef(null)

  useEffect(() => () => {
    requestId.current += 1
    window.clearTimeout(timer.current)
  }, [])

  async function runSearch(searchTerm, id) {
    if (id !== requestId.current) return
    try {
      const response = await endpoints.searchPhotos(searchTerm)
      if (id !== requestId.current) return
      setResult(response)
      setError('')
      setLoading(response.indexing)
      if (response.indexing) {
        timer.current = window.setTimeout(() => runSearch(searchTerm, id), 2500)
      }
    } catch (e) {
      if (id !== requestId.current) return
      setError(e.message)
      setLoading(false)
    }
  }

  function submit(event) {
    event.preventDefault()
    const term = query.trim()
    if (term.length < 2) {
      window.clearTimeout(timer.current)
      requestId.current += 1
      setLoading(false)
      setError('Enter at least two characters to search photos.')
      return
    }
    window.clearTimeout(timer.current)
    const id = ++requestId.current
    setSubmittedQuery(term)
    setResult(null)
    setError('')
    setLoading(true)
    runSearch(term, id)
  }

  return (
    <section aria-labelledby="photo-search-title" className="card space-y-5 p-5 sm:p-6">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[.22em] text-gold-600 dark:text-gold-400">Find a moment</p>
        <h3 id="photo-search-title" className="font-display text-2xl font-semibold">Search photos by what’s happening</h3>
        <p className="mt-2 text-sm opacity-65">Try a description such as “people praying” or “hands raised in worship.”</p>
      </div>
      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
        <label className="sr-only" htmlFor="photo-search">Describe the photo you’re looking for</label>
        <input
          id="photo-search"
          className="input min-w-0 flex-1"
          type="search"
          placeholder="Describe a moment…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit" className="btn-primary shrink-0">Search photos</button>
      </form>
      <p className="text-xs opacity-60">Photos are matched using a local AI model and are not sent to an AI service.</p>
      {error && <p role="alert" className="text-sm text-rose-600">Could not search photos: {error}</p>}
      {loading && (
        <p role="status" className="text-sm opacity-70">
          {result?.indexing
            ? `Preparing photo search (${result.indexed_count} of ${result.total_count} photos indexed)…${result.indexed_count === 0 ? ' The first setup downloads the local model and may take a few minutes.' : ''}`
            : 'Searching with the local AI model… The first search may take a little longer while the model loads.'}
        </p>
      )}
      {result?.index_error && <p role="alert" className="text-sm text-rose-600">{result.index_error}</p>}
      {result && !loading && result.images.length === 0 && !result.index_error && (
        <p className="text-sm opacity-70">No close matches for “{submittedQuery}”. Try describing the scene another way.</p>
      )}
      {result?.images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {result.images.map((image) => (
            <Link
              key={image.id}
              to={`/events/${image.event_id}?photo=${image.id}`}
              className="group overflow-hidden rounded-xl border border-ink-900/10 transition hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10"
            >
              <LazyImage
                src={image.url}
                alt={`${image.event_title}: ${image.file_name}`}
                width={image.width}
                height={image.height}
                className="aspect-[4/3] transition duration-500 group-hover:scale-[1.03]"
              />
              <span className="block truncate px-3 py-2 text-sm font-semibold">{image.event_title}</span>
            </Link>
          ))}
        </div>
      )}
      {result?.indexing && result.images.length > 0 && (
        <p className="text-sm opacity-65">More matching photos will appear as the index finishes.</p>
      )}
    </section>
  )
}
