import { useState } from 'react'
import { endpoints } from '../api/client'
import AnnouncementsPanel from '../components/admin/AnnouncementsPanel'
import AdminEventCard from '../components/admin/AdminEventCard'
import DocumentsPanel from '../components/admin/DocumentsPanel'
import EventForm from '../components/admin/EventForm'
import NoticesPanel from '../components/admin/NoticesPanel'
import ProgramEventsPanel from '../components/admin/ProgramEventsPanel'
import RequestQueue from '../components/admin/RequestQueue'
import RoleManager from '../components/admin/RoleManager'
import StreamItemsPanel from '../components/admin/StreamItemsPanel'
import { useAsync } from '../hooks/useAsync'
import { usePolling } from '../hooks/usePolling'

export default function AdminPanel() {
  const [tab, setTab] = useState('events')
  const events = useAsync(endpoints.events, [])
  const users = useAsync(endpoints.users, [])
  const reqs = useAsync(() => endpoints.accessRequests(), [])
  const announcements = useAsync(endpoints.adminAnnouncements, [])
  const programEvents = useAsync(endpoints.adminProgramEvents, [])
  const streamItems = useAsync(endpoints.adminStreamItems, [])
  const notices = useAsync(endpoints.adminNotices, [])
  const documents = useAsync(endpoints.adminDocuments, [])
  usePolling(() => events.reload(true), !!events.data?.some((e) => e.edited?.status === 'processing'))

  const pending = reqs.data?.filter((r) => r.status === 'pending').length || 0
  const tabs = [['events', 'Gallery events'], ['program-events', 'Church events'], ['announcements', 'Announcements'], ['streams', 'Live & videos'], ['notices', 'Notice board'], ['documents', 'Documents'], ['users', 'Users'], ['requests', 'Download requests']]

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Admin control panel</h1>
        <p className="mt-1 opacity-70">Manage church events and galleries, publish announcements and notices, manage live links and documents, and approve downloads.</p>
      </header>

      <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl bg-ink-900/5 p-1 dark:bg-white/5">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); k === 'requests' && reqs.reload(true); k === 'announcements' && announcements.reload(true); k === 'program-events' && programEvents.reload(true); k === 'streams' && streamItems.reload(true); k === 'notices' && notices.reload(true); k === 'documents' && documents.reload(true) }}
            className={`relative whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === k ? 'bg-white shadow dark:bg-ink-700' : 'opacity-60 hover:opacity-100'}`}>
            {label}
            {k === 'requests' && pending > 0 && <span className="ml-2 rounded-full bg-gold-500 px-2 py-0.5 text-xs text-ink-950">{pending}</span>}
          </button>
        ))}
      </div>

      {tab === 'events' && (
        <section className="space-y-5">
          <EventForm onCreated={() => events.reload(true)} />
          <div className="grid gap-5 lg:grid-cols-2">
            {events.data?.map((e) => (
              <AdminEventCard key={e.id} event={e} editors={users.data?.filter((u) => u.role === 'editor') || []} onChange={() => events.reload(true)} />
            ))}
          </div>
          {events.data?.length === 0 && <p className="card p-10 text-center opacity-70">No events yet. Create the first one above.</p>}
        </section>
      )}
      {tab === 'announcements' && (
        announcements.error
          ? <p role="alert" className="card p-6 text-rose-600">Could not load announcements: {announcements.error.message}</p>
          : announcements.data && <AnnouncementsPanel announcements={announcements.data} onChange={() => announcements.reload(true)} />
      )}
      {tab === 'program-events' && (
        programEvents.error
          ? <p role="alert" className="card p-6 text-rose-600">Could not load church events: {programEvents.error.message}</p>
          : programEvents.data && <ProgramEventsPanel events={programEvents.data} onChange={() => programEvents.reload(true)} />
      )}
      {tab === 'streams' && (
        streamItems.error
          ? <p role="alert" className="card p-6 text-rose-600">Could not load live streams and videos: {streamItems.error.message}</p>
          : streamItems.data && <StreamItemsPanel items={streamItems.data} onChange={() => streamItems.reload(true)} />
      )}
      {tab === 'notices' && (
        notices.error
          ? <p role="alert" className="card p-6 text-rose-600">Could not load notices: {notices.error.message}</p>
          : notices.data && <NoticesPanel notices={notices.data} onChange={() => notices.reload(true)} />
      )}
      {tab === 'documents' && (
        documents.error
          ? <p role="alert" className="card p-6 text-rose-600">Could not load documents: {documents.error.message}</p>
          : documents.data && <DocumentsPanel documents={documents.data} onChange={() => documents.reload(true)} />
      )}
      {tab === 'users' && users.data && <RoleManager users={users.data} onChange={() => { users.reload(true); events.reload(true) }} />}
      {tab === 'requests' && reqs.data && <RequestQueue requests={reqs.data} onChange={() => reqs.reload(true)} />}
    </main>
  )
}
