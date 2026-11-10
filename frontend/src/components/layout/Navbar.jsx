import { useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { homeFor, useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'

function ThemeToggle() {
  const { dark, toggle } = useTheme()
  return (
    <button onClick={toggle} className="btn-ghost !px-3" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
      <span aria-hidden>{dark ? '☀️' : '🌙'}</span>
    </button>
  )
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const location = useLocation()
  const [feedOpen, setFeedOpen] = useState(false)
  const feedActive = location.pathname.startsWith('/events')
    || location.pathname.startsWith('/feed')
    || location.pathname.startsWith('/watch')
    || location.pathname.startsWith('/notices')
    || location.pathname.startsWith('/documents')
  const link = ({ isActive }) =>
    `rounded-lg px-3 py-1.5 text-sm font-semibold transition ${isActive ? 'bg-gold-500/20 text-gold-600 dark:text-gold-300' : 'opacity-70 hover:opacity-100'}`

  const feedMenu = (mobile = false) => (
    <div className={`relative ${mobile ? 'shrink-0' : ''}`}>
      <button
        type="button"
        className={`${link({ isActive: feedActive })} inline-flex items-center gap-1`}
        aria-expanded={feedOpen}
        aria-haspopup="menu"
        onClick={() => setFeedOpen((open) => !open)}
        onKeyDown={(event) => event.key === 'Escape' && setFeedOpen(false)}
      >
        Feed <span className={`text-xs transition-transform ${feedOpen ? 'rotate-180' : ''}`} aria-hidden>⌄</span>
      </button>
      {feedOpen && (
        <div role="menu" className={`z-50 min-w-48 rounded-2xl border border-ink-900/10 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-ink-800 ${mobile ? 'fixed left-4 top-28' : 'absolute left-0 mt-2'}`}>
          <NavLink role="menuitem" to="/events" onClick={() => setFeedOpen(false)} className={({ isActive }) => `block rounded-xl px-3 py-2.5 text-sm font-semibold ${isActive ? 'bg-gold-500/15 text-gold-700 dark:text-gold-300' : 'opacity-75 hover:bg-ink-900/5 hover:opacity-100 dark:hover:bg-white/5'}`}>Events</NavLink>
          <NavLink role="menuitem" to="/feed" onClick={() => setFeedOpen(false)} className={({ isActive }) => `mt-1 block rounded-xl px-3 py-2.5 text-sm font-semibold ${isActive ? 'bg-gold-500/15 text-gold-700 dark:text-gold-300' : 'opacity-75 hover:bg-ink-900/5 hover:opacity-100 dark:hover:bg-white/5'}`}>Announcements</NavLink>
          <NavLink role="menuitem" to="/watch" onClick={() => setFeedOpen(false)} className={({ isActive }) => `mt-1 block rounded-xl px-3 py-2.5 text-sm font-semibold ${isActive ? 'bg-gold-500/15 text-gold-700 dark:text-gold-300' : 'opacity-75 hover:bg-ink-900/5 hover:opacity-100 dark:hover:bg-white/5'}`}>Live streaming &amp; videos</NavLink>
          <NavLink role="menuitem" to="/notices" onClick={() => setFeedOpen(false)} className={({ isActive }) => `mt-1 block rounded-xl px-3 py-2.5 text-sm font-semibold ${isActive ? 'bg-gold-500/15 text-gold-700 dark:text-gold-300' : 'opacity-75 hover:bg-ink-900/5 hover:opacity-100 dark:hover:bg-white/5'}`}>Notice board</NavLink>
          <NavLink role="menuitem" to="/documents" onClick={() => setFeedOpen(false)} className={({ isActive }) => `mt-1 block rounded-xl px-3 py-2.5 text-sm font-semibold ${isActive ? 'bg-gold-500/15 text-gold-700 dark:text-gold-300' : 'opacity-75 hover:bg-ink-900/5 hover:opacity-100 dark:hover:bg-white/5'}`}>Documents</NavLink>
        </div>
      )}
    </div>
  )

  return (
    <header className="sticky top-0 z-40 border-b border-ink-900/10 bg-paper-50/80 backdrop-blur-xl dark:border-white/10 dark:bg-ink-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white shadow-sm ring-1 ring-ink-900/10">
            <img src="/branding/ChurchLogo.png" alt="" className="h-9 w-9 object-contain" />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-base font-bold sm:text-lg">Honour Nation Church</span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-[.18em] opacity-55 sm:block">Worship · Fellowship · Community</span>
          </span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 sm:flex">
          <NavLink to="/" end className={link}>Home</NavLink>
          <Link to="/#about" className="rounded-lg px-3 py-1.5 text-sm font-semibold opacity-70 transition hover:opacity-100">About</Link>
          <Link to="/#services" className="rounded-lg px-3 py-1.5 text-sm font-semibold opacity-70 transition hover:opacity-100">Services</Link>
          <NavLink to="/visit" className={link}>Visit</NavLink>
          <NavLink to="/contact" className={link}>Contact</NavLink>
          {feedMenu()}
          <NavLink to="/gallery" className={link}>Gallery</NavLink>
          {user?.role === 'admin' && <NavLink to="/admin" className={link}>Admin</NavLink>}
          {user && ['admin', 'editor'].includes(user.role) && <NavLink to="/editor" className={link}>Editor</NavLink>}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <>
              <span className="hidden text-sm opacity-70 md:inline">{user.full_name} · <span className="capitalize">{user.role}</span></span>
              <button className="btn-ghost" onClick={() => { logout(); nav('/') }}>Sign out</button>
            </>
          ) : (
            <Link to="/login" className="btn-primary">Sign in</Link>
          )}
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-4 pb-2 sm:hidden">
        <NavLink to="/" end className={link}>Home</NavLink>
        <Link to="/#about" className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold opacity-70">About</Link>
        <Link to="/#services" className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold opacity-70">Services</Link>
        <NavLink to="/visit" className={link}>Visit</NavLink>
        <NavLink to="/contact" className={link}>Contact</NavLink>
        {feedMenu(true)}
        <NavLink to="/gallery" className={link}>Gallery</NavLink>
        {user?.role === 'admin' && <NavLink to="/admin" className={link}>Admin</NavLink>}
        {user && ['admin', 'editor'].includes(user.role) && <NavLink to="/editor" className={link}>Editor</NavLink>}
      </nav>
    </header>
  )
}

export { homeFor }
