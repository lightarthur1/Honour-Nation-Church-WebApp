import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { endpoints, getToken, setToken } from '../api/client'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(!!getToken())

  useEffect(() => {
    if (!getToken()) return
    endpoints.me().then(setUser).catch(() => setToken(null)).finally(() => setLoading(false))
  }, [])

  const finish = useCallback((res) => { setToken(res.access_token); setUser(res.user); return res.user }, [])
  const login = useCallback(async (email, password) => finish(await endpoints.login({ email, password })), [finish])
  const register = useCallback(async (b) => finish(await endpoints.register(b)), [finish])
  const logout = useCallback(() => { setToken(null); setUser(null) }, [])

  return <AuthCtx.Provider value={{ user, loading, login, register, logout }}>{children}</AuthCtx.Provider>
}

export const homeFor = (role) => (role === 'admin' ? '/admin' : role === 'editor' ? '/editor' : '/')
