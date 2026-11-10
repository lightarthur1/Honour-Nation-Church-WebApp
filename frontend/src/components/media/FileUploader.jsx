import { useRef, useState } from 'react'
import { errorMessage } from '../../api/client'
import { ErrorNotice } from '../ui/Feedback'
import Icon from '../ui/Icon'
import ProgressBar from '../ui/ProgressBar'

/** ZIP picker with drag-and-drop and upload progress.
 *  `onUpload(file, onProgress)` must return a promise. */
export default function FileUploader({ title, hint, onUpload, onDone }) {
  const input = useRef(null)
  const [drag, setDrag] = useState(false)
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function start(f) {
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.zip')) {
      setError('Choose a .zip file. Zip the folder first, then upload the zip.')
      return
    }
    setError('')
    setFile(f)
    setProgress(0)
    setBusy(true)
    try {
      await onUpload(f, setProgress)
      onDone?.()
    } catch (e) {
      setError(errorMessage(e, 'Upload failed.'))
    } finally {
      setBusy(false)
      setFile(null)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          if (!busy) start(e.dataTransfer.files?.[0])
        }}
        className={`rounded-xl border border-dashed p-5 transition ${
          drag ? 'border-accent bg-accent/10' : 'border-line bg-bg/40'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{title}</p>
            {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
          </div>
          <button className="btn-ghost" disabled={busy} onClick={() => input.current?.click()}>
            <Icon name="upload" /> Choose ZIP
          </button>
          <input
            ref={input}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={(e) => start(e.target.files?.[0])}
          />
        </div>
        {busy && file && (
          <div className="mt-4">
            <ProgressBar
              value={progress}
              label={progress >= 1 ? `Checking ${file.name}` : `Uploading ${file.name}`}
            />
          </div>
        )}
      </div>
      <div className="mt-2">
        <ErrorNotice>{error}</ErrorNotice>
      </div>
    </div>
  )
}
