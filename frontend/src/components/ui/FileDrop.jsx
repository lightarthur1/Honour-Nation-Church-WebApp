import { useRef, useState } from 'react'
import ProgressBar from './ProgressBar'

export default function FileDrop({ label, hint, onFile, disabled }) {
  const input = useRef(null)
  const [over, setOver] = useState(false)
  const [progress, setProgress] = useState(null)
  const [name, setName] = useState('')

  const handle = async (file) => {
    if (!file) return
    setName(file.name); setProgress(0)
    try { await onFile(file, setProgress) } finally { setProgress(null) }
  }

  return (
    <div>
      <button type="button" disabled={disabled || progress !== null} onClick={() => input.current.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files[0]) }}
        className={`flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition
          disabled:cursor-not-allowed disabled:opacity-50
          ${over ? 'border-gold-500 bg-gold-500/10' : 'border-ink-900/20 hover:border-gold-500/60 dark:border-white/20'}`}>
        <span className="text-2xl" aria-hidden>📦</span>
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs opacity-60">{hint}</span>
      </button>
      <input ref={input} type="file" accept=".zip,application/zip" hidden
        onChange={(e) => { handle(e.target.files[0]); e.target.value = '' }} />
      {progress !== null && <div className="mt-3"><ProgressBar value={progress} label={`Uploading ${name}`} /></div>}
    </div>
  )
}
