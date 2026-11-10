import { useState } from 'react'
import { archives } from '../../api'
import { errorMessage } from '../../api/client'
import { formatBytes, formatDateTime } from '../../lib/format'
import { Badge, DRIVE_BADGE, PREVIEW_BADGE } from '../ui/StatusBadge'
import { ErrorNotice } from '../ui/Feedback'
import Icon from '../ui/Icon'
import ProgressBar from '../ui/ProgressBar'

export default function EditedArchiveRow({ archive: a, onChanged }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(fn) {
    setBusy(true)
    setError('')
    try {
      await fn(a.id)
      onChanged()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const making = a.preview_status === 'pending' || a.preview_status === 'processing'
  const uploading = a.drive_status === 'uploading'
  const canSync = ['failed', 'skipped', 'pending'].includes(a.drive_status) && !making && !uploading
  const canRetry = a.preview_status === 'failed' || (a.drive_status === 'failed' && a.preview_status !== 'done')

  return (
    <li className="rounded-lg border border-line bg-bg/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{a.original_filename}</p>
          <p className="mt-0.5 text-xs text-muted">
            {formatBytes(a.size_bytes)} – {a.image_count} images – uploaded {formatDateTime(a.uploaded_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge map={PREVIEW_BADGE} value={a.preview_status} />
          <Badge map={DRIVE_BADGE} value={a.drive_status} />
        </div>
      </div>

      {making && a.image_count > 0 && (
        <div className="mt-3">
          <ProgressBar value={a.preview_count / a.image_count} label={`${a.preview_count} of ${a.image_count} previews`} />
        </div>
      )}

      {a.error_message && (
        <p className={`mt-3 text-xs ${a.preview_status === 'failed' || a.drive_status === 'failed' ? 'text-bad' : 'text-muted'}`}>
          {a.error_message}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {canSync && (
          <button className="btn-ghost" disabled={busy} onClick={() => run(archives.syncDrive)}>
            <Icon name="upload" /> Sync to Google Drive
          </button>
        )}
        {canRetry && (
          <button className="btn-ghost" disabled={busy} onClick={() => run(archives.reprocess)}>
            <Icon name="refresh" /> Retry processing
          </button>
        )}
        {a.drive_view_url && (
          <a className="btn-ghost" href={a.drive_view_url} target="_blank" rel="noopener noreferrer">
            <Icon name="external" /> Open in Drive
          </a>
        )}
      </div>
      <div className="mt-2">
        <ErrorNotice>{error}</ErrorNotice>
      </div>
    </li>
  )
}
