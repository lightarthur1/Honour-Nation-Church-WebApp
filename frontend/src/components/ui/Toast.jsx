import { createContext, useCallback, useContext, useState } from 'react'

const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((message, kind = 'ok') => {
    const id = Math.random()
    setItems((s) => [...s, { id, message, kind }])
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 4200)
  }, [])

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div key={t.id} className={`pointer-events-auto animate-rise rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg ${
            t.kind === 'error' ? 'bg-rose-600 text-white' : 'bg-ink-900 text-paper-50 dark:bg-paper-100 dark:text-ink-900'}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
