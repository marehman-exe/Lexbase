// WelcomePage.tsx — 5-beat narrative: Problem → Gap → Solution → Proof → Next Step
// Design tokens from index.css. No new dependencies.

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const GITHUB_URL = 'https://github.com/marehman-exe/Lexbase'

// ── Icons (same stroke style as Sidebar.tsx) ─────────────────────────────────
const Ico = {
  scale: ({ s = 20 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18M5 6l-2 8h4L5 6zM19 6l-2 8h4L19 6z"/><path d="M3 20h18"/>
    </svg>
  ),
  search: ({ s = 18 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  ),
  file: ({ s = 18 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
  link: ({ s = 18 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  ),
  users: ({ s = 18 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  github: ({ s = 18 }: { s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  ),
  chevL: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  chevR: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
  menu: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
  close: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  plus: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  minus: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
}

// ── Design tokens (mirrors index.css :root) ───────────────────────────────────
const C = {
  brand: '#0b1f33', brandHov: '#183c5e',
  accent: '#386641', accentHov: '#2e5636', accentBg: '#e2eee4',
  gold: '#c58b2a', goldBg: '#fff2d8', goldText: '#885b12',
  text: '#102a43', textSec: '#34495e', textMut: '#667085', textDis: '#aab4ad',
  border: '#d9ddd8', bg: '#f5f3ee', bgSurf: '#ffffff',
  bgSec: '#f7f8f5', bgElev: '#eef1ee',
  info: '#274c77', infoBg: '#e8edf1',
  error: '#8c3b45', errorBg: '#f4e9ea',
  n94: '#94a3b8', n64: '#64748b',
}

// ── Shared primitives ─────────────────────────────────────────────────────────
type BtnSize = 'sm' | 'md' | 'lg'

function BtnPrimary({ children, onClick, href, size = 'md' }: {
  children: React.ReactNode; onClick?: () => void; href?: string; size?: BtnSize
}) {
  const pad = size === 'lg' ? '0.875rem 2rem' : size === 'sm' ? '0.45rem 1rem' : '0.72rem 1.5rem'
  const fs  = size === 'lg' ? '1rem'          : size === 'sm' ? '0.8rem'        : '0.9rem'
  const s: React.CSSProperties = {
    backgroundColor: C.accent, color: '#fff', padding: pad, borderRadius: '0.75rem',
    fontWeight: 600, fontSize: fs, display: 'inline-flex', alignItems: 'center',
    gap: '0.45rem', border: 'none', cursor: 'pointer', textDecoration: 'none',
    transition: 'background-color 0.15s', fontFamily: 'inherit',
  }
  const hov = (e: React.MouseEvent) => (e.currentTarget as HTMLElement).style.backgroundColor = C.accentHov
  const out = (e: React.MouseEvent) => (e.currentTarget as HTMLElement).style.backgroundColor = C.accent
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" style={s} onMouseEnter={hov} onMouseLeave={out}>{children}</a>
  return <button type="button" style={s} onClick={onClick} onMouseEnter={hov} onMouseLeave={out}>{children}</button>
}

function BtnGhost({ children, href, onClick, light = false, size = 'md' }: {
  children: React.ReactNode; href?: string; onClick?: () => void; light?: boolean; size?: BtnSize
}) {
  const pad = size === 'lg' ? '0.875rem 2rem' : size === 'sm' ? '0.45rem 1rem' : '0.72rem 1.5rem'
  const fs  = size === 'lg' ? '1rem'          : size === 'sm' ? '0.8rem'        : '0.9rem'
  const s: React.CSSProperties = {
    backgroundColor: 'transparent',
    color: light ? C.n94 : C.text,
    border: `1.5px solid ${light ? 'rgba(255,255,255,0.22)' : C.border}`,
    padding: pad, borderRadius: '0.75rem', fontWeight: 600, fontSize: fs,
    display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
    cursor: 'pointer', textDecoration: 'none', transition: 'all 0.15s', fontFamily: 'inherit',
  }
  const hov = (e: React.MouseEvent) => {
    const el = e.currentTarget as HTMLElement
    if (light) { el.style.color = '#fff'; el.style.borderColor = 'rgba(255,255,255,0.55)' }
    else { el.style.borderColor = C.accent; el.style.backgroundColor = '#eef5ef' }
  }
  const out = (e: React.MouseEvent) => {
    const el = e.currentTarget as HTMLElement
    if (light) { el.style.color = C.n94; el.style.borderColor = 'rgba(255,255,255,0.22)' }
    else { el.style.borderColor = C.border; el.style.backgroundColor = 'transparent' }
  }
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" style={s} onMouseEnter={hov} onMouseLeave={out}>{children}</a>
  return <button type="button" style={s} onClick={onClick} onMouseEnter={hov} onMouseLeave={out}>{children}</button>
}

function Divider() { return <div style={{ height: 1, backgroundColor: C.border }} /> }

// ── Small reusable UI fragments ───────────────────────────────────────────────
function Tag({ children, color = C.accent, bg = C.accentBg }: { children: React.ReactNode; color?: string; bg?: string }) {
  return (
    <span style={{ fontSize: '0.65rem', fontWeight: 700, color, backgroundColor: bg,
                   borderRadius: '999px', padding: '0.15rem 0.5rem', flexShrink: 0 }}>
      {children}
    </span>
  )
}

function BeatBadge({ n, label, active }: { n: string; label: string; active: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.7rem', fontWeight: 700,
                     color: active ? C.accent : C.textDis,
                     backgroundColor: active ? C.accentBg : C.bgSec,
                     width: 26, height: 26, borderRadius: '50%',
                     display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                     transition: 'all 0.2s', flexShrink: 0 }}>
        {n}
      </span>
      <span style={{ fontSize: '0.8rem', fontWeight: active ? 600 : 400,
                     color: active ? C.text : C.textMut, transition: 'color 0.2s' }}>
        {label}
      </span>
    </div>
  )
}

// ── Product UI preview (pixel-accurate to ResearchPage palette) ───────────────
function ProductPreview({ compact = false }: { compact?: boolean }) {
  const minH = compact ? 260 : 310
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: '0.875rem',
                  overflow: 'hidden', boxShadow: '0 4px 24px rgba(16,42,67,0.09)' }}>
      {/* Window chrome */}
      <div style={{ backgroundColor: C.brand, padding: '0.55rem 0.875rem',
                    display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        {['#ef4444','#f59e0b','#22c55e'].map(c => (
          <span key={c} style={{ width: 8, height: 8, borderRadius: '50%',
                                 backgroundColor: c, display: 'inline-block' }} />
        ))}
        <span style={{ marginLeft: '0.625rem', color: C.n94, fontSize: '0.72rem' }}>LexBase · Legal Research</span>
      </div>
      {/* Shell */}
      <div style={{ display: 'flex', backgroundColor: C.bg, minHeight: minH }}>
        {/* Mini sidebar */}
        <div style={{ backgroundColor: C.brand, width: 46, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', padding: '0.875rem 0', gap: '1.125rem', flexShrink: 0 }}>
          <span style={{ color: C.gold }}><Ico.scale s={16} /></span>
          <span style={{ color: '#fff' }}><Ico.search s={14} /></span>
          <span style={{ color: C.n94 }}><Ico.file s={14} /></span>
          <span style={{ color: C.n94 }}><Ico.users s={14} /></span>
        </div>
        {/* Content */}
        <div style={{ flex: 1, padding: '1rem', overflow: 'hidden' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 700, color: C.textMut, textTransform: 'uppercase',
                      letterSpacing: '0.08em', marginBottom: '0.625rem' }}>Legal Research</p>
          {/* Search bar */}
          <div style={{ backgroundColor: C.bgSurf, border: `1.5px solid ${C.gold}`,
                        borderRadius: '0.575rem', padding: '0.5rem 0.75rem',
                        display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem',
                        boxShadow: `0 0 0 3px rgba(197,139,42,0.1)` }}>
            <span style={{ color: C.textMut, flexShrink: 0 }}><Ico.search s={13} /></span>
            <span style={{ fontSize: '0.75rem', color: C.text, flex: 1,
                           overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              What are the grounds for dismissal of this petition?
            </span>
            <span style={{ backgroundColor: C.accent, color: '#fff', borderRadius: '0.35rem',
                           padding: '0.2rem 0.55rem', fontSize: '0.67rem', fontWeight: 600, flexShrink: 0 }}>
              Search
            </span>
          </div>
          {/* Passage cards */}
          {[
            { rank: '01', rBg: C.accentBg, rC: C.accent, score: 82, page: 4,
              text: 'The petition is dismissed — the applicant failed to demonstrate sufficient cause under Section 22…' },
            { rank: '02', rBg: C.infoBg, rC: C.info, score: 74, page: 7,
              text: 'The court finds no merit in the grounds raised. No violation of natural justice was shown…' },
          ].map(({ rank, rBg, rC, score, page, text }) => (
            <div key={rank} style={{ backgroundColor: C.bgSurf, border: `1px solid ${C.border}`,
                                     borderRadius: '0.575rem', padding: '0.625rem', marginBottom: '0.4rem',
                                     display: 'flex', gap: '0.5rem' }}>
              <div style={{ backgroundColor: rBg, color: rC, width: 24, height: 24, borderRadius: '0.35rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.6rem', fontWeight: 700, flexShrink: 0 }}>{rank}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.25rem', alignItems: 'center' }}>
                  <Tag color={C.accent} bg={C.accentBg}>PDF</Tag>
                  <Tag color={C.goldText} bg={C.goldBg}>Score {score}</Tag>
                  <span style={{ fontSize: '0.6rem', color: C.textDis, marginLeft: 'auto' }}>p.{page}</span>
                </div>
                <p style={{ fontSize: '0.72rem', color: C.textSec, lineHeight: 1.45, margin: 0 }}>{text}</p>
              </div>
            </div>
          ))}
          {/* Summarise strip */}
          <div style={{ backgroundColor: C.bgElev, border: `1px solid ${C.accentBg}`, borderRadius: '0.575rem',
                        padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.68rem', color: C.accent, fontWeight: 600 }}>✦ Summarise with Sources</span>
            <span style={{ fontSize: '0.63rem', color: C.textMut, marginLeft: 'auto' }}>Groq · inline citations</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Citation visual ───────────────────────────────────────────────────────────
function CitationPreview() {
  return (
    <div style={{ backgroundColor: C.bgSurf, borderRadius: '0.875rem',
                  border: `1px solid ${C.border}`, padding: '1rem' }}>
      <p style={{ fontSize: '0.68rem', fontWeight: 700, color: C.textMut, textTransform: 'uppercase',
                  letterSpacing: '0.08em', marginBottom: '0.75rem' }}>AI summary with citations</p>
      <div style={{ backgroundColor: C.bgSec, borderRadius: '0.5rem', padding: '0.875rem',
                    border: `1px solid ${C.border}`, marginBottom: '0.625rem' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: C.text, margin: '0 0 0.45rem' }}>Summary</p>
        <p style={{ fontSize: '0.78rem', color: C.textSec, lineHeight: 1.65, margin: 0 }}>
          The petition was dismissed on the grounds that the applicant failed to establish
          sufficient cause{' '}
          <span style={{ backgroundColor: C.gold, color: C.brand, borderRadius: '0.3rem',
                         padding: '0.08rem 0.35rem', fontSize: '0.65rem', fontWeight: 700 }}>[1]</span>
          . The court found no violation of natural justice{' '}
          <span style={{ backgroundColor: C.gold, color: C.brand, borderRadius: '0.3rem',
                         padding: '0.08rem 0.35rem', fontSize: '0.65rem', fontWeight: 700 }}>[2]</span>
          .
        </p>
      </div>
      <div style={{ padding: '0.625rem 0.75rem', backgroundColor: C.bgSurf,
                    border: `1px solid ${C.border}`, borderRadius: '0.5rem' }}>
        <p style={{ fontSize: '0.65rem', fontWeight: 700, color: C.textMut, textTransform: 'uppercase',
                    margin: '0 0 0.3rem' }}>Sources</p>
        {['[1] CR.P_521_2024.pdf, p.4', '[2] CR.P_521_2024.pdf, p.7'].map(s => (
          <p key={s} style={{ fontSize: '0.72rem', color: C.accent, margin: '0 0 0.15rem',
                              textDecoration: 'underline', textDecorationColor: 'transparent',
                              cursor: 'pointer' }}>{s}</p>
        ))}
      </div>
    </div>
  )
}

// ── Context visual (slide 02) ─────────────────────────────────────────────────
function ContextPreview() {
  return (
    <div style={{ backgroundColor: C.bgSurf, borderRadius: '0.875rem',
                  border: `1px solid ${C.border}`, padding: '1rem' }}>
      <p style={{ fontSize: '0.68rem', fontWeight: 700, color: C.textMut, textTransform: 'uppercase',
                  letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Finding a passage vs. finding an answer</p>
      {[
        { label: 'Ctrl+F result', q: '"grounds for dismissal"', hit: '0 exact matches', ok: false },
        { label: 'LexBase result', q: 'What are the grounds for dismissal?', hit: '3 relevant passages', ok: true },
      ].map(({ label, q, hit, ok }) => (
        <div key={label} style={{ padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '0.5rem',
                                  backgroundColor: ok ? C.bgElev : C.bgSec,
                                  border: `1px solid ${ok ? '#c6ddc9' : C.border}` }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.05em', margin: '0 0 0.3rem',
                      color: ok ? C.accent : C.textMut }}>{label}</p>
          <p style={{ fontSize: '0.75rem', color: C.textSec, margin: '0 0 0.3rem',
                      fontStyle: 'italic' }}>"{q}"</p>
          <p style={{ fontSize: '0.72rem', fontWeight: 600, margin: 0,
                      color: ok ? C.accent : C.error }}>{ok ? '✓' : '✗'} {hit}</p>
        </div>
      ))}
    </div>
  )
}

// ── 5-beat SLIDES ─────────────────────────────────────────────────────────────
interface Beat {
  n:       string
  label:   string
  heading: string
  sub:     string
  body:    string
  visual:  React.ReactNode
}

const BEATS: Beat[] = [
  {
    n: '01', label: 'The problem',
    heading: 'Legal information is buried in lengthy documents.',
    sub:     'Manual searching costs time that should go to legal analysis.',
    body:    'Finding the passage that answers a specific legal question often means opening each PDF, running a keyword search, scanning pages, and repeating — across multiple files, under time pressure. The information is there. Locating it is the friction.',
    visual: (
      <div style={{ backgroundColor: C.bgSurf, borderRadius: '0.875rem',
                    border: `1px solid ${C.border}`, padding: '1rem' }}>
        <p style={{ fontSize: '0.68rem', fontWeight: 700, color: C.textMut, textTransform: 'uppercase',
                    letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Manual document search</p>
        {[
          { name: 'CR.P_521_2024.pdf',   pages: 42, s: 'Searching…', a: true  },
          { name: 'Order_April_2024.pdf', pages: 18, s: 'Queued',     a: false },
          { name: 'Petition_2023.pdf',    pages: 67, s: 'Queued',     a: false },
        ].map(({ name, pages, s, a }) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem',
                                   padding: '0.5rem 0.625rem', borderRadius: '0.45rem',
                                   marginBottom: '0.3rem',
                                   backgroundColor: a ? C.bgElev : 'transparent',
                                   border: `1px solid ${a ? '#c6ddc9' : C.border}` }}>
            <span style={{ color: a ? C.accent : C.textDis, flexShrink: 0 }}><Ico.file s={14} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.72rem', fontWeight: 600, color: C.text, margin: 0,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
              <p style={{ fontSize: '0.62rem', color: C.textMut, margin: 0 }}>{pages} pages</p>
            </div>
            <Tag color={a ? C.accent : C.textDis} bg={a ? C.accentBg : C.bgSec}>{s}</Tag>
          </div>
        ))}
        <div style={{ marginTop: '0.625rem', padding: '0.5rem 0.625rem', backgroundColor: C.goldBg,
                      borderRadius: '0.45rem', border: `1px solid #f0d9a8` }}>
          <p style={{ fontSize: '0.68rem', color: C.goldText, margin: 0 }}>
            ⚠ Searching 3 documents manually — estimated 25–40 minutes
          </p>
        </div>
      </div>
    ),
  },
  {
    n: '02', label: 'The gap',
    heading: 'Finding a passage is not the same as finding a supported answer.',
    sub:     'Keywords match words. Legal questions have meaning.',
    body:    'A Ctrl+F search finds exact text — not relevance. A question about "grounds for dismissal" may be answered by a passage that describes the reasoning without using those words. Even when a passage is found, understanding it requires context: what surrounds it, how it was used in the judgment, and whether it actually supports the question being investigated.',
    visual: <ContextPreview />,
  },
  {
    n: '03', label: 'The solution',
    heading: 'LexBase helps you find relevant information and examine it at its source.',
    sub:     'Hybrid search. Ranked results. Every answer linked back.',
    body:    'Upload your PDF documents. Search using a question or a legal phrase. LexBase combines keyword matching with semantic similarity to surface the passages most relevant to the meaning of your query — ranked by score, with the source document and page number on every result. Open the original PDF at the exact page directly from the result card.',
    visual: <ProductPreview compact />,
  },
  {
    n: '04', label: 'The proof',
    heading: 'Every answer in LexBase has a traceable source.',
    sub:     'Inline citations. Original PDF access. No unverifiable claims.',
    body:    'When you use Summarise with Sources, the AI-generated answer includes numbered inline citations. Each [N] maps to a specific retrieved passage. Nothing is asserted without a reference you can inspect. The answer is a starting point for legal judgment — not a replacement for it.',
    visual: <CitationPreview />,
  },
  {
    n: '05', label: 'The next step',
    heading: 'Try LexBase with your own documents, or explore the source code.',
    sub:     'Open source · MIT licence · github.com/marehman-exe/Lexbase',
    body:    'LexBase is publicly available on GitHub — the full FastAPI backend, React 19 frontend, hybrid search pipeline, and document ingestion are all in the open. Try it with your own documents by logging in, or read the implementation before committing.',
    visual: (
      <div style={{ backgroundColor: C.brand, borderRadius: '0.875rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem' }}>
          <div style={{ backgroundColor: C.gold, color: C.brand, width: 34, height: 34,
                        borderRadius: '0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Ico.scale s={17} />
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff', margin: 0 }}>marehman-exe / Lexbase</p>
            <p style={{ color: C.n64, fontSize: '0.72rem', margin: 0 }}>github.com</p>
          </div>
        </div>
        <p style={{ fontSize: '0.78rem', color: C.n94, lineHeight: 1.65, marginBottom: '1.125rem' }}>
          Full-stack legal document research — FastAPI · React 19 · PostgreSQL · pgvector · sentence-transformers · Groq
        </p>
        {[
          { dot: C.accent,  t: 'FastAPI + Python 3.12 backend'      },
          { dot: C.info,    t: 'React 19 + TypeScript frontend'      },
          { dot: C.gold,    t: 'Hybrid vector + keyword search'       },
          { dot: C.error,   t: 'Groq / OpenRouter / Ollama LLM'      },
        ].map(({ dot, t }) => (
          <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: dot,
                           display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: '0.75rem', color: C.n94 }}>{t}</span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', marginTop: '1.125rem' }}>
          <BtnPrimary href={GITHUB_URL} size="sm"><Ico.github s={14} /> View on GitHub</BtnPrimary>
        </div>
      </div>
    ),
  },
]

// ── Narrative Slideshow ───────────────────────────────────────────────────────
function NarrativeSlideshow({ onTry }: { onTry: () => void }) {
  const [cur, setCur]           = useState(0)
  const [prefRed, setPrefRed]   = useState(false)
  const timerRef                = useRef<ReturnType<typeof setInterval> | null>(null)
  const [playing, setPlaying]   = useState(false)
  const count                   = BEATS.length

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefRed(mq.matches)
    const h = (e: MediaQueryListEvent) => setPrefRed(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])

  const go   = useCallback((i: number) => setCur(((i % count) + count) % count), [count])
  const prev = useCallback(() => { go(cur - 1); setPlaying(false) }, [cur, go])
  const next = useCallback(() => { go(cur + 1); setPlaying(false) }, [cur, go])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (playing && !prefRed) timerRef.current = setInterval(() => setCur(c => (c + 1) % count), 8000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [playing, prefRed, count])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [prev, next])

  const beat = BEATS[cur]
  const fade = prefRed ? 'none' : 'opacity 0.22s ease'

  return (
    <div>
      {/* Beat progress — left sidebar on md+, top strip on mobile */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0 2.5rem' }}
           className="lx-slideshow-grid">

        {/* Left beat list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0', paddingRight: '2rem',
                      borderRight: `1px solid ${C.border}`, minWidth: 175 }}
             className="lx-beat-sidebar">
          {BEATS.map((b, i) => (
            <button key={i} type="button"
                    onClick={() => { go(i); setPlaying(false) }}
                    aria-label={`${b.n} ${b.label}`}
                    aria-pressed={i === cur}
                    style={{ background: 'none', border: 'none', cursor: 'pointer',
                             padding: '0.75rem 0', textAlign: 'left', fontFamily: 'inherit',
                             borderLeft: `2px solid ${i === cur ? C.accent : 'transparent'}`,
                             paddingLeft: '1rem', transition: 'border-color 0.2s',
                             borderBottom: i < count - 1 ? `1px solid ${C.border}` : 'none' }}>
              <BeatBadge n={b.n} label={b.label} active={i === cur} />
            </button>
          ))}
        </div>

        {/* Slide content */}
        <div style={{ opacity: 1, transition: fade }}>
          {/* Beat label + heading */}
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: C.accent, letterSpacing: '0.1em',
                      textTransform: 'uppercase', margin: '0 0 0.625rem' }}>
            {beat.n} · {beat.label}
          </p>
          <h3 style={{ fontSize: 'clamp(1.15rem, 2.5vw, 1.55rem)', fontWeight: 700, color: C.text,
                       lineHeight: 1.22, letterSpacing: '-0.015em', margin: '0 0 0.375rem' }}>
            {beat.heading}
          </h3>
          <p style={{ fontSize: '0.85rem', fontWeight: 500, color: C.accent, margin: '0 0 1rem' }}>
            {beat.sub}
          </p>

          {/* Two-column: body text + visual */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                        gap: '1.75rem', alignItems: 'start' }}>
            <div>
              <p style={{ fontSize: '0.9rem', color: C.textMut, lineHeight: 1.78, margin: 0 }}>
                {beat.body}
              </p>
              {cur === count - 1 && (
                <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
                  <BtnPrimary onClick={onTry} size="md">Try LexBase</BtnPrimary>
                  <BtnGhost href={GITHUB_URL} size="md"><Ico.github s={15} /> GitHub</BtnGhost>
                </div>
              )}
            </div>
            <div>{beat.visual}</div>
          </div>

          {/* Arrow nav + dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem',
                        marginTop: '1.5rem', paddingTop: '1rem', borderTop: `1px solid ${C.border}` }}>
            <button type="button" onClick={prev} aria-label="Previous"
                    style={{ background: C.bgSec, border: `1px solid ${C.border}`, borderRadius: '0.45rem',
                             padding: '0.4rem', cursor: 'pointer', display: 'flex', color: C.text, fontFamily: 'inherit' }}>
              <Ico.chevL />
            </button>
            <div style={{ display: 'flex', gap: '0.35rem', flex: 1, justifyContent: 'center' }}>
              {BEATS.map((_, i) => (
                <button key={i} type="button" onClick={() => { go(i); setPlaying(false) }}
                        aria-label={`Slide ${i + 1}`} aria-current={i === cur ? 'true' : undefined}
                        style={{ width: i === cur ? 22 : 7, height: 7, borderRadius: '999px',
                                 backgroundColor: i === cur ? C.accent : C.border,
                                 border: 'none', cursor: 'pointer', padding: 0,
                                 transition: prefRed ? 'none' : 'all 0.25s' }} />
              ))}
            </div>
            <button type="button" onClick={next} aria-label="Next"
                    style={{ background: C.bgSec, border: `1px solid ${C.border}`, borderRadius: '0.45rem',
                             padding: '0.4rem', cursor: 'pointer', display: 'flex', color: C.text, fontFamily: 'inherit' }}>
              <Ico.chevR />
            </button>
            <button type="button" onClick={() => setPlaying(p => !p)}
                    aria-label={playing ? 'Pause' : 'Auto-advance'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer',
                             fontSize: '0.72rem', color: C.textMut, fontFamily: 'inherit',
                             padding: '0.4rem 0.5rem' }}>
              {playing ? '⏸' : '▶'}
            </button>
            <span style={{ fontSize: '0.72rem', color: C.textMut, minWidth: '2.5rem', textAlign: 'right' }}>
              {cur + 1} / {count}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── FAQ ───────────────────────────────────────────────────────────────────────
function FAQ({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                       padding: '0.875rem 0', display: 'flex', alignItems: 'center',
                       justifyContent: 'space-between', gap: '1rem',
                       fontFamily: 'inherit', textAlign: 'left' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: C.text, flex: 1 }}>{q}</span>
        <span style={{ color: C.accent, flexShrink: 0 }}>{open ? <Ico.minus /> : <Ico.plus />}</span>
      </button>
      {open && (
        <p style={{ fontSize: '0.85rem', color: C.textMut, lineHeight: 1.75,
                    margin: 0, paddingBottom: '0.875rem' }}>{a}</p>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function WelcomePage() {
  const navigate               = useNavigate()
  const { user, initialising } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const h = () => { if (window.innerWidth >= 768) setMenuOpen(false) }
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  useEffect(() => {
    if (!initialising && user) navigate('/dashboard', { replace: true })
  }, [initialising, user, navigate])

  const goLogin = () => navigate('/login')
  const W = '920px'

  return (
    <div style={{ fontFamily: '"DM Sans", system-ui, sans-serif',
                  backgroundColor: C.bg, color: C.text }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50,
                       backgroundColor: C.brand, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: W, margin: '0 auto', padding: '0 1.5rem', height: 56,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}>
            <div style={{ backgroundColor: C.gold, color: C.brand, width: 32, height: 32,
                          borderRadius: '0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Ico.scale s={16} />
            </div>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.92rem', letterSpacing: '-0.01em' }}>
              LexBase
            </span>
          </a>

          {/* Desktop nav */}
          <nav aria-label="Site navigation" className="lx-nav-desk"
               style={{ display: 'flex', alignItems: 'center', gap: '0.1rem' }}>
            {[
              { t: 'The Problem',  h: '#narrative' },
              { t: 'How It Works', h: '#how'        },
              { t: 'Features',     h: '#features'   },
              { t: 'Open Source',  h: '#oss'        },
            ].map(({ t, h }) => (
              <a key={t} href={h}
                 style={{ color: C.n94, fontSize: '0.83rem', fontWeight: 500,
                          padding: '0.375rem 0.65rem', borderRadius: '0.45rem',
                          textDecoration: 'none', transition: 'color 0.15s' }}
                 onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#fff'}
                 onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = C.n94}>
                {t}
              </a>
            ))}
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer"
               style={{ color: C.n94, fontSize: '0.83rem', fontWeight: 500,
                        padding: '0.375rem 0.65rem', borderRadius: '0.45rem',
                        textDecoration: 'none', display: 'flex', alignItems: 'center',
                        gap: '0.35rem', transition: 'color 0.15s' }}
               onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#fff'}
               onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = C.n94}>
              <Ico.github s={14} /> GitHub
            </a>
            <button type="button" onClick={goLogin}
                    style={{ marginLeft: '0.375rem', backgroundColor: C.accent, color: '#fff',
                             border: 'none', borderRadius: '0.55rem', padding: '0.42rem 0.95rem',
                             fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer',
                             transition: 'background-color 0.15s', fontFamily: 'inherit' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = C.accentHov}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = C.accent}>
              Log in
            </button>
          </nav>

          {/* Mobile burger */}
          <button type="button" onClick={() => setMenuOpen(v => !v)}
                  aria-label="Toggle navigation" aria-expanded={menuOpen}
                  className="lx-nav-mob"
                  style={{ background: 'none', border: 'none', color: C.n94,
                           cursor: 'pointer', padding: 4, display: 'none' }}>
            {menuOpen ? <Ico.close /> : <Ico.menu />}
          </button>
        </div>

        {menuOpen && (
          <div style={{ backgroundColor: C.brand, borderTop: '1px solid rgba(255,255,255,0.08)',
                        padding: '1rem 1.5rem 1.5rem' }}>
            {[
              { t: 'The Problem', h: '#narrative', ext: false },
              { t: 'How It Works', h: '#how',       ext: false },
              { t: 'Features',    h: '#features',   ext: false },
              { t: 'Open Source', h: '#oss',         ext: false },
              { t: 'GitHub',      h: GITHUB_URL,     ext: true  },
            ].map(({ t, h, ext }) => (
              <a key={t} href={h} target={ext ? '_blank' : undefined}
                 rel={ext ? 'noopener noreferrer' : undefined}
                 onClick={() => setMenuOpen(false)}
                 style={{ display: 'block', color: C.n94, padding: '0.7rem 0',
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                          textDecoration: 'none', fontSize: '0.92rem', fontWeight: 500 }}>
                {t}
              </a>
            ))}
            <button type="button" onClick={() => { setMenuOpen(false); goLogin() }}
                    style={{ marginTop: '0.875rem', width: '100%', backgroundColor: C.accent,
                             color: '#fff', border: 'none', borderRadius: '0.75rem',
                             padding: '0.75rem', fontSize: '0.92rem', fontWeight: 600,
                             cursor: 'pointer', fontFamily: 'inherit' }}>
              Log in
            </button>
          </div>
        )}
      </header>

      {/* ── HERO — answers "what + why" without requiring any clicking ─────── */}
      <section style={{ backgroundColor: C.bg, padding: '4.5rem 1.5rem 3rem' }}>
        <div style={{ maxWidth: W, margin: '0 auto',
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                      gap: '3rem', alignItems: 'center' }}>
          {/* Left: value prop */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
                          backgroundColor: C.accentBg, color: C.accent, borderRadius: '999px',
                          padding: '0.3rem 0.8rem', fontSize: '0.72rem', fontWeight: 600,
                          marginBottom: '1.5rem', border: `1px solid #c6ddc9` }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%',
                             backgroundColor: C.accent, display: 'inline-block' }} />
              Open source · Legal document research
            </div>

            <h1 style={{ fontSize: 'clamp(1.9rem, 4.5vw, 2.75rem)', fontWeight: 700, color: C.text,
                         lineHeight: 1.18, letterSpacing: '-0.025em', marginBottom: '1.125rem' }}>
              Legal research starts<br />with finding the<br />right information.
            </h1>

            <p style={{ fontSize: '1rem', color: C.textMut, lineHeight: 1.78,
                        maxWidth: 460, marginBottom: '1.75rem' }}>
              LexBase helps legal professionals search their documents, surface relevant passages,
              and trace every answer back to its source — so the work that matters
              gets more attention than the search that precedes it.
            </p>

            <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <BtnPrimary onClick={goLogin} size="lg">Try LexBase</BtnPrimary>
              <BtnGhost href={GITHUB_URL} size="lg"><Ico.github s={16} /> Explore on GitHub</BtnGhost>
            </div>

            <p style={{ fontSize: '0.78rem', color: C.textDis }}>
              Requires an account — set one up via the admin panel or ask your firm administrator.
            </p>
          </div>

          {/* Right: product preview — visible immediately, no interaction needed */}
          <div>
            <ProductPreview />
            <p style={{ fontSize: '0.72rem', color: C.textDis, marginTop: '0.625rem', textAlign: 'center' }}>
              LexBase Research interface — results ranked by relevance, every answer traceable to its source.
            </p>
          </div>
        </div>
      </section>

      <Divider />

      {/* ── NARRATIVE SLIDESHOW — 5-beat story ────────────────────────────── */}
      <section id="narrative" style={{ backgroundColor: C.bgSurf, padding: '5rem 1.5rem' }}>
        <div style={{ maxWidth: W, margin: '0 auto' }}>
          {/* Section intro — visible before any slide interaction */}
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: C.accent,
                      letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.625rem' }}>
            Why LexBase was built
          </p>
          <h2 style={{ fontSize: 'clamp(1.35rem, 3vw, 1.9rem)', fontWeight: 700, color: C.text,
                       lineHeight: 1.22, letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
            Not just what the product is — why a legal professional should care.
          </h2>
          <p style={{ fontSize: '0.92rem', color: C.textMut, lineHeight: 1.75,
                      maxWidth: 580, marginBottom: '2.5rem' }}>
            The five steps below walk through the problem, the gap, the solution, the evidence,
            and the next step. Use the sidebar or arrow keys to navigate at your own pace.
          </p>

          <NarrativeSlideshow onTry={goLogin} />
        </div>
      </section>

      <Divider />

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section id="how" style={{ backgroundColor: C.bg, padding: '5rem 1.5rem' }}>
        <div style={{ maxWidth: W, margin: '0 auto' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: C.accent,
                      letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.625rem' }}>
            The workflow
          </p>
          <h2 style={{ fontSize: 'clamp(1.35rem, 3vw, 1.9rem)', fontWeight: 700, color: C.text,
                       lineHeight: 1.22, letterSpacing: '-0.02em', marginBottom: '2.25rem' }}>
            Upload. Search. Review. Verify.
          </h2>

          <div style={{ display: 'grid', gap: '1px', backgroundColor: C.border,
                        borderRadius: '1rem', overflow: 'hidden', border: `1px solid ${C.border}` }}>
            {[
              { n: '01', icon: <Ico.file s={16} />, title: 'Upload PDF documents',
                desc: 'A Lawyer uploads one or more PDF files. LexBase extracts the text, splits it into passages, and indexes everything using a local embedding model — no external API involved in ingestion. Max 25 MB per file, 10 documents per firm. Scanned PDFs without extractable text are not supported.' },
              { n: '02', icon: <Ico.search s={16} />, title: 'Search with a question or phrase',
                desc: 'Any firm member enters a query. LexBase runs hybrid retrieval: PostgreSQL full-text search combined with vector cosine similarity, merged using Reciprocal Rank Fusion. Results are filtered by a minimum relevance score.' },
              { n: '03', icon: <Ico.link s={16} />, title: 'Review ranked passages',
                desc: 'Results appear as passage cards ranked by relevance. Each card shows the source document name, page number, extracted text, and a relevance score. A direct link opens the original PDF at the exact page.' },
              { n: '04', icon: <Ico.scale s={16} />, title: 'Verify — and apply your judgment',
                desc: 'Lawyers and Associates can request an AI summary. Every claim in the answer includes an [N] inline citation mapped to a specific retrieved passage. LexBase is a research aid — the professional applies their own judgment before relying on any result.' },
            ].map(({ n, icon, title, desc }) => (
              <div key={n} style={{ backgroundColor: C.bgSurf, padding: '1.25rem 1.5rem',
                                    display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ backgroundColor: C.accentBg, color: C.accent, width: 36, height: 36,
                              borderRadius: '0.6rem', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.67rem', fontWeight: 700, color: C.textDis }}>{n}</span>
                    <p style={{ fontSize: '0.9rem', fontWeight: 600, color: C.text, margin: 0 }}>{title}</p>
                  </div>
                  <p style={{ fontSize: '0.83rem', color: C.textMut, lineHeight: 1.7, margin: 0 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Divider />

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section id="features" style={{ backgroundColor: C.bgSurf, padding: '5rem 1.5rem' }}>
        <div style={{ maxWidth: W, margin: '0 auto' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: C.accent,
                      letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.625rem' }}>
            Capabilities
          </p>
          <h2 style={{ fontSize: 'clamp(1.35rem, 3vw, 1.9rem)', fontWeight: 700, color: C.text,
                       lineHeight: 1.22, letterSpacing: '-0.02em', marginBottom: '2.25rem' }}>
            What LexBase can do today.
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(255px, 1fr))', gap: '0.875rem' }}>
            {[
              { icon: <Ico.file s={17} />, title: 'PDF ingestion',
                desc: 'Upload PDFs up to 25 MB, max 10 per firm. Text extracted page-by-page using PyMuPDF. Scanned (image-only) PDFs are not supported.',
                tag: null },
              { icon: <Ico.search s={17} />, title: 'Hybrid search',
                desc: 'Full-text (tsvector/GIN) + vector cosine (pgvector/HNSW), fused via Reciprocal Rank Fusion. Finds passages relevant to the meaning of the query.',
                tag: null },
              { icon: <Ico.link s={17} />, title: 'Source-linked results',
                desc: 'Every passage card shows source filename and page. Click to open the original PDF at the exact page for independent verification.',
                tag: null },
              { icon: <Ico.scale s={17} />, title: 'AI summaries with citations',
                desc: 'Grounded AI summary via Groq. Every factual claim includes an inline [N] citation. Uncited answers are suppressed. Requires a Groq API key.',
                tag: 'Lawyer + Associate' },
              { icon: <Ico.users s={17} />, title: 'Role-based access',
                desc: "Lawyer: manages firm, uploads, manages team. Associate: search + generate. Paralegal: search + view. Each firm's data is isolated.",
                tag: null },
              { icon: <Ico.file s={17} />, title: 'Research history',
                desc: 'Every search session saved for 7 days — query, passage results, and AI answer. Return to a previous session without re-running the search.',
                tag: null },
            ].map(({ icon, title, desc, tag }) => (
              <div key={title} style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`,
                                        borderRadius: '0.875rem', padding: '1.125rem' }}>
                <div style={{ backgroundColor: C.accentBg, color: C.accent, width: 34, height: 34,
                              borderRadius: '0.55rem', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', marginBottom: '0.75rem' }}>{icon}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.3rem' }}>
                  <p style={{ fontSize: '0.88rem', fontWeight: 600, color: C.text, margin: 0 }}>{title}</p>
                  {tag && <Tag color={C.info} bg={C.infoBg}>{tag}</Tag>}
                </div>
                <p style={{ fontSize: '0.8rem', color: C.textMut, lineHeight: 1.65, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Divider />

      {/* ── TRUST ─────────────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: C.bg, padding: '5rem 1.5rem' }}>
        <div style={{ maxWidth: W, margin: '0 auto' }}>
          <div style={{ backgroundColor: C.bgSurf, border: `1px solid ${C.border}`,
                        borderRadius: '1rem', padding: '2.25rem' }}>
            <div style={{ backgroundColor: C.accentBg, color: C.accent, width: 40, height: 40,
                          borderRadius: '0.7rem', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', marginBottom: '1.125rem' }}>
              <Ico.scale s={20} />
            </div>
            <h2 style={{ fontSize: 'clamp(1.1rem, 2.2vw, 1.5rem)', fontWeight: 700, color: C.text,
                         lineHeight: 1.28, marginBottom: '0.875rem', maxWidth: 560 }}>
              An answer should be something a lawyer can examine — not something they must blindly trust.
            </h2>
            <p style={{ fontSize: '0.88rem', color: C.textMut, lineHeight: 1.78,
                        maxWidth: 600, marginBottom: '1.125rem' }}>
              LexBase does not generate answers from general knowledge. When you use Summarise with Sources,
              the response is grounded entirely in passages retrieved from your uploaded documents.
              Every factual claim carries an inline [N] citation. The original PDF is accessible at the
              exact source page for independent verification.
            </p>
            <div style={{ backgroundColor: C.goldBg, border: `1px solid #f0d9a8`,
                          borderRadius: '0.6rem', padding: '0.75rem 1rem', maxWidth: 600 }}>
              <p style={{ fontSize: '0.82rem', color: C.goldText, lineHeight: 1.65, margin: 0 }}>
                <strong>Important:</strong> LexBase is a research and retrieval tool, not a legal authority.
                Always verify conclusions against the original source documents and apply professional
                judgment before relying on any result in legal work.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Divider />

      {/* ── OPEN SOURCE ───────────────────────────────────────────────────── */}
      <section id="oss" style={{ backgroundColor: C.bgSurf, padding: '5rem 1.5rem' }}>
        <div style={{ maxWidth: W, margin: '0 auto',
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                      gap: '2.5rem', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: C.accent,
                        letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.625rem' }}>
              Open source
            </p>
            <h2 style={{ fontSize: 'clamp(1.35rem, 3vw, 1.9rem)', fontWeight: 700, color: C.text,
                         lineHeight: 1.22, letterSpacing: '-0.02em', marginBottom: '1rem' }}>
              Open source, available for inspection.
            </h2>
            <p style={{ fontSize: '0.88rem', color: C.textMut, lineHeight: 1.78, marginBottom: '1.375rem' }}>
              The full LexBase codebase is on GitHub — FastAPI backend, React 19 frontend,
              hybrid search pipeline, and document ingestion. Read the implementation,
              run it locally, open issues, or contribute.
            </p>
            <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
              <BtnGhost href={GITHUB_URL}><Ico.github s={15} /> View on GitHub</BtnGhost>
              <BtnGhost href={`${GITHUB_URL}#readme`}><Ico.file s={15} /> README</BtnGhost>
              <BtnGhost href={`${GITHUB_URL}/issues`}><Ico.link s={15} /> Issues</BtnGhost>
            </div>
          </div>

          <div style={{ backgroundColor: C.brand, borderRadius: '1rem', padding: '1.625rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem' }}>
              <div style={{ backgroundColor: C.gold, color: C.brand, width: 34, height: 34,
                            borderRadius: '0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ico.scale s={16} />
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff', margin: 0 }}>marehman-exe / Lexbase</p>
                <p style={{ color: C.n64, fontSize: '0.7rem', margin: 0 }}>github.com · MIT licence</p>
              </div>
            </div>
            {[
              { dot: C.accent, t: 'FastAPI + Python 3.12 backend'  },
              { dot: C.info,   t: 'React 19 + TypeScript frontend' },
              { dot: C.gold,   t: 'Hybrid vector + keyword search'  },
              { dot: C.error,  t: 'Groq / OpenRouter / Ollama LLM' },
            ].map(({ dot, t }) => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: dot,
                               flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontSize: '0.75rem', color: C.n94 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Divider />

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: C.bg, padding: '5rem 1.5rem' }}>
        <div style={{ maxWidth: W, margin: '0 auto',
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                      gap: '3rem', alignItems: 'start' }}>
          <div>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: C.accent,
                        letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.625rem' }}>
              FAQ
            </p>
            <h2 style={{ fontSize: 'clamp(1.35rem, 3vw, 1.9rem)', fontWeight: 700, color: C.text,
                         lineHeight: 1.22, letterSpacing: '-0.02em', marginBottom: '0.875rem' }}>
              Common questions.
            </h2>
            <p style={{ fontSize: '0.88rem', color: C.textMut, lineHeight: 1.78 }}>
              Further detail in the{' '}
              <a href={`${GITHUB_URL}#readme`} target="_blank" rel="noopener noreferrer"
                 style={{ color: C.accent, textDecoration: 'none', fontWeight: 600 }}>README</a>
              {' '}and the{' '}
              <a href={`${GITHUB_URL}/issues`} target="_blank" rel="noopener noreferrer"
                 style={{ color: C.accent, textDecoration: 'none', fontWeight: 600 }}>issue tracker</a>.
            </p>
          </div>
          <div>
            {[
              { q: 'What is LexBase?',
                a: 'An open-source legal document research tool. Upload PDFs, search for relevant passages using hybrid retrieval, and get AI-generated summaries grounded in those documents with inline citations.' },
              { q: 'Who is it designed for?',
                a: 'Lawyers, Associates, and Paralegals working with their own PDF documents. Lawyers manage the firm and document library. Associates can search and generate AI summaries. Paralegals can search and view documents.' },
              { q: 'What documents does it support?',
                a: 'PDF files with selectable, extractable text — up to 25 MB each, max 10 per firm. Scanned (image-only) PDFs are not supported; the system detects and rejects them.' },
              { q: 'How does it find relevant information?',
                a: 'Hybrid retrieval: PostgreSQL full-text search (tsvector/GIN) combined with vector cosine similarity (pgvector/HNSW), merged via Reciprocal Rank Fusion and filtered by a minimum relevance score.' },
              { q: 'Can I check the source behind an answer?',
                a: 'Yes. AI summaries include [N] inline citations mapped to specific retrieved passages. Each passage card links directly to the original PDF at the exact page.' },
              { q: 'Do I need an account?',
                a: 'Yes. There is no self-registration. A Super Admin creates Lawyer accounts through the admin panel. Follow the Quick Start in the README to set up the first account.' },
              { q: 'What should I verify before relying on an answer?',
                a: 'Click through to the cited source passage and read the surrounding context. Check that the passage actually supports the conclusion. Apply professional judgment — LexBase is a research aid, not a legal authority.' },
            ].map(f => <FAQ key={f.q} {...f} />)}
          </div>
        </div>
      </section>

      <Divider />

      {/* ── FINAL CTA ─────────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: C.brand, padding: '5.5rem 1.5rem' }}>
        <div style={{ maxWidth: 660, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.2rem)', fontWeight: 700, color: '#fff',
                       lineHeight: 1.2, letterSpacing: '-0.02em', marginBottom: '1rem' }}>
            Your legal documents already contain<br />the information you need.
          </h2>
          <p style={{ fontSize: '0.95rem', color: C.n94, lineHeight: 1.78, marginBottom: '2rem' }}>
            LexBase helps you find it, trace it to its source, and spend your time
            on legal analysis — not the search that precedes it.
          </p>
          <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <BtnPrimary onClick={goLogin} size="lg">Try LexBase</BtnPrimary>
            <BtnGhost href={GITHUB_URL} light size="lg"><Ico.github s={16} /> Explore the Repository</BtnGhost>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer style={{ backgroundColor: C.brand, borderTop: '1px solid rgba(255,255,255,0.08)',
                       padding: '1.75rem 1.5rem' }}>
        <div style={{ maxWidth: W, margin: '0 auto', display: 'flex', flexWrap: 'wrap',
                      alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <div style={{ backgroundColor: C.gold, color: C.brand, width: 26, height: 26,
                          borderRadius: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Ico.scale s={13} />
            </div>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem' }}>LexBase</span>
            <span style={{ color: C.n64, fontSize: '0.78rem' }}>· Legal document research</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.375rem', flexWrap: 'wrap' }}>
            {[
              { t: 'GitHub',        h: GITHUB_URL },
              { t: 'Documentation', h: `${GITHUB_URL}#readme` },
              { t: 'Issues',        h: `${GITHUB_URL}/issues` },
            ].map(({ t, h }) => (
              <a key={t} href={h} target="_blank" rel="noopener noreferrer"
                 style={{ color: C.n64, fontSize: '0.8rem', textDecoration: 'none', transition: 'color 0.15s' }}
                 onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = C.n94}
                 onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = C.n64}>
                {t}
              </a>
            ))}
          </div>
          <p style={{ color: C.n64, fontSize: '0.76rem', margin: 0 }}>
            MIT licence · © 2026 marehman-exe
          </p>
        </div>
      </footer>

      <style>{`
        .lx-nav-desk { display: flex !important; }
        .lx-nav-mob  { display: none  !important; }
        .lx-slideshow-grid   { grid-template-columns: auto 1fr; }
        .lx-beat-sidebar     { display: flex !important; }
        @media (max-width: 767px) {
          .lx-nav-desk { display: none  !important; }
          .lx-nav-mob  { display: flex  !important; }
        }
        @media (max-width: 639px) {
          .lx-slideshow-grid  { grid-template-columns: 1fr !important; }
          .lx-beat-sidebar    { display: none !important; }
        }
        button:focus-visible, a:focus-visible {
          outline: 2px solid #386641 !important; outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          * { transition: none !important; animation: none !important; }
        }
      `}</style>
    </div>
  )
}
