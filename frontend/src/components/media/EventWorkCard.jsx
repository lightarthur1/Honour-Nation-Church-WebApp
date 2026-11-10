import { useCallback, useState } from 'react'
import { archives, downloadRaw, events } from '../../api'
import { errorMessage } from '../../api/client'
import { usePolling } from '../../hooks/usePolling'
import { formatBytes, formatDate, formatDateTime } from '../../lib/format'
import { ErrorNotice } from '../ui/Feedback'
import Icon from '../ui/Icon'
import FileUploader from './FileUploader'
import EditedArchiveRow from './EditedArchiveRow'

const inFlight = (a) =>
  ['pending', 'processing'].includes(a.preview_status) || ['pending', 'uploading'].includes(a.drive_status)

/** One event's workspace. Editors use it to fetch the raw ZIP and upload the edited one;
 *  admins get extra controls (raw upload/cleanup, editor assignment, delete). */
export default function EventWorkCard({ initial, isAdmin = false, allEditors = [], onRemoved, defaultOpen = false }) {
  const [event, setEvent] = useState(initial)
  const [open, setOpen] = useState(defaultOpen)
  const [error, setError] = useState('')
  const [assigning, setAssigning] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setEvent(await events.get(initial.id))
    } catch {
      /* transient; next poll will retry */
    }
  }, [initial.id])

  usePolling(refresh, event.edited_archives.some(inFlight), 2500)

  async function guarded(fn) {
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const assignedIds = new Set(event.editors.map((e) => e.id))
  const toggleEditor = (id) =>
    guarded(async () => {
      const next = new Set(assignedIds)
      next.has(id) ? next.delete(id) : next.add(id)
      setAssigning(true)
      try {
        setEvent(await events.setEditors(event.id, [...next]))
      } finally {
        setAssigning(false)
      }
    })

  const liveRaw = event.raw_archives.filter((r) => r.is_available)
  const goneRaw = event.raw_archives.filter((r) => !r.is_available)
  const working = event.edited_archives.some(inFlight)

  return (
    <article className="panel overflow-hidden">
      <button
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-raised/50"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h3 className="truncate font-display text-xl">{event.title}</h3>
          <p className="mt-0.5 text-xs text-muted">
            {event.event_date ? `${formatDate(event.event_date)} – ` : ''}
            {liveRaw.length} raw {liveRaw.length === 1 ? 'ZIP' : 'ZIPs'} on server – {event.edited_archives.length} edited
            {working ? ' – processing' : ''}
          </p>
        </div>
        <Icon name="chevronRight" className={`h-4 w-4 shrink-0 text-muted transition ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="space-y-6 border-t border-line px-5 py-5">
          <ErrorNotice>{error}</ErrorNotice>

          {/* ---- Step 1: raw ---- */}
          <section>
            <h4 className="text-sm font-semibold">Raw photos</h4>
            {liveRaw.length === 0 && (
              <p className="mt-2 text-sm text-muted">
                {isAdmin ? 'No raw ZIP on the server. Upload the unedited folder below.' : 'The admin has not uploaded raw photos for this event yet.'}
              </p>
            )}
            <ul className="mt-2 space-y-2">
              {liveRaw.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-bg/40 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.original_filename}</p>
                    <p className="text-xs text-muted">
                      {formatBytes(r.size_bytes)} – {r.file_count} files – {formatDateTime(r.uploaded_at)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-primary" onClick={() => guarded(() => downloadRaw(event.id, r.id))}>
                      <Icon name="download" /> Download
                    </button>
                    {isAdmin && (
                      <button
                        className="btn-danger"
                        title="Frees disk space. Only allowed once an edited ZIP is processed and synced."
                        onClick={() =>
                          window.confirm(`Delete "${r.original_filename}" from the server? This cannot be undone.`) &&
                          guarded(async () => {
                            await archives.deleteRaw(event.id, r.id)
                            await refresh()
                          })
                        }
                      >
                        <Icon name="trash" /> Delete raw
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {goneRaw.length > 0 && (
              <p className="mt-2 text-xs text-muted">
                {goneRaw.length} raw {goneRaw.length === 1 ? 'ZIP was' : 'ZIPs were'} deleted to free space (
                {formatBytes(goneRaw.reduce((s, r) => s + r.size_bytes, 0))} reclaimed).
              </p>
            )}
            {isAdmin && (
              <div className="mt-3">
                <FileUploader
                  title="Upload raw photos"
                  hint="One ZIP of the unedited folder. Up to 7 GB; files inside must also total no more than 7 GB."
                  onUpload={(f, p) => archives.uploadRaw(event.id, f, p)}
                  onDone={refresh}
                />
              </div>
            )}
          </section>

          {/* ---- Step 2: edited ---- */}
          <section>
            <h4 className="text-sm font-semibold">Edited photos</h4>
            <div className="mt-2">
              <FileUploader
                title="Upload edited photos"
                hint="Put the finished images in a folder, zip it, and upload it here. Previews and the Google Drive copy are made automatically."
                onUpload={(f, p) => archives.uploadEdited(event.id, f, p)}
                onDone={refresh}
              />
            </div>
            {event.edited_archives.length > 0 && (
              <ul className="mt-3 space-y-2">
                {[...event.edited_archives].reverse().map((a) => (
                  <EditedArchiveRow key={a.id} archive={a} onChanged={refresh} />
                ))}
              </ul>
            )}
          </section>

          {/* ---- admin only ---- */}
          {isAdmin && (
            <section>
              <h4 className="text-sm font-semibold">Editors for this event</h4>
              {allEditors.length === 0 ? (
                <p className="mt-2 text-sm text-muted">No one has the Editor role yet. Give a user that role in the People tab.</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {allEditors.map((ed) => {
                    const on = assignedIds.has(ed.id)
                    return (
                      <button
                        key={ed.id}
                        disabled={assigning}
                        aria-pressed={on}
                        onClick={() => toggleEditor(ed.id)}
                        className={`rounded-full border px-3 py-1 text-sm transition ${
                          on ? 'border-accent bg-accent/15 text-accent' : 'border-line text-muted hover:text-fg'
                        }`}
                      >
                        {on && <Icon name="check" className="-ml-0.5 mr-1 inline h-3.5 w-3.5" />}
                        {ed.full_name}
                      </button>
                    )
                  })}
                </div>
              )}
              <div className="mt-6 border-t border-line pt-4">
                <button
                  className="btn-danger"
                  onClick={() =>
                    window.confirm(
                      `Delete the event "${event.title}" and all of its files on this server? Files already in Google Drive stay there.`,
                    ) &&
                    guarded(async () => {
                      await events.remove(event.id)
                      onRemoved?.(event.id)
                    })
                  }
                >
                  <Icon name="trash" /> Delete event
                </button>
              </div>
            </section>
          )}
        </div>
      )}
    </article>
  )
}
