// AdminPage.tsx — Super Admin: Lawyer account management, ui.html identity
// Only the super_admin role can access this page.
// It lets the platform operator create new lawyer accounts, view all existing
// ones, and suspend or reactivate them.

// useState manages local form field values and response display state
import { useState } from 'react'
// React Query hooks: useQuery fetches data, useMutation sends changes
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
// The shared axios instance for all authenticated API calls
import api from '../lib/api'

// Shape of a lawyer record returned by the backend list endpoint
interface LawyerOut {
  id:        string
  email:     string
  firm_id:   string | null
  is_active: boolean
}

// Shape of the response when a new lawyer account is successfully created
interface CreateLawyerResponse {
  user:             LawyerOut
  firm_id:          string
  // Temporary password shown once — the lawyer must change it on first login
  initial_password: string
}

// Shared Tailwind class string for all text inputs on this page
const inputCls = "w-full rounded-xl border py-3 px-4 text-sm focus:outline-none"
// Shared inline style object for all text inputs on this page
const inputStyle: React.CSSProperties = {
  borderColor: '#cfd6d1', backgroundColor: '#fbfcfa', color: '#102a43',
}

// Apply a gold focus ring when the user clicks into an input field
function focusGold(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.boxShadow = '0 0 0 2px #c58b2a'
  e.currentTarget.style.borderColor = '#c58b2a'
}

// Remove the gold focus ring when the input loses focus
function blurReset(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.boxShadow = 'none'
  e.currentTarget.style.borderColor = '#cfd6d1'
}

// Main page component for super-admin lawyer account management
export default function AdminPage() {
  // Get the query client so we can invalidate the lawyers list after mutations
  const qc = useQueryClient()
  // Controlled form fields for the create-lawyer form
  const [name,    setName]    = useState('')
  const [email,   setEmail]   = useState('')
  // Stores the newly created lawyer data to display the one-time credentials
  const [created, setCreated] = useState<CreateLawyerResponse | null>(null)
  // Holds an error message string when a mutation fails
  const [error,   setError]   = useState('')

  // Fetch the full list of lawyer accounts from the backend on mount
  const { data: lawyers = [] } = useQuery<LawyerOut[]>({
    queryKey: ['lawyers'],
    queryFn:  () => api.get('/admin/lawyers').then(r => r.data),
  })

  // Mutation for creating a new lawyer account via POST /admin/lawyers
  const createMutation = useMutation({
    mutationFn: (body: { name: string; email: string }) =>
      api.post<CreateLawyerResponse>('/admin/lawyers', body).then(r => r.data),
    onSuccess: (data) => {
      // Show the one-time credentials, clear the form, and refresh the list
      setCreated(data); setName(''); setEmail(''); setError('')
      qc.invalidateQueries({ queryKey: ['lawyers'] })
    },
    onError: (err: unknown) => {
      // Extract the detail message from the API error response if available
      const e = err as { response?: { data?: { detail?: string } } }
      setError(e.response?.data?.detail ?? 'Failed to create lawyer')
    },
  })

  // Mutation for suspending an active lawyer account via PATCH
  const suspendMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/lawyers/${id}/suspend`),
    // Refresh the lawyers list so the UI reflects the new suspended status
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['lawyers'] }),
  })

  // Mutation for reactivating a previously suspended lawyer account via PATCH
  const reactivateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/lawyers/${id}/reactivate`),
    // Refresh the lawyers list so the UI reflects the restored active status
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['lawyers'] }),
  })

  // Count how many lawyers are currently active for the KPI summary row
  const active = lawyers.filter(l => l.is_active).length

  return (
    <div>
      {/* ── Page header ── */}
      {/* Title and description at the very top of the admin page */}
      <header className="mb-8">
        <h1 className="text-2xl font-semibold" style={{ color: '#102a43' }}>Lawyer Accounts</h1>
        <p className="mt-2 leading-relaxed" style={{ color: '#667085' }}>
          Create and manage law firm access to LexBase.
        </p>
      </header>

      {/* KPI row */}
      {/* Three summary stat cards: total, active, and suspended lawyer counts */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Lawyers', value: lawyers.length, sub: 'registered firms'  },
          { label: 'Active',        value: active,         sub: 'active right now'  },
          { label: 'Suspended',     value: lawyers.length - active, sub: 'suspended accounts' },
        ].map(k => (
          <div key={k.label} className="rounded-2xl border bg-white p-5"
               style={{ borderColor: '#d9ddd8' }}>
            <p className="text-xs font-medium mb-2" style={{ color: '#667085' }}>{k.label}</p>
            <p className="text-2xl font-bold" style={{ color: '#102a43' }}>{k.value}</p>
            <p className="text-xs mt-1" style={{ color: '#aab4ad' }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Create form */}
      {/* Card with inputs for firm name and email to create a new lawyer */}
      <div className="rounded-2xl border bg-white p-6 mb-6 max-w-xl"
           style={{ borderColor: '#d9ddd8' }}>
        <h2 className="text-base font-semibold mb-5" style={{ color: '#102a43' }}>
          New Lawyer Account
        </h2>
        <div className="space-y-4">
          {/* Firm name input — the human-readable name for the law firm */}
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: '#102a43' }}>
              Firm name
            </label>
            <input
              placeholder="e.g. Chambers & Partners"
              value={name}
              onChange={e => setName(e.target.value)}
              className={inputCls}
              style={inputStyle}
              onFocus={focusGold}
              onBlur={blurReset}
            />
          </div>
          {/* Lawyer email input — used as the login username for this account */}
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: '#102a43' }}>
              Lawyer email
            </label>
            <input
              type="email"
              placeholder="lawyer@firm.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={inputCls}
              style={inputStyle}
              onFocus={focusGold}
              onBlur={blurReset}
            />
          </div>
          {/* Error banner shown when the create mutation returns an error */}
          {error && (
            <div className="rounded-xl px-4 py-3 text-sm font-semibold"
                 style={{ backgroundColor: '#f4e9ea', color: '#8c3b45' }}>
              {error}
            </div>
          )}
          {/* Submit button — disabled if either field is empty or a request is in flight */}
          <button
            onClick={() => createMutation.mutate({ name, email })}
            disabled={!name || !email || createMutation.isPending}
            className="w-full rounded-xl py-3.5 text-sm font-bold text-white disabled:opacity-50 transition-colors"
            style={{ backgroundColor: '#386641' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#2e5636'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#386641'}
          >
            {createMutation.isPending ? 'Creating…' : 'Create Lawyer Account'}
          </button>
        </div>

        {/* One-time credential banner — only shown immediately after a successful create */}
        {/* The admin must copy these credentials now; they will not be shown again */}
        {created && (
          <div className="mt-4 rounded-xl p-4 border"
               style={{ backgroundColor: '#fff2d8', borderColor: '#e8c97a' }}>
            <p className="text-xs font-bold mb-2" style={{ color: '#885b12' }}>
              Share these credentials once — they will not be shown again.
            </p>
            <p className="text-sm" style={{ color: '#102a43' }}>
              Email: <span className="font-semibold">{created.user.email}</span>
            </p>
            <p className="text-sm font-mono mt-1" style={{ color: '#102a43' }}>
              Password: {created.initial_password}
            </p>
            <p className="text-xs mt-2 font-mono" style={{ color: '#667085' }}>
              Firm ID: {created.firm_id}
            </p>
          </div>
        )}
      </div>

      {/* Lawyers table */}
      {/* Show an empty state illustration when no lawyers exist yet */}
      {lawyers.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-white p-14 text-center"
             style={{ borderColor: '#cfd6d1' }}>
          <div className="mx-auto h-14 w-14 rounded-full flex items-center justify-center mb-5"
               style={{ backgroundColor: '#e2eee4', color: '#386641' }}>
            {/* Scales icon in a green circle for the empty state illustration */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v18M5 6l-2 8h4L5 6zM19 6l-2 8h4L19 6z"/>
              <path d="M3 20h18"/>
            </svg>
          </div>
          <h3 className="text-lg font-semibold" style={{ color: '#102a43' }}>
            No lawyers yet
          </h3>
          <p className="mt-2 text-sm leading-6" style={{ color: '#667085' }}>
            Create a Lawyer account to set up a firm workspace in LexBase.
          </p>
        </div>
      ) : (
        // Data table listing every lawyer with their status and action buttons
        <div className="rounded-2xl border bg-white overflow-hidden"
             style={{ borderColor: '#d9ddd8' }}>
          <table className="w-full text-sm">
            {/* Table header row with column labels */}
            <thead style={{ backgroundColor: '#f7f8f5', borderBottom: '1px solid #d9ddd8' }}>
              <tr>
                {['Lawyer', 'Firm ID', 'Status', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-[.12em]"
                      style={{ color: '#667085' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* One row per lawyer — hover effect highlights the row */}
              {lawyers.map((l, i) => (
                <tr key={l.id}
                    style={{ borderTop: i > 0 ? '1px solid #f0f2f0' : undefined }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#fafbf9'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = ''}>
                  {/* Avatar initials + email address in the first column */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                           style={{ backgroundColor: '#e2eee4', color: '#386641' }}>
                        {l.email.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium" style={{ color: '#102a43' }}>{l.email}</span>
                    </div>
                  </td>
                  {/* Firm ID displayed in monospace font, dash if null */}
                  <td className="px-5 py-4 font-mono text-xs" style={{ color: '#aab4ad' }}>
                    {l.firm_id ?? '—'}
                  </td>
                  {/* Green "Active" or red "Suspended" pill badge */}
                  <td className="px-5 py-4">
                    <span className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
                          style={l.is_active
                            ? { backgroundColor: '#e2eee4', color: '#386641' }
                            : { backgroundColor: '#f4e9ea', color: '#8c3b45' }}>
                      {l.is_active ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  {/* Action column — shows Suspend or Reactivate depending on state */}
                  <td className="px-5 py-4 text-right">
                    {l.is_active ? (
                      // Suspend button shown when the account is currently active
                      <button
                        onClick={() => {
                          if (!window.confirm(`Suspend ${l.email}?`)) return
                          suspendMutation.mutate(l.id)
                        }}
                        className="text-xs font-semibold transition-colors"
                        style={{ color: '#aab4ad' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#8c3b45'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#aab4ad'}
                      >
                        Suspend
                      </button>
                    ) : (
                      // Reactivate button shown when the account has been suspended
                      <button
                        onClick={() => {
                          if (!window.confirm(`Reactivate ${l.email}?`)) return
                          reactivateMutation.mutate(l.id)
                        }}
                        className="text-xs font-semibold transition-colors"
                        style={{ color: '#386641' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#234f2c'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#386641'}
                      >
                        Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
