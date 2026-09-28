// LoginPage.tsx — LexBase login with ui.html visual identity
// This is the first screen users see when they visit the app.
// It collects email and password, calls the login API, and on success
// stores the tokens and navigates to the dashboard.

// useState manages the form field values and UI loading/error state
import { useState } from 'react'
// useNavigate lets us redirect the user to the dashboard after login
import { useNavigate } from 'react-router-dom'
// useAuth gives us the login() helper that stores the user in context
import { useAuth } from '../context/AuthContext'
// The pre-configured axios instance that points at the backend
import api from '../lib/api'
// TypeScript shape of the JSON response body from the login endpoint
import type { TokenResponse } from '../types/auth'

// Full-page login form component — no auth required to render this
export default function LoginPage() {
  // Pull the login helper out of the auth context
  const { login }  = useAuth()
  // Router hook used to redirect to /dashboard after successful login
  const navigate   = useNavigate()
  // Controlled state for each form field and the UI feedback states
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  // Called when the user submits the login form
  // Prevents the default browser form submission and calls the API
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // POST credentials to /auth/login and expect tokens in the response
      const { data } = await api.post<TokenResponse>('/auth/login', { email, password })
      // Store the tokens in localStorage and update the auth context state
      login(data.access_token, data.refresh_token, data.must_change_pw)
      // Navigate to the main dashboard now that login succeeded
      navigate('/dashboard')
    } catch {
      // Show a generic error message — do not reveal whether the email exists
      setError('Invalid email or password')
    } finally {
      // Always re-enable the submit button whether the request succeeded or not
      setLoading(false)
    }
  }

  return (
    // Full-screen centred container with the app background colour
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: '#f5f3ee' }}
    >
      {/* Narrow card column that holds the brand and the form */}
      <div className="w-full max-w-sm">
        {/* Brand */}
        {/* Navy logo square with the gold scales icon and app name */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 rounded-2xl items-center justify-center shadow-lg mb-4"
               style={{ backgroundColor: '#0b1f33' }}>
            {/* Scales of justice SVG icon in brand gold colour */}
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c58b2a"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v18M5 6l-2 8h4L5 6zM19 6l-2 8h4L19 6z"/>
              <path d="M3 20h18"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold" style={{ color: '#102a43' }}>LexBase</h1>
          <p className="mt-1 text-sm" style={{ color: '#667085' }}>Legal Knowledge Assistant</p>
        </div>

        {/* Card */}
        {/* White rounded card containing the sign-in form */}
        <div className="rounded-3xl border bg-white p-8" style={{ borderColor: '#d9ddd8' }}>
          <h2 className="text-lg font-semibold mb-6" style={{ color: '#102a43' }}>
            Sign in to your workspace
          </h2>

          {/* Login form with noValidate so we control validation ourselves */}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email address input field with gold focus ring */}
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#102a43' }}>
                Email address
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-xl border py-3 px-4 text-sm focus:outline-none"
                style={{ borderColor: '#cfd6d1', backgroundColor: '#fbfcfa', color: '#102a43' }}
                // Show gold outline ring when the user clicks into this field
                onFocus={e => {
                  e.currentTarget.style.boxShadow = '0 0 0 2px #c58b2a'
                  e.currentTarget.style.borderColor = '#c58b2a'
                }}
                // Remove the gold ring when the user moves to another element
                onBlur={e => {
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.borderColor = '#cfd6d1'
                }}
              />
            </div>

            {/* Password input field with the same gold focus ring behaviour */}
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#102a43' }}>
                Password
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-xl border py-3 px-4 text-sm focus:outline-none"
                style={{ borderColor: '#cfd6d1', backgroundColor: '#fbfcfa', color: '#102a43' }}
                onFocus={e => {
                  e.currentTarget.style.boxShadow = '0 0 0 2px #c58b2a'
                  e.currentTarget.style.borderColor = '#c58b2a'
                }}
                onBlur={e => {
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.borderColor = '#cfd6d1'
                }}
              />
            </div>

            {/* Red error banner — only shown when the login attempt failed */}
            {error && (
              <div className="rounded-xl px-4 py-3 text-sm font-semibold"
                   style={{ backgroundColor: '#f4e9ea', color: '#8c3b45' }}>
                {error}
              </div>
            )}

            {/* Submit button — disabled while loading or if fields are empty */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full rounded-xl py-3.5 text-sm font-bold text-white
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ backgroundColor: '#386641' }}
              // Darken the button on hover to provide visual hover feedback
              onMouseEnter={e => {
                if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = '#2e5636'
              }}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#386641'}
            >
              {/* Show spinner text while the request is in flight */}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Footnote reminding users that credentials come from their admin */}
        <p className="text-center text-xs mt-6" style={{ color: '#aab4ad' }}>
          Your credentials are managed by your firm administrator.
        </p>
      </div>
    </div>
  )
}
