import { endpoints } from '../../api/client'
import StatusBadge from '../ui/StatusBadge'
import { useToast } from '../ui/Toast'

export default function RequestQueue({ requests, onChange }) {
  const toast = useToast()
  const decide = async (r, approve) => {
    try { await endpoints.decide(r.id, approve); toast(approve ? 'Access approved' : 'Request denied'); onChange() } catch (e) { toast(e.message, 'error') }
  }
  if (!requests.length) return <p className="card p-10 text-center opacity-70">No download requests yet.</p>
  return (
    <div className="card divide-y divide-ink-900/10 overflow-hidden dark:divide-white/10">
      {requests.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="truncate font-semibold">{r.user_name} <span className="font-normal opacity-60">wants</span> {r.event_title}</p>
            <p className="truncate text-xs opacity-60">{r.user_email} · {new Date(r.created_at).toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={r.status} />
            {r.status !== 'approved' && <button className="btn-primary" onClick={() => decide(r, true)}>Approve</button>}
            {r.status !== 'denied' && <button className="btn-ghost" onClick={() => decide(r, false)}>{r.status === 'approved' ? 'Revoke' : 'Deny'}</button>}
          </div>
        </div>
      ))}
    </div>
  )
}
