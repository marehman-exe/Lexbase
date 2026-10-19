// AuthContext.tsx — auth state, AuthProvider, and useAuth hook.

import { createContext, useContext, useState, useEffect, useRef } from 'react'
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

  // initialising is only true when there IS a refresh token to try — a brand-new
  // visitor has no token at all, so we start false and never show a loading screen.
  const [initialising, setInitialising] = useState(() => {
    const accessToken  = localStorage.getItem('access_token')
    const refreshToken = localStorage.getItem('refresh_token')
    const mustChangePw = localStorage.getItem('must_change_pw') === 'true'
    const validAccess  = accessToken ? decodeUser(accessToken, mustChangePw) : null
    // Only need async init if access token is expired but refresh token exists
    return validAccess === null && refreshToken !== null
  })

  useEffect(() => {
    // Nothing to do — either already resolved or no refresh token to try
    if (!initialising) return

    cancelledRef.current = false

    async function tryRefresh() {
      const refreshToken = localStorage.getItem('refresh_token')
      const mustChangePw = localStorage.getItem('must_change_pw') === 'true'

      if (refreshToken && import.meta.env.VITE_API_BASE_URL) {
        try {
          const res = await fetch(
            `${import.meta.env.VITE_API_BASE_URL}/auth/refresh`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refresh_token: refreshToken }),
            },
          )
          if (cancelledRef.current) return
          if (res.ok) {
            const data = await res.json()
            localStorage.setItem('access_token', data.access_token)
            localStorage.setItem('refresh_token', data.refresh_token)
            setUser(decodeUser(data.access_token, mustChangePw))
          } else {
            clearStorage()
          }
        } catch {
          if (!cancelledRef.current) clearStorage()
        }
      } else {
        clearStorage()
      }

      if (!cancelledRef.current) setInitialising(false)
    }

    tryRefresh()
    return () => { cancelledRef.current = true }
  }, [initialising])

  // cancelledRef lets login() cancel any in-flight refresh so it can't
  // wipe the freshly-logged-in user after login() already set the state.
  const cancelledRef = useRef(false)

  function login(accessToken: string, refreshToken: string, mustChangePw = false) {
    // Cancel any background refresh that is still in-flight
    cancelledRef.current = true
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)
    localStorage.setItem('must_change_pw', String(mustChangePw))
    setUser(decodeUser(accessToken, mustChangePw))
    // Mark initialisation as done so ProtectedRoute renders immediately
    setInitialising(false)
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
