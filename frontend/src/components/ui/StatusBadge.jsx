const STYLES = {
  green: 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
  amber: 'bg-gold-500/15 text-gold-600 ring-gold-500/40 dark:text-gold-300',
  red: 'bg-rose-500/15 text-rose-700 ring-rose-500/30 dark:text-rose-300',
  slate: 'bg-slate-500/15 text-slate-600 ring-slate-500/30 dark:text-slate-300',
  blue: 'bg-sky-500/15 text-sky-700 ring-sky-500/30 dark:text-sky-300',
}

const MAP = {
  // download permission
  approved: ['green', 'Download approved'],
  pending: ['amber', 'Request pending'],
  denied: ['red', 'Request denied'],
  none: ['slate', 'Locked'],
  staff: ['blue', 'Staff access'],
  // pipeline
  processing: ['amber', 'Processing'],
  synced: ['green', 'Synced to Drive'],
  failed: ['red', 'Failed'],
  available: ['green', 'On server'],
  deleted: ['slate', 'Deleted from server'],
}

export default function StatusBadge({ status, label }) {
  const [tone, text] = MAP[status] || ['slate', status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${STYLES[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${status === 'processing' ? 'animate-pulse' : ''}`} />
      {label || text}
    </span>
  )
}
