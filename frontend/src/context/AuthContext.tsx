// AuthContext.tsx — auth state, AuthProvider, and useAuth hook.

import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { jwtDecode } from 'jwt-decode'
import type { TokenPayload, UserRole } from '../types/auth'

// ── Types ──────────────────────────────────────────────────────────────────

export interface AuthUser {
  userId: string
  firmId: string | null
  role: UserRole
  mustChangePw: boolean
}

interface AuthContextValue {
  user: AuthUser | null
  initialising: boolean
  login: (accessToken: string, refreshToken: string, mustChangePw?: boolean) => void
  logout: () => void
}

// ── Context ────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

// ── Helpers ────────────────────────────────────────────────────────────────

function decodeUser(token: string, mustChangePw = false): AuthUser | null {
  try {
    const p = jwtDecode<TokenPayload>(token)
    if (p.exp && p.exp * 1000 < Date.now()) return null
    return { userId: p.user_id, firmId: p.firm_id, role: p.role, mustChangePw }
  } catch {
    return null
  }
}

function clearStorage() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('must_change_pw')
}

// ── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  // Synchronously restore a valid (non-expired) access token on page load.
  // initialising is only true when the token is missing/expired AND we need
  // an async refresh call — avoids any blank/flash for the common case.
  const [user, setUser] = useState<AuthUser | null>(() => {
    const token = localStorage.getItem('access_token')
    const mustChangePw = localStorage.getItem('must_change_pw') === 'true'
    return token ? decodeUser(token, mustChangePw) : null
  })

  const [initialising, setInitialising] = useState(() => {
    const token = localStorage.getItem('access_token')
    const mustChangePw = localStorage.getItem('must_change_pw') === 'true'
    const validToken = token ? decodeUser(token, mustChangePw) : null
    // If we already have a valid token there is nothing async to do
    return validToken === null
  })

  useEffect(() => {
    // If a valid access token was restored synchronously, we are done
    if (!initialising) return

    let cancelled = false

    async function tryRefresh() {
      const refreshToken = localStorage.getItem('refresh_token')
      const mustChangePw = localStorage.getItem('must_change_pw') === 'true'

      if (refreshToken) {
        try {
          const res = await fetch(
            `${import.meta.env.VITE_API_BASE_URL}/auth/refresh`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refresh_token: refreshToken }),
            },
          )
          if (cancelled) return
          if (res.ok) {
            const data = await res.json()
            localStorage.setItem('access_token', data.access_token)
            localStorage.setItem('refresh_token', data.refresh_token)
            setUser(decodeUser(data.access_token, mustChangePw))
          } else {
            clearStorage()
          }
        } catch {
          if (!cancelled) clearStorage()
        }
      } else {
        clearStorage()
      }

      if (!cancelled) setInitialising(false)
    }

    tryRefresh()
    return () => { cancelled = true }
  }, [initialising])

  function login(accessToken: string, refreshToken: string, mustChangePw = false) {
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)
    localStorage.setItem('must_change_pw', String(mustChangePw))
    setUser(decodeUser(accessToken, mustChangePw))
  }

  function logout() {
    clearStorage()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, initialising, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// ── Hook ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
