import { useEffect, useState } from 'react'
import { admin } from '../../api'
import { errorMessage } from '../../api/client'
import { formatBytes } from '../../lib/format'
import { ErrorNotice, Spinner } from '../ui/Feedback'
import StatusBadge from '../ui/StatusBadge'

export default function SystemPanel() {
  const [stats, setStats] = useState(null)
  const [drive, setDrive] = useState(null)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    admin.stats().then(setStats).catch((e) => setError(errorMessage(e)))
  }, [])

  async function check() {
    setChecking(true)
    setError('')
    try {
      setDrive(await admin.driveStatus())
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setChecking(false)
    }
  }

  const ok = drive?.enabled && drive?.configured && !drive?.error

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ErrorNotice>{error}</ErrorNotice>

      <section className="panel p-5">
        <h2 className="font-display text-2xl">Storage</h2>
        {!stats ? (
          <Spinner />
        ) : (
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Raw photos on this server</dt><dd className="font-medium">{formatBytes(stats.raw_bytes_on_server)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Events</dt><dd className="font-medium">{stats.events}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Admins / editors / members</dt><dd className="font-medium">{stats.users.admin} / {stats.users.editor} / {stats.users.user}</dd></div>
          </dl>
        )}
        <p className="mt-4 text-xs text-muted">
          Delete raw ZIPs from an event once its edited photos are synced to Google Drive to free this space.
        </p>
      </section>

      <section className="panel p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Google Drive</h2>
          {drive && <StatusBadge tone={ok ? 'ok' : drive.enabled ? 'bad' : 'amber'}>{ok ? 'Connected' : drive.enabled ? 'Problem' : 'Sync is off'}</StatusBadge>}
        </div>
        <p className="mt-2 text-sm text-muted">
          Edited ZIPs are copied into a folder in your church's Shared Drive. Check that the connection works.
        </p>
        <button className="btn-ghost mt-4" onClick={check} disabled={checking}>
          {checking ? 'Checking' : 'Check connection'}
        </button>
        {drive && (
          <div className="mt-4 space-y-1 text-sm">
            {drive.folder_name && <p>Folder: <span className="font-medium">{drive.folder_name}</span></p>}
            {drive.error && <p className="text-bad">{drive.error}</p>}
            {ok && <p className="text-ok">Uploads will go to this Shared Drive folder.</p>}
          </div>
        )}
      </section>
    </div>
  )
}
