import { authedUrl, endpoints } from '../../api/client'
import FileDrop from '../ui/FileDrop'
import ProgressBar from '../ui/ProgressBar'
import StatusBadge from '../ui/StatusBadge'
import { useToast } from '../ui/Toast'

const mb = (b) => (b / 1024 / 1024).toFixed(1) + ' MB'

/** Editor's view of one event: download raw → upload edited → sync. */
export default function EventWorkCard({ event, onChange }) {
  const toast = useToast()
  const { raw, edited } = event
  const processing = edited?.status === 'processing'

  const upload = async (file, progress) => {
    try {
      await endpoints.uploadEdited(event.id, file, progress)
      toast('Upload complete. Generating previews and syncing to Drive…')
      onChange()
    } catch (e) { toast(e.message, 'error') }
  }

  const resync = async () => {
    try { await endpoints.resync(event.id); toast('Retrying Drive sync…'); onChange() } catch (e) { toast(e.message, 'error') }
  }

  return (
    <article className="card animate-rise space-y-5 p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-xl font-bold">{event.title}</h3>
          <p className="text-xs opacity-60">{new Date(event.event_date + 'T00:00').toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
        </div>
        {edited ? <StatusBadge status={edited.status} /> : <StatusBadge status="none" label="Awaiting edits" />}
      </header>

      <ol className="space-y-5">
        <li className="flex items-center justify-between gap-3 rounded-xl bg-ink-900/5 p-3 dark:bg-white/5">
          <div>
            <p className="text-sm font-semibold">1 · Download raw photos</p>
            <p className="text-xs opacity-60">
              {raw?.status === 'available' ? `${raw.original_name} · ${mb(raw.size_bytes)}` : raw?.status === 'deleted' ? 'Raw files were removed from the server' : 'Admin has not uploaded raw photos yet'}
            </p>
          </div>
          {raw?.status === 'available' && <a className="btn-ghost" href={authedUrl(`/events/${event.id}/raw/file`)}>Download ZIP</a>}
        </li>

        <li>
          <p className="mb-2 text-sm font-semibold">2 · Upload your edited ZIP</p>
          <FileDrop label={edited ? 'Replace edited ZIP' : 'Drop the edited ZIP here or click to browse'}
            hint="Final images only. Previews and Drive sync run automatically." disabled={processing} onFile={upload} />
        </li>

        {edited && (
          <li className="space-y-2 rounded-xl border border-ink-900/10 p-3 text-sm dark:border-white/10">
            <p className="font-semibold">3 · Pipeline</p>
            <p className="opacity-70">{edited.original_name} · {mb(edited.size_bytes)} · {edited.image_count} images</p>
            {processing && (edited.drive_progress != null
              ? <ProgressBar value={edited.drive_progress} label="Uploading to Google Drive (previews are already live)" />
              : <p className="animate-pulse text-gold-600 dark:text-gold-300">{event.preview_count > 0 ? 'Starting Drive upload…' : 'Generating previews…'}</p>)}
            {edited.status === 'synced' && <p className="text-emerald-600 dark:text-emerald-300">Live in the public gallery and stored in Google Drive.</p>}
            {edited.status === 'failed' && (
              <div className="space-y-2">
                <p className="text-rose-600 dark:text-rose-300">{edited.error}</p>
                <button className="btn-primary" onClick={resync}>Retry Drive sync</button>
              </div>
            )}
          </li>
        )}
      </ol>
    </article>
  )
}
