import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useToast } from '../components/ui/Toast'
import { homeFor, useAuth } from '../context/AuthContext'

export default function Login() {
  const { user, login, register } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const toast = useToast()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ full_name: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  if (user) return <Navigate to={loc.state?.from || homeFor(user.role)} replace />

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const u = mode === 'login' ? await login(form.email, form.password) : await register(form)
      nav(loc.state?.from || homeFor(u.role), { replace: true })
    } catch (err) { toast(err.message, 'error') } finally { setBusy(false) }
  }

  return (
    <main className="grid min-h-[calc(100vh-4rem)] place-items-center px-4 py-10">
      <form onSubmit={submit} className="card w-full max-w-md animate-rise space-y-4 p-8">
        <div>
          <h1 className="font-display text-3xl font-bold">{mode === 'login' ? 'Welcome back' : 'Join the gallery'}</h1>
          <p className="mt-1 text-sm opacity-60">{mode === 'login' ? 'Sign in to continue.' : 'Create an account to request high-res downloads.'}</p>
        </div>
        {mode === 'register' && (
          <div><label className="label" htmlFor="n">Full name</label><input id="n" required minLength={2} className="input" value={form.full_name} onChange={set('full_name')} /></div>
        )}
        <div><label className="label" htmlFor="e">Email</label><input id="e" type="email" required autoComplete="email" className="input" value={form.email} onChange={set('email')} /></div>
        <div><label className="label" htmlFor="p">Password</label>
          <input id="p" type="password" required minLength={mode === 'register' ? 8 : 1} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className="input" value={form.password} onChange={set('password')} />
          {mode === 'register' && <p className="mt-1 text-xs opacity-50">At least 8 characters.</p>}
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <button type="button" className="w-full text-center text-sm opacity-70 hover:opacity-100" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
      </form>
    </main>
  )
}
