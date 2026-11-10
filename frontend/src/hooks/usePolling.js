import { useEffect, useRef } from 'react'

/** Calls `fn` every `ms` while `active` is true. */
export function usePolling(fn, active, ms = 2500) {
  const saved = useRef(fn)
  useEffect(() => { saved.current = fn }, [fn])
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => saved.current(), ms)
    return () => clearInterval(id)
  }, [active, ms])
}
