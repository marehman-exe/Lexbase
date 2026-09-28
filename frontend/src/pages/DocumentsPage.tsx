// DocumentsPage.tsx — merged Documents + KnowledgeBase with Library & Index Status tabs

// React core hooks for state, side effects, and DOM refs
import { useState, useEffect, useRef } from 'react'
// TanStack Query hooks for fetching, caching, and mutating server data
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
// Auth context hook to read the currently logged-in user and their role
import { useAuth } from '../context/AuthContext'
// Pre-configured axios instance that points at the backend API
import api from '../lib/api'

// ── types ──────────────────────────────────────────────────────────────────────

// Shape of the document object returned by the backend /documents endpoint
interface DocumentOut {
  id:                string
  original_filename: string
  size_bytes:        number
  page_count:        number | null
  status:            'pending' | 'processing' | 'ready' | 'failed'
  error_message:     string | null
  chunk_count:       number
  created_at:        string   // ISO-8601 from backend
}

// ── helpers ───────────────────────────────────────────────────────────────────

// Converts a raw byte count into a human-readable size string (B / KB / MB)
function fmt(bytes: number) {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Converts an ISO-8601 timestamp into a short localised date-and-time string
function fmtTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// Opens a PDF served by the backend at a specific page in a new browser tab
function openPdfAtPage(docId: string, page: number) {
  const token = localStorage.getItem('access_token') ?? ''
  const base  = import.meta.env.VITE_API_BASE_URL
  const url   = `${base}/documents/${docId}/file?token=${encodeURIComponent(token)}#page=${page}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

// Triggers a browser save-dialog download of the PDF
function downloadPdf(docId: string, filename: string) {
  const token = localStorage.getItem('access_token') ?? ''
  const base  = import.meta.env.VITE_API_BASE_URL
  const url   = `${base}/documents/${docId}/file?token=${encodeURIComponent(token)}&download=true`
  const a     = document.createElement('a')
  a.href      = url
  a.download  = filename
  a.click()
}

// ── sub-components ────────────────────────────────────────────────────────────

// Maps each document status to background colour, text colour, and display label
const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  ready:      { bg: '#e2eee4', color: '#386641', label: 'Ready'      },
  processing: { bg: '#fff2d8', color: '#885b12', label: 'Processing' },
  pending:    { bg: '#e8edf1', color: '#274c77', label: 'Pending'    },
  failed:     { bg: '#f4e9ea', color: '#8c3b45', label: 'Failed'     },
}

// Small coloured pill that shows the processing status of a single document
function DocStatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.pending
  return (
    <span className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
          style={{ backgroundColor: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

// TabBtn is defined outside the component so it is never re-created on render
// Renders a single tab button that highlights when it is the active tab
function TabBtn({
  active, label, count, onClick,
}: { active: boolean; label: string; count?: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors focus:outline-none"
      style={
        active
          ? { backgroundColor: '#102a43', color: '#ffffff' }
          : { backgroundColor: 'transparent', color: '#667085' }
      }
    >
      {label}
      {/* Numeric badge showing how many items belong to this tab */}
      {count !== undefined && (
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-bold"
          style={
            active
              ? { backgroundColor: 'rgba(255,255,255,.18)', color: '#ffffff' }
              : { backgroundColor: '#e2eee4', color: '#386641' }
          }
        >
          {count}
        </span>
      )}
    </button>
  )
}

// Generic inline action button used for Delete and other row-level actions
// Accepts an optional danger flag to render it in the error red colour
function ActionBtn({
  label, danger, onClick, disabled,
}: { label: string; danger?: boolean; onClick: () => void; disabled?: boolean }) {
  // Local hover state drives the colour change because inline styles cannot use :hover
  const [hover, setHover] = useState(false)
  const base  = danger ? '#8c3b45' : '#aab4ad'
  const hov   = danger ? '#c0485a' : '#667085'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-xs font-semibold transition-colors focus:outline-none disabled:opacity-40"
      style={{ color: hover ? hov : base }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {label}
    </button>
  )
}

// Coverage ring SVG — draws a circular progress indicator showing the indexed percentage
function CoverageRing({ pct }: { pct: number }) {
  // Compute the circumference and the dash offset that represents the filled arc
  const r   = 36
  const c   = 2 * Math.PI * r
  const off = c - (pct / 100) * c
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" className="shrink-0">
      {/* Grey track circle drawn behind the filled arc */}
      <circle cx="44" cy="44" r={r} fill="none" stroke="#e2eee4" strokeWidth="8" />
      {/* Green filled arc rotated so that it starts at the top */}
      <circle cx="44" cy="44" r={r} fill="none" stroke="#386641" strokeWidth="8"
              strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
              transform="rotate(-90 44 44)" />
      {/* Percentage label centred inside the ring */}
      <text x="44" y="49" textAnchor="middle" fontSize="15" fontWeight="700" fill="#102a43">
        {pct}%
      </text>
    </svg>
  )
}

// Union type for the two possible sort directions on the upload date column
type SortDir = 'asc' | 'desc'
// Union type for the two available page tabs
type Tab     = 'library' | 'index'

// ── main page ─────────────────────────────────────────────────────────────────

// Main Documents page component — shows the document library and index status tabs
export default function DocumentsPage() {
  // Read the current user object to check whether the user has the lawyer role
  const { user }   = useAuth()
  // Query client used to manually invalidate the documents cache after mutations
  const qc         = useQueryClient()
  // Only lawyers can upload and delete documents
  const isLawyer   = user?.role === 'lawyer'
  // Ref to the hidden file input so we can trigger it from the Upload button
  const fileRef    = useRef<HTMLInputElement>(null)

  // Which tab is currently visible: 'library' (default) or 'index'
  const [tab,          setTab]          = useState<Tab>('library')
  // Error message surfaced when a file upload fails
  const [uploadError,  setUploadError]  = useState('')
  // True while a file upload request is in flight
  const [uploading,    setUploading]    = useState(false)
  // Direction used to sort the document list by upload date
  const [sortDir,      setSortDir]      = useState<SortDir>('desc')
  // Set of document IDs that the user has ticked for bulk operations
  const [selected,     setSelected]     = useState<Set<string>>(new Set())

  // Fetch the list of all documents in the firm's knowledge base from the server
  const { data: docs = [], refetch } = useQuery<DocumentOut[]>({
    queryKey: ['documents'],
    queryFn:  () => api.get('/documents').then(r => r.data),
  })

  // Poll while any document is still being processed
  // Checks whether at least one document is still pending or processing
  const inProgress = docs.some(d => d.status === 'pending' || d.status === 'processing')
  // Start a 2.5-second polling interval while documents are being processed, then stop
  useEffect(() => {
    if (!inProgress) return
    const id = setInterval(() => refetch(), 2500)
    return () => clearInterval(id)
  }, [inProgress, refetch])

  // Mutation that sends a DELETE request for a single document by its ID
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    // Refresh the documents list automatically after a successful deletion
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['documents'] }),
  })

  // Handles file selection from the hidden input — uploads the chosen PDF to the backend
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')
    setUploading(true)
    try {
      // Wrap the file in a FormData object as the backend expects multipart/form-data
      const form = new FormData()
      form.append('file', file)
      await api.post('/documents', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      // Invalidate the documents cache so the new document appears in the list immediately
      qc.invalidateQueries({ queryKey: ['documents'] })
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setUploadError(e.response?.data?.detail ?? 'Upload failed')
    } finally {
      setUploading(false)
      // Reset the file input so the same file can be re-uploaded if needed
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // Asks for confirmation then deletes every document in the provided ID array
  async function handleDeleteSelected(ids: string[]) {
    if (!window.confirm(`Delete ${ids.length} document(s) and all their passages?`)) return
    for (const id of ids) await deleteMutation.mutateAsync(id)
    // Clear the selection set once all deletions have completed
    setSelected(new Set())
  }

  // Toggles the checked state of a single document row in the selection set
  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Selects all documents in the given list, or clears all if they are all already selected
  function toggleSelectAll(list: DocumentOut[]) {
    const ids = list.map(d => d.id)
    const allSelected = ids.every(id => selected.has(id))
    setSelected(allSelected ? new Set() : new Set(ids))
  }

  // Derived stats — computed from the documents array for the KPI cards and coverage ring
  const ready       = docs.filter(d => d.status === 'ready').length
  const totalPages  = docs.reduce((s, d) => s + (d.page_count ?? 0), 0)
  const totalChunks = docs.reduce((s, d) => s + d.chunk_count, 0)
  // Percentage of documents that have been fully indexed and are searchable
  const coveragePct = docs.length === 0 ? 0 : Math.round((ready / docs.length) * 100)

  // Creates a sorted copy of docs ordered by upload date in the chosen direction
  const sortedDocs = [...docs].sort((a, b) => {
    const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    return sortDir === 'desc' ? -diff : diff
  })

  // Index status tab data — one row per document with indexing details
  // Sorted alphabetically by filename for easier scanning
  const indexDocs = [...docs].sort((a, b) => a.original_filename.localeCompare(b.original_filename))

  // True whenever at least one document row is checked, enabling the bulk action bar
  const selectionActive = selected.size > 0

  return (
    <div>
      {/* ── Page header ── */}
      {/* Title row with the upload button on the right for lawyer users */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#102a43' }}>
            Documents
          </h1>
          <p className="mt-2 leading-relaxed" style={{ color: '#667085' }}>
            Legal documents available in your firm's knowledge base.
          </p>
        </div>
        {/* Upload button and hidden file input — only visible to lawyers */}
        {isLawyer && (
          <div className="shrink-0 flex flex-col items-end gap-1">
            {/* Hidden file input accepts only PDF files */}
            <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleUpload} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded-xl px-5 py-3 text-sm font-bold text-white disabled:opacity-50 transition-colors"
              style={{ backgroundColor: '#102a43' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#183c5e'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#102a43'}
            >
              {uploading ? 'Uploading…' : '+ Upload Document'}
            </button>
            {/* Inline error shown directly beneath the upload button on failure */}
            {uploadError && (
              <p className="text-xs" style={{ color: '#8c3b45' }}>{uploadError}</p>
            )}
          </div>
        )}
      </header>

      {/* ── KPI row ── */}
      {/* Four metric cards: total documents, total pages, passages, and firm limit */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Documents', value: docs.length,                 sub: `${ready} indexed`   },
          { label: 'Total Pages',     value: totalPages.toLocaleString(), sub: 'across all docs'    },
          { label: 'Passages',        value: totalChunks.toLocaleString(),sub: 'searchable chunks'  },
          { label: 'Limit',           value: `${docs.length} / 10`,       sub: 'documents per firm' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-2xl border bg-white p-5"
               style={{ borderColor: '#d9ddd8' }}>
            <p className="text-xs font-medium mb-2" style={{ color: '#667085' }}>{kpi.label}</p>
            <p className="text-2xl font-bold" style={{ color: '#102a43' }}>{kpi.value}</p>
            <p className="text-xs mt-1" style={{ color: '#aab4ad' }}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Tab bar ── */}
      {/* Pill-shaped tab switcher toggling between the Library and Index Status views */}
      <div className="flex items-center gap-1 mb-5 rounded-2xl border bg-white p-1.5 w-fit"
           style={{ borderColor: '#d9ddd8' }}>
        <TabBtn active={tab === 'library'} label="Library"      count={docs.length} onClick={() => setTab('library')} />
        <TabBtn active={tab === 'index'}   label="Index Status" count={ready}       onClick={() => setTab('index')}   />
      </div>

      {/* ── Bulk action bar ── */}
      {/* Appears above the table when one or more rows are selected by a lawyer */}
      {selectionActive && isLawyer && (
        <div className="flex items-center gap-4 mb-4 rounded-xl border px-4 py-3"
             style={{ backgroundColor: '#fff2d8', borderColor: '#e8c8a0' }}>
          <span className="text-sm font-semibold" style={{ color: '#885b12' }}>
            {selected.size} selected
          </span>
          {/* Delete all selected documents at once with a single confirmation prompt */}
          <ActionBtn
            label="Delete selected"
            danger
            onClick={() => handleDeleteSelected(Array.from(selected))}
          />
          {/* Clear all checkboxes without performing any destructive action */}
          <ActionBtn
            label="Clear selection"
            onClick={() => setSelected(new Set())}
          />
        </div>
      )}

      {/* ═══════════════════ LIBRARY TAB ═══════════════════ */}
      {/* Shows the document library table, or an empty-state prompt if no docs exist */}
      {tab === 'library' && (
        docs.length === 0 ? (
          // Empty state card shown when no documents have been uploaded yet
          <div className="rounded-2xl border border-dashed bg-white p-14 text-center"
               style={{ borderColor: '#cfd6d1' }}>
            <div className="mx-auto h-14 w-14 rounded-full flex items-center justify-center mb-5"
                 style={{ backgroundColor: '#e2eee4', color: '#386641' }}>
              {/* Document file SVG icon in the centre of the empty state */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <h3 className="text-lg font-semibold" style={{ color: '#102a43' }}>No documents yet</h3>
            <p className="mt-2 max-w-md mx-auto text-sm leading-6" style={{ color: '#667085' }}>
              Upload legal documents to begin building your knowledge base.
            </p>
            {/* First-upload shortcut button only visible to lawyers */}
            {isLawyer && (
              <button
                onClick={() => fileRef.current?.click()}
                className="mt-6 rounded-xl px-5 py-3 text-sm font-bold text-white"
                style={{ backgroundColor: '#386641' }}
              >
                Upload your first document
              </button>
            )}
          </div>
        ) : (
          // Main library table listing all uploaded documents with their metadata
          <div className="rounded-2xl border bg-white overflow-hidden"
               style={{ borderColor: '#d9ddd8' }}>
            <table className="w-full text-sm">
              {/* Table header row with sortable Uploaded column */}
              <thead style={{ backgroundColor: '#f7f8f5', borderBottom: '1px solid #d9ddd8' }}>
                <tr>
                  {/* Select-all checkbox column — only rendered for lawyers */}
                  {isLawyer && (
                    <th className="px-4 py-3 w-8">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={sortedDocs.length > 0 && sortedDocs.every(d => selected.has(d.id))}
                        onChange={() => toggleSelectAll(sortedDocs)}
                        aria-label="Select all"
                      />
                    </th>
                  )}
                  {/* Static column headers rendered from an array for brevity */}
                  {['Document', 'Pages', 'Passages', 'Size', 'Status'].map(h => (
                    <th key={h}
                        className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-[.12em]"
                        style={{ color: '#667085' }}>
                      {h}
                    </th>
                  ))}
                  {/* Clickable Uploaded header toggles sort direction between asc and desc */}
                  <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-[.12em]"
                      style={{ color: '#667085' }}>
                    <button
                      type="button"
                      onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                      className="flex items-center gap-1 focus:outline-none"
                      title={sortDir === 'desc' ? 'Newest first — click to reverse' : 'Oldest first — click to reverse'}
                    >
                      Uploaded
                      {/* Gold arrow indicator showing the current sort direction */}
                      <span style={{ color: '#c58b2a' }}>{sortDir === 'desc' ? '↓' : '↑'}</span>
                    </button>
                  </th>
                  {/* Header cell for the View / Download / Delete actions column */}
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {/* One table row per document, highlighted on hover for readability */}
                {sortedDocs.map((d, i) => (
                  <tr key={d.id}
                      style={{ borderTop: i > 0 ? '1px solid #f0f2f0' : undefined }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#fafbf9'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = ''}>
                    {/* Per-row checkbox for selecting documents for bulk actions */}
                    {isLawyer && (
                      <td className="px-4 py-4 w-8">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selected.has(d.id)}
                          onChange={() => toggleSelect(d.id)}
                          aria-label={`Select ${d.original_filename}`}
                        />
                      </td>
                    )}
                    {/* Document name cell with a green icon and a clickable filename */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {/* Green square icon representing a PDF document file */}
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                             style={{ backgroundColor: '#e2eee4', color: '#386641' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                               stroke="currentColor" strokeWidth="2"
                               strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                          </svg>
                        </div>
                        <div>
                          {/* Filename button opens the PDF in a new browser tab at page 1 */}
                          <button
                            type="button"
                            onClick={() => openPdfAtPage(d.id, 1)}
                            className="font-semibold text-sm text-left hover:underline focus:outline-none"
                            style={{ color: '#102a43' }}
                          >
                            {d.original_filename}
                          </button>
                          {/* Error message shown below the filename when processing has failed */}
                          {d.error_message && (
                            <p className="text-xs mt-0.5 max-w-xs truncate" style={{ color: '#8c3b45' }}>
                              {d.error_message}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* Page count cell — shows an em-dash when the count is not yet known */}
                    <td className="px-5 py-4 tabular-nums" style={{ color: '#667085' }}>
                      {d.page_count ?? '—'}
                    </td>
                    {/* Number of searchable text passages extracted from this document */}
                    <td className="px-5 py-4 tabular-nums" style={{ color: '#667085' }}>
                      {d.chunk_count}
                    </td>
                    {/* Human-readable file size using the fmt helper function */}
                    <td className="px-5 py-4 text-xs" style={{ color: '#aab4ad' }}>
                      {fmt(d.size_bytes)}
                    </td>
                    {/* Coloured status pill showing ready, processing, pending, or failed */}
                    <td className="px-5 py-4">
                      <DocStatusBadge status={d.status} />
                    </td>
                    {/* Upload timestamp formatted as a short date and time string */}
                    <td className="px-5 py-4 text-xs tabular-nums" style={{ color: '#667085' }}>
                      {fmtTime(d.created_at)}
                    </td>
                    {/* View / Download / Delete action buttons */}
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-4">
                        <ActionBtn
                          label="View"
                          onClick={() => openPdfAtPage(d.id, 1)}
                        />
                        <ActionBtn
                          label="Download"
                          onClick={() => downloadPdf(d.id, d.original_filename)}
                        />
                        {isLawyer && (
                          <ActionBtn
                            label="Delete"
                            danger
                            onClick={() => {
                              if (!window.confirm('Delete this document and all its passages?')) return
                              deleteMutation.mutate(d.id)
                            }}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ═══════════════════ INDEX STATUS TAB ═══════════════════ */}
      {/* Shows the coverage ring, status breakdown, and a per-document index detail table */}
      {tab === 'index' && (
        <div className="space-y-5">

          {/* Coverage summary card */}
          {/* Top card with the circular progress ring and a text breakdown of statuses */}
          <div className="rounded-2xl border bg-white p-6 flex flex-col sm:flex-row items-center gap-6"
               style={{ borderColor: '#d9ddd8' }}>
            {/* Circular SVG ring showing percentage of documents that are fully indexed */}
            <CoverageRing pct={coveragePct} />
            <div>
              <h2 className="text-base font-semibold" style={{ color: '#102a43' }}>
                Index Coverage
              </h2>
              <p className="mt-1 text-sm leading-6" style={{ color: '#667085' }}>
                {ready} of {docs.length} document{docs.length !== 1 ? 's' : ''} fully indexed and searchable.
                {docs.length - ready > 0 && (
                  <> {docs.length - ready} still pending or failed.</>
                )}
              </p>
              {/* Row of coloured status pills, one per status that has at least one document */}
              <div className="mt-3 flex flex-wrap gap-3">
                {Object.entries(STATUS_STYLE).map(([key, s]) => {
                  const n = docs.filter(d => d.status === key).length
                  // Skip statuses that have zero documents to keep the row tidy
                  if (n === 0) return null
                  return (
                    <span key={key}
                          className="rounded-full px-3 py-1 text-xs font-bold"
                          style={{ backgroundColor: s.bg, color: s.color }}>
                      {n} {s.label}
                    </span>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Per-document index detail table */}
          {/* Empty state when no documents exist, or a full detail table when they do */}
          {docs.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-white p-10 text-center"
                 style={{ borderColor: '#cfd6d1' }}>
              <p className="text-sm" style={{ color: '#667085' }}>No documents uploaded yet.</p>
            </div>
          ) : (
            // Alphabetically sorted table showing status, pages, passages, and upload time
            <div className="rounded-2xl border bg-white overflow-hidden"
                 style={{ borderColor: '#d9ddd8' }}>
              <table className="w-full text-sm">
                {/* Column headers for the index detail table */}
                <thead style={{ backgroundColor: '#f7f8f5', borderBottom: '1px solid #d9ddd8' }}>
                  <tr>
                    {/* Select-all checkbox in the index tab for bulk deletion */}
                    {isLawyer && (
                      <th className="px-4 py-3 w-8">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={indexDocs.length > 0 && indexDocs.every(d => selected.has(d.id))}
                          onChange={() => toggleSelectAll(indexDocs)}
                          aria-label="Select all"
                        />
                      </th>
                    )}
                    {/* Static header labels for the index status table columns */}
                    {['Document', 'Status', 'Pages', 'Passages', 'Uploaded'].map(h => (
                      <th key={h}
                          className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-[.12em]"
                          style={{ color: '#667085' }}>
                        {h}
                      </th>
                    ))}
                    {/* Header cell for the View / Download / Delete actions column */}
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {/* One row per document showing its index status and passage count */}
                  {indexDocs.map((d, i) => (
                    <tr key={d.id}
                        style={{ borderTop: i > 0 ? '1px solid #f0f2f0' : undefined }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#fafbf9'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = ''}>
                      {/* Per-row checkbox for selecting documents for bulk deletion */}
                      {isLawyer && (
                        <td className="px-4 py-4 w-8">
                          <input
                            type="checkbox"
                            className="rounded"
                            checked={selected.has(d.id)}
                            onChange={() => toggleSelect(d.id)}
                            aria-label={`Select ${d.original_filename}`}
                          />
                        </td>
                      )}
                      {/* Filename cell opens the PDF and shows any processing error below */}
                      <td className="px-5 py-4">
                        {/* Clicking the filename opens this PDF in a new browser tab */}
                        <button
                          type="button"
                          onClick={() => openPdfAtPage(d.id, 1)}
                          className="font-semibold text-sm text-left hover:underline focus:outline-none"
                          style={{ color: '#102a43' }}
                        >
                          {d.original_filename}
                        </button>
                        {/* Processing error message shown below the filename in red */}
                        {d.error_message && (
                          <p className="text-xs mt-0.5 max-w-xs truncate" style={{ color: '#8c3b45' }}>
                            {d.error_message}
                          </p>
                        )}
                      </td>
                      {/* Status badge shows the current indexing stage of this document */}
                      <td className="px-5 py-4">
                        <DocStatusBadge status={d.status} />
                      </td>
                      {/* Page count — dashes when not yet determined after upload */}
                      <td className="px-5 py-4 tabular-nums" style={{ color: '#667085' }}>
                        {d.page_count ?? '—'}
                      </td>
                      {/* Passage count — dashes when no chunks have been created yet */}
                      <td className="px-5 py-4 tabular-nums" style={{ color: '#667085' }}>
                        {d.chunk_count > 0 ? d.chunk_count : '—'}
                      </td>
                      {/* Formatted upload timestamp so users know when the document was added */}
                      <td className="px-5 py-4 text-xs tabular-nums" style={{ color: '#667085' }}>
                        {fmtTime(d.created_at)}
                      </td>
                      {/* View / Download / Delete action buttons */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-4">
                          <ActionBtn
                            label="View"
                            onClick={() => openPdfAtPage(d.id, 1)}
                          />
                          <ActionBtn
                            label="Download"
                            onClick={() => downloadPdf(d.id, d.original_filename)}
                          />
                          {isLawyer && (
                            <ActionBtn
                              label="Delete"
                              danger
                              onClick={() => {
                                if (!window.confirm('Delete this document and all its passages?')) return
                                deleteMutation.mutate(d.id)
                              }}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}
    </div>
  )
}
