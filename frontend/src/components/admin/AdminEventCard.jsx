import { useState } from 'react'
import { endpoints } from '../../api/client'
import FileDrop from '../ui/FileDrop'
import Modal from '../ui/Modal'
import StatusBadge from '../ui/StatusBadge'
import { useToast } from '../ui/Toast'

const mb = (b) => (b / 1024 / 1024).toFixed(1) + ' MB'

export default function AdminEventCard({ event, editors, onChange }) {
  const toast = useToast()
  const [assigning, setAssigning] = useState(false)
  const [picked, setPicked] = useState(event.editors.map((u) => u.id))
  const { raw, edited } = event
  const guard = async (fn, ok) => { try { await fn(); ok && toast(ok); onChange() } catch (e) { toast(e.message, 'error') } }

  return (
    <article className="card animate-rise space-y-4 p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-xl font-bold">{event.title}</h3>
          <p className="text-xs opacity-60">{new Date(event.event_date + 'T00:00').toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
        </div>
        <div className="flex gap-2">
          {raw && <StatusBadge status={raw.status} label={`Raw: ${raw.status === 'available' ? 'on server' : 'deleted'}`} />}
          {edited ? <StatusBadge status={edited.status} /> : <StatusBadge status="none" label="No edits yet" />}
        </div>
      </header>

      <div className="text-sm">
        <span className="opacity-60">Editors: </span>
        {event.editors.length ? event.editors.map((u) => u.full_name).join(', ') : <em className="opacity-60">none assigned</em>}
        <button className="ml-2 font-semibold text-gold-600 underline-offset-2 hover:underline dark:text-gold-400" onClick={() => { setPicked(event.editors.map((u) => u.id)); setAssigning(true) }}>Change</button>
      </div>

      {!raw && (
        <FileDrop label="Upload raw ZIP" hint="Unedited photos for this event" onFile={async (file, p) => {
          await guard(() => endpoints.uploadRaw(event.id, file, p), 'Raw ZIP uploaded')
        }} />
      )}
      {raw?.status === 'available' && <p className="text-sm opacity-70">{raw.original_name} · {mb(raw.size_bytes)}</p>}
      {raw?.status === 'deleted' && <p className="text-sm opacity-60">Raw files were deleted to save space.</p>}

      {edited?.status === 'failed' && <p className="text-sm text-rose-600 dark:text-rose-300">{edited.error}</p>}

      <footer className="flex flex-wrap gap-2 border-t border-ink-900/10 pt-3 dark:border-white/10">
        {raw?.status === 'available' && (
          <button className="btn-ghost" disabled={edited?.status !== 'synced'}
            title={edited?.status !== 'synced' ? 'Available once the edited ZIP is synced to Drive' : ''}
            onClick={() => window.confirm('Delete the raw ZIP from the server? This cannot be undone.') && guard(() => endpoints.deleteRaw(event.id), 'Raw files deleted')}>
            Delete raw files
          </button>
        )}
        <button className="btn-danger ml-auto" onClick={() => window.confirm(`Delete "${event.title}" and all its previews?`) && guard(() => endpoints.deleteEvent(event.id), 'Event deleted')}>Delete event</button>
      </footer>

      <Modal open={assigning} onClose={() => setAssigning(false)} title="Assign editors">
        {editors.length === 0 ? <p className="text-sm opacity-70">No users have the Editor role yet. Promote someone in the Users tab first.</p> : (
          <div className="space-y-2">
            {editors.map((u) => (
              <label key={u.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-ink-900/10 p-3 dark:border-white/10">
                <input type="checkbox" className="h-4 w-4 accent-gold-500" checked={picked.includes(u.id)}
                  onChange={(e) => setPicked(e.target.checked ? [...picked, u.id] : picked.filter((x) => x !== u.id))} />
                <span className="text-sm font-medium">{u.full_name}</span><span className="text-xs opacity-50">{u.email}</span>
              </label>
            ))}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setAssigning(false)}>Cancel</button>
          <button className="btn-primary" onClick={() => guard(() => endpoints.assignEditors(event.id, picked), 'Editors updated').then(() => setAssigning(false))}>Save</button>
        </div>
      </Modal>
    </article>
  )
}
