// DashboardPage.tsx — enterprise application shell with sidebar
// This is the main layout wrapper rendered after a successful login.
// It holds the Sidebar and swaps the right-hand content area based on
// which navigation item the user has clicked.

// useState tracks which page is currently displayed in the content area
import { useState } from 'react'
// useNavigate lets us send the user back to /login after sign-out
import { useNavigate } from 'react-router-dom'
// useAuth provides the current user object and the logout helper
import { useAuth } from '../context/AuthContext'
// The shared axios instance used to call the logout endpoint on the server
import api from '../lib/api'
// Sidebar renders the left-hand navigation panel
import Sidebar from '../components/Sidebar'
// Page shown when the user must set a new password on first login
import ChangePasswordPage from './ChangePasswordPage'
// Inner pages rendered in the main content area based on active navigation
import AdminPage from './AdminPage'
import TeamPage from './TeamPage'
import DocumentsPage from './DocumentsPage'
import ResearchPage from './ResearchPage'
import SettingsPage from './SettingsPage'

// Determine which page to show first based on the user's role.
// Super admins land on the lawyer management page; everyone else sees research.
function defaultPage(role: string): string {
  if (role === 'super_admin') return 'lawyers'
  return 'research'
}

// Main authenticated shell — renders sidebar + active inner page
export default function DashboardPage() {
  // Destructure user info and auth helpers from the auth context
  const { user, login, logout } = useAuth()
  const navigate  = useNavigate()
  // Track which section key is currently active in the sidebar
  const [page, setPage] = useState(() => defaultPage(user?.role ?? ''))

  // Force password change on first login
  // If mustChangePw is true the user cannot access any other page yet
  if (user?.mustChangePw) {
    return (
      // Render the change-password screen instead of the normal dashboard
      <ChangePasswordPage
        onDone={async () => {
          // Refresh the token pair so we never hand a stale/expired access token
          // back into login() — an expired token makes decodeUser return null,
          // which clears the user and causes an immediate redirect to /login.
          const storedRefresh = localStorage.getItem('refresh_token') ?? ''
          try {
            const res = await fetch(
              `${import.meta.env.VITE_API_BASE_URL}/auth/refresh`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: storedRefresh }),
              },
            )
            if (res.ok) {
              const data = await res.json()
              login(data.access_token, data.refresh_token, false)
              return
            }
          } catch { /* fall through to localStorage path */ }
          // Fallback: use the stored token as-is (still works within the 15-min window)
          const token = localStorage.getItem('access_token') ?? ''
          login(token, storedRefresh, false)
        }}
      />
    )
  }

  // Calls the server logout endpoint to invalidate the refresh token,
  // then clears local state and redirects the user to the login page
  async function handleSignOut() {
    const refreshToken = localStorage.getItem('refresh_token')
    if (refreshToken) {
      // Fire-and-forget — we log out locally even if the server call fails
      await api.post('/auth/logout', { refresh_token: refreshToken }).catch(() => {})
    }
    logout()
    navigate('/login')
  }

  // Derive a display name from userId (we only have the ID in the token)
  // We take the first 8 characters so the sidebar doesn't overflow
  const displayName = user?.userId?.slice(0, 8) ?? 'User'

  return (
    // Full-height flex row: sidebar on the left, content area on the right
    <div className="flex min-h-screen" style={{ backgroundColor: '#f5f3ee' }}>
      {/* Sidebar receives the active page key and a callback to change it */}
      <Sidebar
        role={user!.role}
        active={page}
        onNavigate={setPage}
        userName={displayName}
        firmId={user?.firmId ?? null}
        onSignOut={handleSignOut}
      />

      {/* Scrollable main content area — renders the active inner page */}
      <main className="flex-1 overflow-auto min-w-0">
        <div className="p-6 lg:p-8 w-full">
          {/* Conditionally render each page based on the active sidebar key */}
          {page === 'lawyers'   && <AdminPage />}
          {page === 'research'  && <ResearchPage />}
          {page === 'documents' && <DocumentsPage />}
          {page === 'team'      && <TeamPage />}
          {/* SettingsPage gets a callback to return to the default page after a password change */}
          {page === 'settings'  && (
            <SettingsPage
              onPasswordChanged={() => setPage(defaultPage(user?.role ?? ''))}
            />
          )}
        </div>
      </main>
    </div>
  )
}
