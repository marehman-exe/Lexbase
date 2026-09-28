// TeamPage.tsx — ui.html enterprise team management
// Allows a Lawyer (firm owner) to add Associates and Paralegals,
// view the current team roster, and deactivate members when needed.

// useState manages the add-member form state and response feedback
import { useState } from 'react'
// React Query hooks for fetching the member list and sending mutations
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
// The shared axios instance that authenticates requests with the stored token
import api from '../lib/api'

// Shape of a team member record returned by the backend list endpoint
interface MemberOut {
  id:        string
  email:     string
  role:      string
  is_active: boolean
}

// Shape of the response when a new team member is successfully created
interface CreateMemberResponse {
  user:             MemberOut
  // Temporary password shown once — the member must change it on first login
  initial_password: string
}

// Maps internal role strings to human-readable labels shown in the UI
const ROLE_LABELS: Record<string, string> = {
  associate: 'Associate',
  paralegal: 'Paralegal',
}

// Maps each role to the background and text colours used in its badge
const ROLE_BADGE: Record<string, { bg: string; color: string }> = {
  associate: { bg: '#e8edf1', color: '#274c77' },
  paralegal: { bg: '#f4e9ea', color: '#8c3b45' },
}

// Shared Tailwind class string for all text inputs on this page
const inputCls = "w-full rounded-xl border py-3 px-4 text-sm focus:outline-none"
// Shared inline style object for all text inputs on this page
const inputStyle: React.CSSProperties = {
  borderColor: '#cfd6d1', backgroundColor: '#fbfcfa', color: '#102a43',
}

// Main page component for managing the lawyer's firm team
export default function TeamPage() {
  // Get the query client so we can invalidate the team list after mutations
  const qc = useQueryClient()
  // Controlled state for the add-member form inputs
  const [email,   setEmail]   = useState('')
  const [role,    setRole]    = useState('associate')
  // Stores the newly created member's one-time credentials for display
  const [created, setCreated] = useState<CreateMemberResponse | null>(null)
  // Holds an error message string when a mutation fails
  const [error,   setError]   = useState('')

  // Fetch the firm's current team member list from the backend on mount
  const { data: members = [] } = useQuery<MemberOut[]>({
    queryKey: ['team'],
    queryFn:  () => api.get('/users/team').then(r => r.data),
  })

  // Mutation for adding a new team member via POST /users/team
  const createMutation = useMutation({
    mutationFn: (body: { email: string; role: string }) =>
      api.post<CreateMemberResponse>('/users/team', body).then(r => r.data),
    onSuccess: (data) => {
      // Display one-time credentials, clear the email field, refresh the list
      setCreated(data); setEmail(''); setError('')
      qc.invalidateQueries({ queryKey: ['team'] })
    },
    onError: (err: unknown) => {
      // Extract the API error detail message if one was returned
      const e = err as { response?: { data?: { detail?: string } } }
      setError(e.response?.data?.detail ?? 'Failed to add member')
    },
  })

  // Mutation for deactivating an active team member via PATCH
  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/users/team/${id}/deactivate`),
    // Refresh the member list so the UI shows the updated inactive status
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['team'] }),
  })

  // Count active and inactive members for the KPI summary row
  const active   = members.filter(m =>  m.is_active).length
  const inactive = members.filter(m => !m.is_active).length

  return (
    <div>
      {/* ── Page header ── */}
      {/* Title and description shown at the top of the team page */}
      <header className="mb-8">
        <h1 className="text-2xl font-semibold" style={{ color: '#102a43' }}>Team</h1>
        <p className="mt-2 leading-relaxed" style={{ color: '#667085' }}>
          Manage Associates and Paralegals in your firm workspace.
        </p>
      </header>

      {/* KPI row */}
      {/* Three summary stat tiles: total members, active, and inactive counts */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Members', value: members.length, sub: 'on your team'    },
          { label: 'Active',        value: active,         sub: 'can access now'  },
          { label: 'Inactive',      value: inactive,       sub: 'deactivated'     },
        ].map(k => (
          <div key={k.label} className="rounded-2xl border bg-white p-5"
               style={{ borderColor: '#d9ddd8' }}>
            <p className="text-xs font-medium mb-2" style={{ color: '#667085' }}>{k.label}</p>
            <p className="text-2xl font-bold" style={{ color: '#102a43' }}>{k.value}</p>
            <p className="text-xs mt-1" style={{ color: '#aab4ad' }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Add member form */}
      {/* Card with email input, role selector, and submit button inline */}
      <div className="rounded-2xl border bg-white p-6 mb-6 max-w-xl"
           style={{ borderColor: '#d9ddd8' }}>
        <h2 className="text-base font-semibold mb-5" style={{ color: '#102a43' }}>
          Add team member
        </h2>
        {/* Inline row: email field, role dropdown, and Add button side by side */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Email input with gold focus ring on click */}
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={inputCls}
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.boxShadow = '0 0 0 2px #c58b2a'; e.currentTarget.style.borderColor = '#c58b2a' }}
            onBlur={e  => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#cfd6d1' }}
          />
          {/* Dropdown to select whether the new member is an Associate or Paralegal */}
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="rounded-xl border py-3 px-4 text-sm focus:outline-none"
            style={{ borderColor: '#cfd6d1', backgroundColor: '#fbfcfa', color: '#102a43', minWidth: '130px' }}
          >
            <option value="associate">Associate</option>
            <option value="paralegal">Paralegal</option>
          </select>
          {/* Submit button — disabled if email is empty or a request is running */}
          <button
            onClick={() => createMutation.mutate({ email, role })}
            disabled={!email || createMutation.isPending}
            className="rounded-xl px-5 py-3 text-sm font-bold text-white disabled:opacity-50 transition-colors whitespace-nowrap"
            style={{ backgroundColor: '#386641' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#2e5636'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#386641'}
          >
            {createMutation.isPending ? 'Adding…' : 'Add member'}
          </button>
        </div>

        {/* Red error banner shown when the create mutation returns an error */}
        {error && (
          <div className="mt-4 rounded-xl px-4 py-3 text-sm font-semibold"
               style={{ backgroundColor: '#f4e9ea', color: '#8c3b45' }}>
            {error}
          </div>
        )}

        {/* One-time credential banner — only visible immediately after a successful add */}
        {/* The lawyer must copy and share these credentials right away */}
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
          </div>
        )}
      </div>

      {/* Members table */}
      {/* Show an empty-state illustration when the team has no members yet */}
      {members.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-white p-14 text-center"
             style={{ borderColor: '#cfd6d1' }}>
          <div className="mx-auto h-14 w-14 rounded-full flex items-center justify-center mb-5"
               style={{ backgroundColor: '#e2eee4', color: '#386641' }}>
            {/* People icon in a green circle for the empty state illustration */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <h3 className="text-lg font-semibold" style={{ color: '#102a43' }}>
            No team members yet
          </h3>
          <p className="mt-2 max-w-md mx-auto text-sm leading-6" style={{ color: '#667085' }}>
            Add Associates and Paralegals to give your team access to the knowledge base.
          </p>
        </div>
      ) : (
        // Data table listing every team member with role, status, and deactivate button
        <div className="rounded-2xl border bg-white overflow-hidden"
             style={{ borderColor: '#d9ddd8' }}>
          <table className="w-full text-sm">
            {/* Table header row with column labels */}
            <thead style={{ backgroundColor: '#f7f8f5', borderBottom: '1px solid #d9ddd8' }}>
              <tr>
                {['Member', 'Role', 'Status', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-[.12em]"
                      style={{ color: '#667085' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* One row per team member — hover effect highlights the row */}
              {members.map((m, i) => {
                // Look up the role badge colours, fallback to neutral grey if unknown
                const rb = ROLE_BADGE[m.role] ?? { bg: '#f7f8f5', color: '#667085' }
                return (
                  <tr key={m.id}
                      style={{ borderTop: i > 0 ? '1px solid #f0f2f0' : undefined }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#fafbf9'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = ''}>
                    {/* Avatar initials circle and email address in the member column */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {/* Avatar circle uses the role badge colour for visual differentiation */}
                        <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                             style={{ backgroundColor: rb.bg, color: rb.color }}>
                          {m.email.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium" style={{ color: '#102a43' }}>{m.email}</span>
                      </div>
                    </td>
                    {/* Role badge pill — blue for Associate, red-tinted for Paralegal */}
                    <td className="px-5 py-4">
                      <span className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
                            style={{ backgroundColor: rb.bg, color: rb.color }}>
                        {ROLE_LABELS[m.role] ?? m.role}
                      </span>
                    </td>
                    {/* Green "Active" or grey "Inactive" status pill */}
                    <td className="px-5 py-4">
                      <span className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
                            style={m.is_active
                              ? { backgroundColor: '#e2eee4', color: '#386641' }
                              : { backgroundColor: '#f1f3f2', color: '#aab4ad' }}>
                        {m.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {/* Deactivate button — only shown for currently active members */}
                    <td className="px-5 py-4 text-right">
                      {m.is_active && (
                        <button
                          onClick={() => {
                            if (!window.confirm(`Deactivate ${m.email}?`)) return
                            deactivateMutation.mutate(m.id)
                          }}
                          className="text-xs font-semibold transition-colors"
                          style={{ color: '#aab4ad' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#8c3b45'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#aab4ad'}
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
