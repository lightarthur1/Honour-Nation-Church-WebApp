import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authedUrl, endpoints } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import StatusBadge from '../ui/StatusBadge'
import { useToast } from '../ui/Toast'

export default function AccessPanel({ event, onChanged }) {
  const { user } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const run = async (fn) => {
    setBusy(true)
    try { await fn() } catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
  }

  const request = () => {
    if (!user) return nav('/login', { state: { from: `/events/${event.id}` } })
    run(async () => { await endpoints.requestAccess(event.id); toast('Request sent to the admin'); onChanged?.() })
  }

  const download = () => run(async () => {
    const { url } = await endpoints.editedLink(event.id)
    // Local stand-in URLs (dev mode) need the token; Google Drive URLs must not receive it.
    window.location.href = url.startsWith('/') ? `${url}?token=${encodeURIComponent(localStorage.getItem('cmg_token') || '')}` : url
  })

  const s = event.access_status
  return (
    <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold">High-resolution originals</p>
        <p className="text-xs opacity-60">These previews are compressed. Request access to download full-quality images individually.</p>
      </div>
      <div className="flex items-center gap-3">
        {user && <StatusBadge status={s} />}
        {(s === 'none' || s === 'denied') && (
          <button className="btn-primary" disabled={busy} onClick={request}>
            {s === 'denied' ? 'Request again' : 'Request Download Access'}
          </button>
        )}
        {s === 'staff' && (
          <button className="btn-primary" disabled={busy} onClick={download}>Download full-res ZIP</button>
        )}
        {s === 'approved' && <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Open a photo and select “Download original”.</p>}
      </div>
    </div>
  )
}
export { authedUrl }
