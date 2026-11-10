export default function ProgressBar({ value, label }) {
  return (
    <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="mb-1 flex justify-between text-xs font-medium opacity-70">
        <span>{label}</span><span>{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink-900/10 dark:bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-gold-600 to-gold-300 transition-[width] duration-200" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}
