// App.tsx — route definitions
// This file declares every URL route in the application
// and decides which page component to render for each path.

// Import React Router utilities for declarative routing
import { Routes, Route, Navigate } from 'react-router-dom'
// Import the login page shown to unauthenticated users
import LoginPage from './pages/LoginPage'
// Import the main dashboard shown after a successful login
import DashboardPage from './pages/DashboardPage'
// Import the guard component that blocks unauthenticated access
import ProtectedRoute from './components/ProtectedRoute'

// Root application component — renders the route tree
export default function App() {
  return (
    // Routes container — only the first matching Route is rendered
    <Routes>
      {/* Public route: anyone can visit /login without being signed in */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected route: /dashboard is only accessible to signed-in users */}
      <Route
        path="/dashboard"
        element={
          // ProtectedRoute checks auth state and redirects to /login if needed
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      {/* Catch-all — redirect to login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
