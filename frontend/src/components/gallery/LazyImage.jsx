import { useEffect, useRef, useState } from 'react'

/** Loads only when near the viewport; reserves space from known dimensions so the grid never jumps. */
export default function LazyImage({ src, alt, width, height, className = '' }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); io.disconnect() }
    }, { rootMargin: '300px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className={`relative overflow-hidden bg-ink-900/10 dark:bg-white/5 ${className}`}
      style={{ aspectRatio: width && height ? `${width} / ${height}` : '4 / 3' }}>
      {!loaded && <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent dark:via-white/10" />}
      {visible && (
        <img src={src} alt={alt} width={width} height={height} loading="lazy" decoding="async"
          onLoad={() => setLoaded(true)}
          className={`h-full w-full object-cover transition duration-500 ${loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`} />
      )}
    </div>
  )
}
