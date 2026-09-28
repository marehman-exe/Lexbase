// ProtectedRoute.tsx — redirects to /login if not authenticated
// optionally checks role — redirects to /unauthorized if role does not match
// Wrap any route element with this component to make it require a login.

// Navigate performs a client-side redirect without a page reload
import { Navigate } from 'react-router-dom'
// useAuth provides access to the current user from the AuthContext
import { useAuth } from '../context/AuthContext'
// UserRole type used to validate that the user's role is in the allowed list
import type { UserRole } from '../types/auth'

// Props the wrapper accepts:
// children — the page component to render if access is allowed
// roles    — optional list of roles permitted to view this route
interface Props {
  children: React.ReactNode
  roles?: UserRole[]
}

// Full-screen loading splash shown while the auth session is being resolved.
// Matches the app background colour so there is no white flash.
function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f3ee',
      }}
    >
      {/* Pulsing navy circle — simple, no external dependency */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: '3px solid #d9ddd8',
          borderTopColor: '#0b1f33',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// Guard component: checks auth state and role before rendering children
export default function ProtectedRoute({ children, roles }: Props) {
  // Read the currently signed-in user and the initialising flag from auth context
  const { user, initialising } = useAuth()

  // AuthProvider is still resolving the session (e.g. silently refreshing an
  // expired access token on page load). Show a branded loading screen so
  // the user never sees a blank white page during this window.
  if (initialising) return <LoadingScreen />

  // No user in state means the session is missing — send them to login
  if (!user) return <Navigate to="/login" replace />

  // A roles list was provided and the user's role is not in it — deny access
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />
  }

  // All checks passed — render the actual protected page content
  return <>{children}</>
}
