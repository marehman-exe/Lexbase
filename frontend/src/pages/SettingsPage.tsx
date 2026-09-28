// SettingsPage.tsx — account settings with role permissions matrix

// React hook for managing local form state
import { useState } from 'react'
// Auth context hook to read the currently logged-in user's details
import { useAuth } from '../context/AuthContext'
// Pre-configured axios instance pointing at the backend API
import api from '../lib/api'

// Props expected by the SettingsPage component from its parent
interface Props {
  onPasswordChanged: () => void
}

// Human-readable display names for each role key stored in the JWT
const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  lawyer:      'Lawyer',
  associate:   'Associate',
  paralegal:   'Paralegal',
}

// Shared inline style object applied to every password input field
const inputStyle: React.CSSProperties = {
  borderColor: '#cfd6d1',
  backgroundColor: '#fbfcfa',
  color: '#102a43',
}

// Applies a gold focus ring to the input when the user clicks into it
function focusGold(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.boxShadow = '0 0 0 2px #c58b2a'
  e.currentTarget.style.borderColor = '#c58b2a'
}
// Removes the gold focus ring when focus leaves the input field
function blurReset(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.boxShadow = 'none'
  e.currentTarget.style.borderColor = '#cfd6d1'
}

// ── Role permissions matrix ───────────────────────────────────────────────────

// Green tick SVG icon indicating that a role has access to a given permission
const IcoTick = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#386641"
       strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

// Muted grey cross SVG icon indicating that a role does not have a permission
const IcoCross = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#aab4ad"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

// Shape of a single row in the role permissions table
interface PermRow {
  label:       string
  lawyer:      boolean
  associate:   boolean
  paralegal:   boolean
}

// Static array defining which permissions each role has within the firm workspace
const PERMS: PermRow[] = [
  { label: 'Legal Research',        lawyer: true,  associate: true,  paralegal: true  },
  { label: 'View Documents',        lawyer: true,  associate: true,  paralegal: true  },
  { label: 'Upload Documents',      lawyer: true,  associate: false, paralegal: false },
  { label: 'Delete Documents',      lawyer: true,  associate: false, paralegal: false },
  { label: 'AI Summarisation',      lawyer: true,  associate: true,  paralegal: false },
  { label: 'Manage Team Members',   lawyer: true,  associate: false, paralegal: false },
  { label: 'View Index Status',     lawyer: true,  associate: true,  paralegal: true  },
]

// Card component that renders the read-only role permissions matrix table
function RolePermissionsCard() {
  // Define the three firm roles to render as columns in the table
  const roles: Array<{ key: 'lawyer' | 'associate' | 'paralegal'; label: string }> = [
    { key: 'lawyer',    label: 'Lawyer'    },
    { key: 'associate', label: 'Associate' },
    { key: 'paralegal', label: 'Paralegal' },
  ]

  return (
    <div className="rounded-2xl border bg-white overflow-hidden mb-5"
         style={{ borderColor: '#d9ddd8' }}>
      {/* Card header with title and subtitle describing the matrix purpose */}
      <div className="px-6 py-4 border-b" style={{ borderColor: '#d9ddd8' }}>
        <p className="text-sm font-semibold" style={{ color: '#102a43' }}>Role Permissions</p>
        <p className="text-xs mt-0.5" style={{ color: '#667085' }}>
          What each role can do in your firm workspace.
        </p>
      </div>
      {/* Permissions matrix table — one row per permission, one column per role */}
      <table className="w-full text-sm">
        {/* Column headers: Permission label followed by one header per role */}
        <thead style={{ backgroundColor: '#f7f8f5', borderBottom: '1px solid #d9ddd8' }}>
          <tr>
            <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-[.12em]"
                style={{ color: '#667085' }}>
              Permission
            </th>
            {/* Render one column header for each role key */}
            {roles.map(r => (
              <th key={r.key}
                  className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-[.12em]"
                  style={{ color: '#667085' }}>
                {r.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* One row per permission — tick or cross per role column */}
          {PERMS.map((p, i) => (
            <tr key={p.label}
                style={{ borderTop: i > 0 ? '1px solid #f0f2f0' : undefined }}>
              {/* Permission name label in the first column */}
              <td className="px-6 py-3 text-sm" style={{ color: '#34495e' }}>
                {p.label}
              </td>
              {/* Render a tick or cross for each role based on the PERMS data */}
              {roles.map(r => (
                <td key={r.key} className="px-4 py-3 text-center">
                  <span className="inline-flex items-center justify-center">
                    {p[r.key] ? <IcoTick /> : <IcoCross />}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

// Main Settings page — shows account info, role permissions, and password change form
export default function SettingsPage({ onPasswordChanged }: Props) {
  // Read the logged-in user from context to display their role and IDs
  const { user }               = useAuth()
  // Controlled values for the three password fields in the change-password form
  const [current,  setCurrent]  = useState('')
  const [next,     setNext]     = useState('')
  const [confirm,  setConfirm]  = useState('')
  // Error message shown in red when validation fails or the API returns an error
  const [error,    setError]    = useState('')
  // True after a successful password change to show the green success banner
  const [success,  setSuccess]  = useState(false)
  // True while the change-password API request is in flight to disable the button
  const [loading,  setLoading]  = useState(false)

  // Validates the form inputs and submits the change-password request to the backend
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess(false)
    // Enforce minimum length, character complexity, match, and novelty rules client-side
    if (next.length < 8)              { setError('Password must be at least 8 characters'); return }
    if (!/[A-Z]/.test(next))          { setError('Password must contain at least one uppercase letter'); return }
    if (!/[a-z]/.test(next))          { setError('Password must contain at least one lowercase letter'); return }
    if (!/\d/.test(next))             { setError('Password must contain at least one number'); return }
    if (!/[^A-Za-z0-9]/.test(next))   { setError('Password must contain at least one special character'); return }
    if (next !== confirm)              { setError('Passwords do not match'); return }
    if (next === current)              { setError('New password must differ from current'); return }
    setLoading(true)
    try {
      // POST the current and new password to the backend change-password endpoint
      await api.post('/auth/change-password', { current_password: current, new_password: next })
      // Clear the forced-change flag so the app no longer redirects to this page
      localStorage.setItem('must_change_pw', 'false')
      setSuccess(true)
      // Reset all three password fields after a successful change
      setCurrent(''); setNext(''); setConfirm('')
      // Notify the parent component after 1.2 seconds to allow the success banner to show
      setTimeout(() => onPasswordChanged(), 1200)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setError(e.response?.data?.detail ?? 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  // Shared Tailwind class string for the two info cards on this page
  const card       = "rounded-2xl border bg-white p-6 max-w-lg"
  // Inline border colour shared between all cards on the settings page
  const cardBorder = { borderColor: '#d9ddd8' }

  return (
    <div>
      {/* ── Page header ── */}
      {/* Page title and subtitle giving context about what settings are available */}
      <header className="mb-8">
        <h1 className="text-2xl font-semibold" style={{ color: '#102a43' }}>Settings</h1>
        <p className="mt-2 leading-relaxed" style={{ color: '#667085' }}>
          Manage your account and security.
        </p>
      </header>

      {/* ── Account info ── */}
      {/* Read-only card showing the user's role, user ID, and firm ID */}
      <div className={`${card} mb-5`} style={cardBorder}>
        <p className="text-sm font-semibold mb-4" style={{ color: '#102a43' }}>Account</p>
        <dl className="space-y-3 text-sm">
          {/* Role row — maps the raw role key to its human-readable display label */}
          <div className="flex justify-between">
            <dt style={{ color: '#667085' }}>Role</dt>
            <dd className="font-semibold" style={{ color: '#102a43' }}>
              {ROLE_LABELS[user?.role ?? ''] ?? user?.role}
            </dd>
          </div>
          {/* User ID row — shown in monospace as it is a machine-generated identifier */}
          <div className="flex justify-between">
            <dt style={{ color: '#667085' }}>User ID</dt>
            <dd className="font-mono text-xs" style={{ color: '#667085' }}>{user?.userId}</dd>
          </div>
          {/* Firm ID row — only rendered when the user belongs to a firm */}
          {user?.firmId && (
            <div className="flex justify-between">
              <dt style={{ color: '#667085' }}>Firm ID</dt>
              <dd className="font-mono text-xs" style={{ color: '#667085' }}>{user.firmId}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* ── Role permissions matrix (shown for firm roles only) ── */}
      {/* Only lawyers, associates, and paralegals see the permissions table */}
      {(user?.role === 'lawyer' || user?.role === 'associate' || user?.role === 'paralegal') && (
        <div className="max-w-lg">
          <RolePermissionsCard />
        </div>
      )}

      {/* ── Change password ── */}
      {/* Card containing the change-password form with client-side strength validation */}
      <div className={card} style={cardBorder}>
        <h2 className="text-base font-semibold mb-5" style={{ color: '#102a43' }}>
          Change Password
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Three password fields rendered from an array: current, new, and confirm */}
          {([
            ['Current password', current,  setCurrent, 'current-password'],
            ['New password',     next,     setNext,    'new-password'    ],
            ['Confirm new',      confirm,  setConfirm, 'new-password'    ],
          ] as [string, string, React.Dispatch<React.SetStateAction<string>>, string][]).map(
            ([label, val, setter, autoComplete]) => (
            <div key={label}>
              {/* Label for each password input derived from the array tuple */}
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#102a43' }}>
                {label}
              </label>
              {/* Password input with autocomplete hint, gold focus ring, and change handler */}
              <input
                type="password"
                value={val}
                onChange={e => setter(e.target.value)}
                autoComplete={autoComplete}
                required
                className="w-full rounded-xl border py-3 px-4 text-sm focus:outline-none"
                style={inputStyle}
                onFocus={focusGold}
                onBlur={blurReset}
              />
            </div>
          ))}

          {/* Red error banner — shown when validation or the API call fails */}
          {error && (
            <div className="rounded-xl px-4 py-3 text-sm font-semibold"
                 style={{ backgroundColor: '#f4e9ea', color: '#8c3b45' }}>
              {error}
            </div>
          )}
          {/* Green success banner — shown briefly after a successful password change */}
          {success && (
            <div className="rounded-xl px-4 py-3 text-sm font-semibold"
                 style={{ backgroundColor: '#e2eee4', color: '#386641' }}>
              Password updated ✓
            </div>
          )}

          {/* Submit button — disabled when loading or when any field is still empty */}
          <button
            type="submit"
            disabled={loading || !current || !next || !confirm}
            className="w-full rounded-xl py-3.5 text-sm font-bold text-white disabled:opacity-50 transition-colors"
            style={{ backgroundColor: '#386641' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#2e5636'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#386641'}
          >
            {/* Button label switches to a loading message while the request is in flight */}
            {loading ? 'Saving…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
