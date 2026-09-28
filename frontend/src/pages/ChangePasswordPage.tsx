// ChangePasswordPage.tsx — forced first-login password change, ui.html identity

// React hook for managing form field values and UI state
import { useState } from 'react'
// Pre-configured axios instance pointing at the backend API
import api from '../lib/api'

// Props expected by ChangePasswordPage — called once the password is successfully updated
interface Props {
  onDone: () => void | Promise<void>
}

// Full-screen forced password-change page shown when must_change_pw is true after login
export default function ChangePasswordPage({ onDone }: Props) {
  // Controlled state for the current password field
  const [current, setCurrent] = useState('')
  // Controlled state for the new password field
  const [next,    setNext]    = useState('')
  // Controlled state for the confirmation password field
  const [confirm, setConfirm] = useState('')
  // Error message displayed when validation or the API call fails
  const [error,   setError]   = useState('')
  // True while the change-password API request is in flight to disable the button
  const [loading, setLoading] = useState(false)

  // Validates the form values and submits the new password to the backend
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    // Client-side validation: enforce minimum length before hitting the server
    if (next.length < 8) { setError('New password must be at least 8 characters'); return }
    // Confirm password must match the new password exactly
    if (next !== confirm) { setError('Passwords do not match'); return }
    // Prevent the user from setting the same password they already have
    if (next === current) { setError('New password must differ from the current one'); return }
    setLoading(true)
    try {
      // POST current and new passwords to the change-password endpoint
      await api.post('/auth/change-password', { current_password: current, new_password: next })
      // Mark the forced-change requirement as satisfied in localStorage
      localStorage.setItem('must_change_pw', 'false')
      // Notify the parent so it can redirect the user to the dashboard
      onDone()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setError(e.response?.data?.detail ?? 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    // Full-screen container with the app's cream background and subtle dot pattern
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundColor: '#f5f3ee',
        backgroundImage: 'radial-gradient(rgba(11,31,51,.04) .75px, transparent .75px)',
        backgroundSize: '11px 11px',
      }}
    >
      {/* Narrow centred column constraining the brand mark and the card */}
      <div className="w-full max-w-sm">
        {/* Brand */}
        {/* Navy logo square with the gold scales icon and LexBase wordmark */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 rounded-2xl items-center justify-center shadow-lg mb-4"
               style={{ backgroundColor: '#0b1f33' }}>
            {/* Scales of justice SVG icon rendered in brand gold inside the navy square */}
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c58b2a"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v18M5 6l-2 8h4L5 6zM19 6l-2 8h4L19 6z"/>
              <path d="M3 20h18"/>
            </svg>
          </div>
          {/* Application name displayed in the display font below the logo */}
          <h1 className="display-font text-3xl font-semibold" style={{ color: '#102a43' }}>LexBase</h1>
        </div>

        {/* Card */}
        {/* White rounded card containing the forced password-change form */}
        <div className="rounded-3xl border bg-white p-8" style={{ borderColor: '#d9ddd8' }}>
          {/* Card header explaining why the user must set a new password now */}
          <div className="mb-6">
            <h2 className="display-font text-xl font-semibold" style={{ color: '#102a43' }}>
              Set your password
            </h2>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: '#667085' }}>
              Your account requires a new password before you can continue.
            </p>
          </div>

          {/* Password change form — noValidate so we handle all validation ourselves */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Three password inputs rendered from an array: current, new, and confirm */}
            {[
              ['Current password', current,  setCurrent],
              ['New password',     next,     setNext   ],
              ['Confirm new',      confirm,  setConfirm],
            ].map(([label, val, setter]) => (
              <div key={label as string}>
                {/* Label for each password field derived from the array tuple */}
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#102a43' }}>
                  {label as string}
                </label>
                {/* Password input with gold focus ring applied via inline event handlers */}
                <input
                  type="password"
                  value={val as string}
                  onChange={e => (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)}
                  required
                  className="w-full rounded-xl border py-3 px-4 text-sm focus:outline-none"
                  style={{ borderColor: '#cfd6d1', backgroundColor: '#fbfcfa', color: '#102a43' }}
                  // Apply the gold focus ring when the user clicks into the input
                  onFocus={e => {
                    e.currentTarget.style.boxShadow = '0 0 0 2px #c58b2a'
                    e.currentTarget.style.borderColor = '#c58b2a'
                  }}
                  // Remove the focus ring when the user moves to another element
                  onBlur={e => {
                    e.currentTarget.style.boxShadow = 'none'
                    e.currentTarget.style.borderColor = '#cfd6d1'
                  }}
                />
              </div>
            ))}

            {/* Red error banner — shown when validation or the API call returns an error */}
            {error && (
              <div className="rounded-xl px-4 py-3 text-sm font-semibold"
                   style={{ backgroundColor: '#f4e9ea', color: '#8c3b45' }}>
                {error}
              </div>
            )}

            {/* Submit button — disabled while loading or while any field is empty */}
            <button
              type="submit"
              disabled={loading || !current || !next || !confirm}
              className="w-full rounded-xl py-3.5 text-sm font-bold text-white
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ backgroundColor: '#386641' }}
              // Darken the button on hover only when it is not in the loading state
              onMouseEnter={e => {
                if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = '#2e5636'
              }}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#386641'}
            >
              {/* Button text switches to an in-progress message while the request runs */}
              {loading ? 'Saving…' : 'Set new password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
