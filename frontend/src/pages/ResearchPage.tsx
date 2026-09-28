// ResearchPage.tsx — ui.html visual identity: paper bg, sage/gold/navy palette

// React hooks for refs, controlled state, and side-effect management
import { useEffect, useRef, useState } from 'react'
// TanStack Query hooks for server-state data fetching and mutation
import { useMutation, useQuery } from '@tanstack/react-query'
// Auth context hook to read the current user's role
import { useAuth } from '../context/AuthContext'
// Pre-configured axios instance pointing at the backend API
import api from '../lib/api'
// TypeScript shape of the AI answer response body
import type { GenerateResponse } from '../types/auth'

// ── types ─────────────────────────────────────────────────────────────────────

// Shape of a single ranked passage returned by the /search endpoint
interface SearchResult {
  chunk_id:    string
  text:        string
  page_number: number
  document_id: string
  filename:    string
  score:       number
}

// Shape of the full response body returned by the /search endpoint
interface SearchResponse {
  results:    SearchResult[]
  total:      number
  no_results: boolean
  query:      string
}

// Shape of one complete session stored in the history drawer.
// Stores everything needed to restore the research panel exactly as it was.
interface HistoryEntry {
  id:           number              // unique id so React keys are stable
  dbId:         string | null       // server-side UUID; null until the DB write confirms
  query:        string
  timestamp:    Date
  searchResp:   SearchResponse | null   // full passage list; null if search failed
  generateResp: GenerateResponse | null // full AI answer; null if not run
}

// ── rank badge colours (01 sage, 02 navy-blue, 03 muted-red) ─────────────────

// Array of background and text colour pairs used for the top-three rank badges
const RANK_STYLE = [
  { bg: '#e2eee4', color: '#386641' },  // 01
  { bg: '#e8edf1', color: '#274c77' },  // 02
  { bg: '#f4e9ea', color: '#8c3b45' },  // 03
]

// Returns the colour pair for a given result index, falling back to a muted grey
function rankStyle(i: number) {
  return RANK_STYLE[i] ?? { bg: '#f1f3f2', color: '#667085' }
}

// ── citation inline render ────────────────────────────────────────────────────

// Splits a plain text fragment on [N] citation markers and returns an array of
// spans and gold citation buttons. Used inside every rendered line/bullet below.
function renderInline(text: string, onCitationClick: (n: number) => void) {
  return text.split(/(\[\d+\])/).map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/)
    if (m) {
      const n = parseInt(m[1], 10)
      return (
        <button
          key={i}
          onClick={() => onCitationClick(n)}
          className="rounded-lg px-2 py-1 text-xs font-bold mx-0.5 focus:outline-none align-middle"
          style={{ backgroundColor: '#c58b2a', color: '#102a43' }}
        >
          [{n}]
        </button>
      )
    }
    return <span key={i}>{part}</span>
  })
}

// Renders the AI answer as structured markdown:
//   ## Heading  → bold white section heading
//   - Bullet    → indented bullet line
//   plain text  → regular paragraph
// Citation markers [N] inside any line become clickable gold buttons.
function AnswerText({
  answer,
  onCitationClick,
}: {
  answer: string
  onCitationClick: (n: number) => void
}) {
  // Split on newlines; filter blank lines that come from double-newlines
  const lines = answer.split('\n')

  return (
    <div className="mt-4 space-y-2" style={{ color: '#cbd5e1' }}>
      {lines.map((line, i) => {
        const trimmed = line.trim()

        // Skip blank lines — spacing is handled by space-y-2 on the container
        if (!trimmed) return null

        // ## Section heading
        if (trimmed.startsWith('## ')) {
          const text = trimmed.slice(3)
          return (
            <h4 key={i} className="text-sm font-bold mt-4 first:mt-0"
                style={{ color: '#ffffff' }}>
              {renderInline(text, onCitationClick)}
            </h4>
          )
        }

        // - Bullet point
        if (trimmed.startsWith('- ')) {
          const text = trimmed.slice(2)
          return (
            <div key={i} className="flex gap-2 text-sm leading-6 pl-1">
              <span className="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: '#c58b2a' }} />
              <span>{renderInline(text, onCitationClick)}</span>
            </div>
          )
        }

        // Plain paragraph line
        return (
          <p key={i} className="text-sm leading-7">
            {renderInline(trimmed, onCitationClick)}
          </p>
        )
      })}
    </div>
  )
}

// ── SVG icons ─────────────────────────────────────────────────────────────────

const Sparkles = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/>
  </svg>
)

const SearchX = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.35-4.35M8 8l6 6M14 8l-6 6"/>
  </svg>
)

const Info = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
  </svg>
)

const Scale = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v18M5 6l-2 8h4L5 6zM19 6l-2 8h4L19 6z"/>
    <path d="M3 20h18"/>
  </svg>
)

// ── helpers ───────────────────────────────────────────────────────────────────

function openPdfInTab(docId: string, page: number) {
  const token = localStorage.getItem('access_token') ?? ''
  const base  = import.meta.env.VITE_API_BASE_URL
  const url   = `${base}/documents/${docId}/file?token=${encodeURIComponent(token)}#page=${page}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

// Stable auto-incrementing id for history entries
let _nextId = 1

// ── main page ─────────────────────────────────────────────────────────────────

export default function ResearchPage() {
  const { user }    = useAuth()
  const canGenerate = user?.role === 'lawyer' || user?.role === 'associate'

  // ── core state ─────────────────────────────────────────────────────────────

  // The text currently typed in the search input
  const [query,        setQuery]        = useState('')
  // Expanded / highlighted passage card IDs
  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [highlighted,  setHighlighted]  = useState<string | null>(null)
  // DOM refs for scroll-to-citation
  const passageRefs = useRef<Record<string, HTMLElement | null>>({})

  // ── active session ─────────────────────────────────────────────────────────
  // The panel always renders from `activeSession`.
  // When a live search completes, we update activeSession from mutation data.
  // When the user clicks a history entry, we load that entry into activeSession.
  // `isRestored` flag shows the "Resumed" badge on the query panel.
  const [activeSession, setActiveSession] = useState<{
    searchResp:   SearchResponse | null
    generateResp: GenerateResponse | null
    isRestored:   boolean
    restoredId:   number | null   // which history entry is currently active
  }>({ searchResp: null, generateResp: null, isRestored: false, restoredId: null })

  // ── provider toggle ─────────────────────────────────────────────────────────
  // Persisted in localStorage so the user's preference survives page reloads
  const [provider, setProvider] = useState<'online' | 'local'>(
    () => (localStorage.getItem('llm_provider') as 'online' | 'local') ?? 'online'
  )
  // Keep localStorage in sync whenever the toggle changes
  const handleProviderChange = (p: 'online' | 'local') => {
    setProvider(p)
    localStorage.setItem('llm_provider', p)
  }

  // ── history ─────────────────────────────────────────────────────────────────
  const [history,     setHistory]     = useState<HistoryEntry[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)

  // Load the last 7 days of history from the DB on first mount
  const { data: dbHistory } = useQuery<HistoryEntry[]>({
    queryKey:  ['chat-history'],
    queryFn:   () =>
      api.get('/chat-history').then(r =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r.data as any[]).map((row, idx) => ({
          id:           -(idx + 1),          // negative IDs avoid clashing with _nextId
          dbId:         row.id,
          query:        row.query_text,
          timestamp:    new Date(row.created_at),
          searchResp:   row.search_resp   as SearchResponse   | null,
          generateResp: row.generate_resp as GenerateResponse | null,
        }))
      ),
    staleTime: Infinity,   // loaded once per page visit; we manage updates ourselves
  })

  // Seed in-memory history with DB rows the first time the query resolves
  useEffect(() => {
    if (dbHistory && dbHistory.length > 0 && history.length === 0) {
      setHistory(dbHistory)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbHistory])

  // ── suggestions ─────────────────────────────────────────────────────────────
  const { data: suggestions = [] } = useQuery<string[]>({
    queryKey:  ['suggestions'],
    queryFn:   () => api.get('/suggestions').then(r =>
      (r.data as { query_text: string }[]).map(s => s.query_text)
    ),
    staleTime: 0,
  })

  // ── mutations ───────────────────────────────────────────────────────────────

  const searchMutation = useMutation({
    mutationFn: (q: string) =>
      api.post<SearchResponse>('/search', { query: q }).then(r => r.data),

    onSuccess: async (data, q) => {
      const id = _nextId++
      // Persist to DB; store the server UUID when it comes back
      let dbId: string | null = null
      try {
        const res = await api.post<{ id: string }>('/chat-history', {
          query_text:  q,
          search_resp: data,
        })
        dbId = res.data.id
      } catch { /* non-critical — history still works in-memory */ }

      // Push a new history entry (generateResp filled in later by generateMutation)
      setHistory(prev => [
        { id, dbId, query: q, timestamp: new Date(), searchResp: data, generateResp: null },
        ...prev,
      ].slice(0, 100))
      // Make this the active session, live (not restored)
      setActiveSession({ searchResp: data, generateResp: null, isRestored: false, restoredId: id })
    },

    onError: (_err, q) => {
      const id = _nextId++
      setHistory(prev => [
        { id, dbId: null, query: q, timestamp: new Date(), searchResp: null, generateResp: null },
        ...prev,
      ].slice(0, 100))
      setActiveSession({ searchResp: null, generateResp: null, isRestored: false, restoredId: id })
    },
  })

  const generateMutation = useMutation({
    mutationFn: (q: string) =>
      api.post<GenerateResponse>('/generate', { query: q, provider }).then(r => r.data),

    onSuccess: (data, q) => {
      // Update the active session with the answer
      setActiveSession(prev => ({ ...prev, generateResp: data }))
      // Patch the matching history entry in memory and persist to DB
      setHistory(prev => {
        const idx = prev.findIndex(
          e => e.query === q && e.generateResp === null && e.searchResp !== null
        )
        if (idx === -1) return prev
        const updated = [...prev]
        const entry = { ...updated[idx], generateResp: data }
        updated[idx] = entry

        // Fire-and-forget DB patch if we have a server ID
        if (entry.dbId) {
          api.patch('/chat-history/generate', {
            record_id:    entry.dbId,
            generate_resp: data,
          }).catch(() => { /* non-critical */ })
        }
        return updated
      })
    },
  })

  // ── event handlers ──────────────────────────────────────────────────────────

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    // New live search — clears any restored state
    generateMutation.reset()
    searchMutation.mutate(query.trim())
  }

  // Load a history entry into the research panel without making any network call
  function restoreSession(entry: HistoryEntry) {
    setQuery(entry.query)
    setExpanded(null)
    setHighlighted(null)
    setActiveSession({
      searchResp:   entry.searchResp,
      generateResp: entry.generateResp,
      isRestored:   true,
      restoredId:   entry.id,
    })
    // Close the drawer so the panel is fully visible
    setHistoryOpen(false)
  }

  function handleCitationClick(n: number) {
    const resp = activeSession.searchResp
    if (!resp) return
    const passage = resp.results[n - 1]
    if (!passage) return
    setExpanded(passage.chunk_id)
    setHighlighted(passage.chunk_id)
    passageRefs.current[passage.chunk_id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => setHighlighted(null), 2000)
  }

  // ── derived display values ──────────────────────────────────────────────────

  const searchResp   = activeSession.searchResp
  const generateResp = activeSession.generateResp
  const hasResults   = searchResp && !searchResp.no_results && searchResp.results.length > 0

  const chips = suggestions.length > 0
    ? suggestions.slice(0, 5)
    : ['termination notice', 'section 302 evidence', 'commercial lease renewal']

  // True only while a brand-new search is in flight (not a restore)
  const isSearching   = searchMutation.isPending
  const isSummarising = generateMutation.isPending

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="relative">

      {/* ── Fixed history drawer ──────────────────────────────────────────── */}

      {/* Toggle button — clock icon, always visible top-right */}
      <button
        onClick={() => setHistoryOpen(o => !o)}
        title={historyOpen ? 'Close history' : 'Query history'}
        className="fixed z-50 flex items-center justify-center rounded-full shadow-lg transition-colors focus:outline-none"
        style={{
          top: '1.1rem', right: '1.25rem',
          width: '2.4rem', height: '2.4rem',
          backgroundColor: historyOpen ? '#102a43' : '#ffffff',
          border: '1.5px solid #d9ddd8',
          color: historyOpen ? '#c58b2a' : '#386641',
        }}
        aria-label="Toggle query history"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        {/* Green dot badge when history exists and drawer is closed */}
        {!historyOpen && history.length > 0 && (
          <span
            className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full border-2"
            style={{ backgroundColor: '#386641', borderColor: '#f5f3ee', transform: 'translate(25%,-25%)' }}
          />
        )}
      </button>

      {/* Backdrop for small screens */}
      {historyOpen && (
        <div
          className="fixed inset-0 z-40 xl:hidden"
          style={{ backgroundColor: 'rgba(16,42,67,.25)' }}
          onClick={() => setHistoryOpen(false)}
        />
      )}

      {/* Drawer — slides in from the right */}
      <div
        className="fixed top-0 right-0 z-40 h-full flex flex-col"
        style={{
          width: '22rem',
          backgroundColor: '#ffffff',
          borderLeft: '1px solid #d9ddd8',
          boxShadow: '-4px 0 24px rgba(16,42,67,.09)',
          transform: historyOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s cubic-bezier(.4,0,.2,1)',
        }}
        aria-label="Query history drawer"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
             style={{ borderBottom: '1px solid #e8ebe8' }}>
          <div className="flex items-center gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#386641"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span className="font-bold text-sm" style={{ color: '#102a43' }}>Query History · Last 7 Days</span>
            {history.length > 0 && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ backgroundColor: '#e7ece7', color: '#386641' }}>
                {history.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {history.length > 0 && (
              <button
                onClick={() => {
                  setHistory([])
                  // Always reset the panel — whether it was a live or restored session
                  setActiveSession({ searchResp: null, generateResp: null, isRestored: false, restoredId: null })
                  setQuery('')
                  generateMutation.reset()
                  searchMutation.reset()
                }}
                className="text-xs focus:outline-none"
                style={{ color: '#aab4ad' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#8c3b45'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#aab4ad'}
              >
                Clear all
              </button>
            )}
            <button
              onClick={() => setHistoryOpen(false)}
              className="focus:outline-none"
              style={{ color: '#aab4ad' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#102a43'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#aab4ad'}
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">

          {/* Empty state */}
          {history.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full pb-16 text-center">
              <div className="h-12 w-12 rounded-full flex items-center justify-center mb-3"
                   style={{ backgroundColor: '#e2eee4', color: '#386641' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
              </div>
              <p className="text-xs leading-5" style={{ color: '#aab4ad' }}>
                Your searches from the<br/>last 7 days will appear here.
              </p>
            </div>
          )}

          {/* History entries */}
          {history.map(entry => {
            const isActive   = activeSession.restoredId === entry.id
            const hasPasses  = entry.searchResp && !entry.searchResp.no_results
            const count      = entry.searchResp?.results.length ?? null
            const hasAnswer  = entry.generateResp?.answer != null && !entry.generateResp.refused
            const wasRefused = entry.generateResp?.refused === true
            const failed     = entry.searchResp === null

            return (
              <button
                key={entry.id}
                onClick={() => restoreSession(entry)}
                className="w-full text-left rounded-2xl p-4 transition-all focus:outline-none"
                style={{
                  backgroundColor: isActive ? '#eef6f0' : '#f7f8f5',
                  border: `1.5px solid ${isActive ? '#386641' : '#e8ebe8'}`,
                }}
                onMouseEnter={e => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = '#eef1ee'
                }}
                onMouseLeave={e => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = '#f7f8f5'
                }}
              >
                {/* Query + active badge */}
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-bold leading-5 flex-1" style={{ color: '#102a43' }}>
                    {entry.query}
                  </p>
                  {isActive && (
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                          style={{ backgroundColor: '#386641', color: '#ffffff' }}>
                      Active
                    </span>
                  )}
                </div>

                {/* Time + result badge row */}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-[10px]" style={{ color: '#aab4ad' }}>
                    {entry.timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    {' '}
                    {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {failed ? (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ backgroundColor: '#f4e9ea', color: '#8c3b45' }}>failed</span>
                  ) : !hasPasses ? (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ backgroundColor: '#fff2d8', color: '#885b12' }}>no results</span>
                  ) : (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ backgroundColor: '#e7ece7', color: '#386641' }}>
                      {count} passage{count !== 1 ? 's' : ''}
                    </span>
                  )}
                  {/* AI summary indicator */}
                  {hasAnswer && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold flex items-center gap-1"
                          style={{ backgroundColor: '#fff8ec', color: '#885b12' }}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                           strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/>
                      </svg>
                      AI summary
                    </span>
                  )}
                  {wasRefused && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ backgroundColor: '#fff2d8', color: '#885b12' }}>⚠ refused</span>
                  )}
                </div>

                {/* Restore hint */}
                {!isActive && !failed && (
                  <p className="mt-2 text-[10px]" style={{ color: '#aab4ad' }}>
                    Click to restore this session ↩
                  </p>
                )}
              </button>
            )
          })}
        </div>
      </div>
      {/* ── end history drawer ───────────────────────────────────────────────── */}

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <header className="mb-8">
        <h1 className="text-2xl font-semibold" style={{ color: '#102a43' }}>
          Legal Research
        </h1>
        <p className="mt-2 leading-relaxed" style={{ color: '#667085' }}>
          Search your firm's knowledge base and retrieve the most relevant passages from your indexed documents.
        </p>
      </header>

      {/* ── Query panel ─────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-3xl border p-5 sm:p-7 mb-6"
               style={{ borderColor: '#d9ddd8' }}>

        {/* Panel heading row — title left, controls right */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <h2 className="text-base font-semibold pt-0.5" style={{ color: '#102a43' }}>
            What are you researching?
          </h2>

          {/* Right-hand controls: restored badge OR provider toggle */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">

            {/* Restored session badge + new search button */}
            {activeSession.isRestored && (
              <div className="flex items-center gap-2">
                <span className="rounded-full px-3 py-1 text-xs font-bold flex items-center gap-1.5"
                      style={{ backgroundColor: '#e8edf1', color: '#274c77' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  Restored session
                </span>
                <button
                  onClick={() => {
                    setQuery('')
                    setActiveSession({ searchResp: null, generateResp: null, isRestored: false, restoredId: null })
                    generateMutation.reset()
                    searchMutation.reset()
                  }}
                  className="rounded-full px-3 py-1 text-xs font-bold focus:outline-none transition-colors"
                  style={{ backgroundColor: '#e2eee4', color: '#386641' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#cce0d0'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#e2eee4'}
                >
                  + New search
                </button>
              </div>
            )}

            {/* ── Online / Local provider toggle ── */}
            <div className="flex flex-col items-end gap-1">
              {/* Pill toggle — two side-by-side buttons */}
              <div className="flex rounded-full border overflow-hidden"
                   style={{ borderColor: '#d9ddd8' }}>
                <button
                  type="button"
                  onClick={() => handleProviderChange('online')}
                  className="px-3 py-1.5 text-xs font-semibold focus:outline-none transition-colors"
                  style={{
                    backgroundColor: provider === 'online' ? '#386641' : '#f7f8f5',
                    color:           provider === 'online' ? '#ffffff'  : '#667085',
                  }}
                >
                  Online
                </button>
                <button
                  type="button"
                  onClick={() => handleProviderChange('local')}
                  className="px-3 py-1.5 text-xs font-semibold focus:outline-none transition-colors"
                  style={{
                    backgroundColor: provider === 'local' ? '#274c77' : '#f7f8f5',
                    color:           provider === 'local' ? '#ffffff'  : '#667085',
                    borderLeft: '1px solid #d9ddd8',
                  }}
                >
                  Local
                </button>
              </div>

              {/* Status badge — shows actual provider used or availability warning */}
              {(() => {
                const resp = generateResp
                const used = resp?.provider_used
                if (resp?.fallback && provider === 'local')
                  return <span className="text-[10px]" style={{ color: '#885b12' }}>⚠️ Local unavailable — try Online</span>
                if (resp?.fallback && provider === 'online')
                  return <span className="text-[10px]" style={{ color: '#885b12' }}>⚠️ Online unavailable — check API key</span>
                if (used && provider === 'online')
                  return <span className="text-[10px]" style={{ color: '#667085' }}>🟢 Online · {used}</span>
                if (used && provider === 'local')
                  return <span className="text-[10px]" style={{ color: '#667085' }}>💻 Local · {used}</span>
                if (provider === 'online')
                  return <span className="text-[10px]" style={{ color: '#667085' }}>🟢 Online · Groq</span>
                return <span className="text-[10px]" style={{ color: '#667085' }}>💻 Local · llama3.1:8b</span>
              })()}
            </div>

          </div>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearch} noValidate>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                   style={{ color: '#667085' }} viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                id="legal-query"
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="e.g. termination notice requirements, section 302 evidence…"
                className="w-full rounded-xl border py-4 pl-12 pr-4 text-sm focus:outline-none"
                style={{
                  borderColor: '#cfd6d1',
                  backgroundColor: '#fbfcfa',
                  color: '#102a43',
                  boxShadow: 'none',
                }}
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
            <button
              type="submit"
              disabled={!query.trim() || isSearching}
              className="rounded-xl px-6 py-4 font-bold text-white text-sm focus:outline-none disabled:opacity-50 transition-colors"
              style={{ backgroundColor: '#386641' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#2e5636'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#386641'}
            >
              {isSearching ? 'Searching…' : 'Search'}
            </button>
          </div>
        </form>

        {/* Suggestion chips */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: '#667085' }}>Try:</span>
          {chips.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setQuery(s)
                setActiveSession({ searchResp: null, generateResp: null, isRestored: false, restoredId: null })
                generateMutation.reset()
                searchMutation.reset()
              }}
              className="rounded-full border px-3 py-1.5 text-xs transition-colors focus:outline-none"
              style={{ borderColor: '#d9ddd8', backgroundColor: '#f7f8f5', color: '#102a43' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = '#386641'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = '#d9ddd8'}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      {/* ── Results ─────────────────────────────────────────────────────────── */}
      <div>
        <section>

          {/* Search error — only for live failed searches, not restored sessions */}
          {searchMutation.isError && !activeSession.isRestored && (
            <div className="rounded-2xl border p-5 mb-5 text-sm"
                 style={{ backgroundColor: '#f4e9ea', borderColor: '#e8c8cc', color: '#8c3b45' }}>
              Search failed — ensure your knowledge base has documents with status "Ready".
            </div>
          )}

          {/* No results */}
          {searchResp?.no_results && (
            <div className="rounded-2xl border border-dashed bg-white p-10 text-center"
                 style={{ borderColor: '#cfd6d1' }}>
              <div className="mx-auto h-12 w-12 rounded-full flex items-center justify-center mb-4"
                   style={{ backgroundColor: '#fff2d8', color: '#885b12' }}>
                <SearchX />
              </div>
              <h3 className="text-lg font-bold" style={{ color: '#102a43' }}>No relevant evidence found</h3>
              <p className="mt-2 max-w-md mx-auto text-sm leading-6" style={{ color: '#667085' }}>
                No passages matched "{searchResp.query}" above the relevance threshold. Try rephrasing.
              </p>
            </div>
          )}

          {/* Results */}
          {hasResults && (
            <>
              {/* Header */}
              <div className="flex items-end justify-between mb-4">
                <h2 className="text-lg font-semibold" style={{ color: '#102a43' }}>
                  Retrieved Passages
                </h2>
                <span className="rounded-full px-3 py-1.5 text-xs font-bold"
                      style={{ backgroundColor: '#e7ece7', color: '#386641' }}>
                  {searchResp.total} passage{searchResp.total !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Summarise button — not shown in restored sessions that already have an answer */}
              {canGenerate && (!generateResp || generateResp.fallback) && (
                <div className="mb-5">
                  <button
                    onClick={() => generateMutation.mutate(query.trim())}
                    disabled={isSummarising}
                    className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 transition-colors"
                    style={{ backgroundColor: 'rgba(255,255,255,.1)', border: '1px solid #cfd6d1', color: '#102a43' }}
                  >
                    <Sparkles />
                    {isSummarising ? 'Summarising…' : 'Summarise with Sources'}
                  </button>
                  {(generateMutation.isError || (generateMutation.isSuccess && generateResp?.fallback)) && (
                    <p className="mt-2 text-xs" style={{ color: '#8c3b45' }}>
                      Summary unavailable — the LLM did not return a usable answer. Review the passages below.
                    </p>
                  )}
                </div>
              )}

              {/* AI synthesis card */}
              {generateResp && !generateResp.fallback && (
                <section className="rounded-2xl p-6 text-white mb-5"
                         style={{ backgroundColor: '#102a43', boxShadow: '0 4px 24px rgba(16,42,67,.10)' }}
                         aria-labelledby="answer-title">
                  <div className="flex flex-col sm:flex-row gap-4 justify-between">
                    {/* flex-1 so the title fills the row and there is no dead space on the right */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs font-semibold"
                           style={{ color: '#d8e9db' }}>
                        Summary
                        {/* provider_used pill — shows which model answered */}
                        {generateResp.provider_used && (
                          <span className="rounded-full px-2 py-0.5 text-[9px] font-bold"
                                style={{ backgroundColor: 'rgba(255,255,255,.12)', color: '#94a3b8' }}>
                            {generateResp.provider_used === 'ollama'
                              ? `💻 ${generateResp.provider_used}`
                              : `🟢 ${generateResp.provider_used}`}
                          </span>
                        )}
                        {activeSession.isRestored && (
                          <span className="rounded-full px-2 py-0.5 text-[9px] font-bold"
                                style={{ backgroundColor: 'rgba(255,255,255,.12)', color: '#94a3b8' }}>
                            from history
                          </span>
                        )}
                      </div>
                      <h3 id="answer-title" className="text-xl font-semibold mt-2">
                        {searchResp?.query}
                      </h3>
                    </div>
                    {/* Dismiss only makes sense for live sessions */}
                    {!activeSession.isRestored && (
                      <button
                        onClick={() => {
                          generateMutation.reset()
                          setActiveSession(prev => ({ ...prev, generateResp: null }))
                        }}
                        className="self-start rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none transition-colors"
                        style={{ backgroundColor: 'rgba(255,255,255,.10)' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,.20)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,.10)'}
                      >
                        Dismiss
                      </button>
                    )}
                  </div>

                  {generateResp.refused && (
                    <p className="mt-4 rounded-lg p-3 text-sm"
                       style={{ backgroundColor: 'rgba(197,139,42,.15)', color: '#f0c96a' }}>
                      The retrieved passages do not contain sufficient information to answer this question.
                    </p>
                  )}
                  {generateResp.answer && !generateResp.refused && (
                    <AnswerText answer={generateResp.answer} onCitationClick={handleCitationClick} />
                  )}

                  <div className="mt-5 pt-4 border-t flex gap-2 text-xs"
                       style={{ borderColor: 'rgba(255,255,255,.15)', color: '#94a3b8' }}>
                    <Info />
                    <p>This summary is generated from your uploaded documents. It is not legal advice.
                       Always verify against primary sources before relying on this output.</p>
                  </div>
                </section>
              )}

              {/* Evidence cards */}
              <div className="space-y-4">
                {searchResp.results.map((r, i) => {
                  const rs            = rankStyle(i)
                  const isHighlighted = highlighted === r.chunk_id
                  const isExpanded    = expanded    === r.chunk_id

                  return (
                    <article
                      key={r.chunk_id}
                      ref={el => { passageRefs.current[r.chunk_id] = el }}
                      className="rounded-2xl border bg-white p-5 transition-all duration-300"
                      style={{
                        borderColor: isHighlighted ? '#c58b2a'  : '#d9ddd8',
                        boxShadow:   isHighlighted
                          ? '0 0 0 4px rgba(197,139,42,.16)'
                          : '0 2px 8px rgba(16,42,67,.04)',
                      }}
                    >
                      <div className="flex gap-4">
                        <div
                          className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-sm"
                          style={{ backgroundColor: rs.bg, color: rs.color }}
                        >
                          {String(i + 1).padStart(2, '0')}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
                                  style={{ backgroundColor: rs.bg, color: rs.color }}>
                              PDF
                            </span>
                            <span className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                                  style={{ backgroundColor: '#fff2d8', color: '#885b12' }}>
                              Score {r.score.toFixed(0)}
                            </span>
                          </div>

                          <h3 className="mt-3 text-lg font-bold" style={{ color: '#102a43' }}>
                            {r.filename}
                          </h3>
                          <p className="mt-1 text-sm" style={{ color: '#667085' }}>Page {r.page_number}</p>

                          <p className={`mt-4 leading-7 text-sm ${isExpanded ? '' : 'line-clamp-3'}`}
                             style={{ color: '#34495e' }}>
                            {r.text}
                          </p>

                          <div className="flex items-center gap-4 mt-4">
                            <button
                              onClick={() => setExpanded(isExpanded ? null : r.chunk_id)}
                              className="text-sm font-bold focus:outline-none"
                              style={{ color: '#386641' }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#234f2c'}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#386641'}
                            >
                              {isExpanded ? 'Show less ↑' : 'Show full passage ↓'}
                            </button>
                            <button
                              onClick={() => openPdfInTab(r.document_id, r.page_number)}
                              className="text-xs font-semibold focus:outline-none"
                              style={{ color: '#274c77' }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#102a43'}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#274c77'}
                            >
                              Open in PDF ↗
                            </button>
                            <button
                              onClick={() => navigator.clipboard?.writeText(
                                `${r.filename}, p.${r.page_number}: ${r.text}`
                              )}
                              className="text-xs focus:outline-none"
                              style={{ color: '#aab4ad' }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#667085'}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#aab4ad'}
                            >
                              Copy citation
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </>
          )}

          {/* Initial empty state */}
          {!searchResp && !isSearching && (
            <div className="rounded-2xl border border-dashed bg-white p-14 text-center"
                 style={{ borderColor: '#cfd6d1' }}>
              <div className="mx-auto h-14 w-14 rounded-full flex items-center justify-center mb-5"
                   style={{ backgroundColor: '#e2eee4', color: '#386641' }}>
                <Scale />
              </div>
              <h3 className="display-font text-xl font-semibold" style={{ color: '#102a43' }}>
                Search your knowledge base
              </h3>
              <p className="mt-2 max-w-md mx-auto text-sm leading-6" style={{ color: '#667085' }}>
                Enter a legal question above to retrieve the most relevant passages from your firm's indexed documents.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
