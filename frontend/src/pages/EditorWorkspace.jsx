import { endpoints } from '../api/client'
import EventWorkCard from '../components/editor/EventWorkCard'
import { useAsync } from '../hooks/useAsync'
import { usePolling } from '../hooks/usePolling'

export default function EditorWorkspace() {
  const { data, loading, error, reload } = useAsync(endpoints.events, [])
  usePolling(() => reload(true), !!data?.some((e) => e.edited?.status === 'processing'))

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Editor workspace</h1>
        <p className="mt-1 opacity-70">Download the raw photos, edit them on your PC, then upload the finished ZIP.</p>
      </header>
      {loading && <div className="card h-48 animate-pulse" />}
      {error && <p className="card p-6 text-rose-600">{error.message}</p>}
      {data?.length === 0 && <p className="card p-10 text-center opacity-70">No events are assigned to you yet. The admin will assign you.</p>}
      <div className="grid gap-5 lg:grid-cols-2">
        {data?.map((e) => <EventWorkCard key={e.id} event={e} onChange={() => reload(true)} />)}
      </div>
    </main>
  )
}
