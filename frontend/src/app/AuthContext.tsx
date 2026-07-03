import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, ApiError } from './api'
import type { UserResponse } from './api'

interface AuthState {
  user: UserResponse | null
  loading: boolean
  login: (usernameOrEmail: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

/** Cross-tab session events (e.g. logout pauses fights in other tabs). */
export const SESSION_CHANNEL = 'gloria-session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      setUser(await api.get<UserResponse>('/api/auth/me'))
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        // Access token may have expired; try the refresh token once.
        try {
          setUser(await api.post<UserResponse>('/api/auth/refresh'))
          return
        } catch {
          setUser(null)
        }
      } else {
        setUser(null)
      }
    }
  }, [])

  useEffect(() => {
    refreshUser().finally(() => setLoading(false))
  }, [refreshUser])

  const login = useCallback(async (usernameOrEmail: string, password: string) => {
    setUser(await api.post<UserResponse>('/api/auth/login', { usernameOrEmail, password }))
  }, [])

  const register = useCallback(async (username: string, email: string, password: string) => {
    setUser(await api.post<UserResponse>('/api/auth/register', { username, email, password }))
  }, [])

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout')
    setUser(null)
    // Tell every other tab (game dimensions included) the session ended.
    const channel = new BroadcastChannel(SESSION_CHANNEL)
    channel.postMessage({ type: 'logout' })
    channel.close()
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
