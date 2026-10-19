// WelcomePage.tsx — full redesign per spec
// Copy lives in CONTENT object at the top. Components below are typed and self-contained.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT — single source of truth for all copy
// ─────────────────────────────────────────────────────────────────────────────
const GITHUB_URL = 'https://github.com/marehman-exe/Lexbase'

const CONTENT = {
  nav: {
    links: [
      { label: 'How it works', href: '#how' },
      { label: 'Features',     href: '#features' },
      { label: 'Privacy',      href: '#privacy' },
      { label: 'FAQ',          href: '#faq' },
    ],
  },
  hero: {
    eyebrow: 'Private · Multi-tenant · Open source',
    h1a: 'Find the passage.',
    h1b: 'Trace it to its source.',
    body: 'LexBase searches your firm\'s PDF documents, ranks the most relevant passages, and links every result directly to the page it came from. No guessing. No unsupported answers.',
    cta1: 'Request access',
    cta2: 'See how it works',
    ctaNote: 'Accounts are created by your firm administrator. There is no public sign-up.',
    disclaimer: 'A research aid, not legal advice. Always verify against the source document.',
  },
  trust: [
    { icon: 'lock',    heading: 'Private to your firm',    body: 'Your documents are never shared across firms. Each workspace is strictly isolated.' },
    { icon: 'cite',    heading: 'Page-level citations',    body: 'Every result shows the document title and page number. Open the original PDF in one click.' },
    { icon: 'honest',  heading: 'Honest about gaps',       body: 'When nothing relevant is found, LexBase says so rather than generating an unsupported answer.' },
  ],
  why: {
    eyebrow: 'Why LexBase was built',
    heading: 'The problem, the gap, and the solution.',
    body: 'Five steps that explain why legal document search is harder than it looks, and how LexBase approaches it. Use the sidebar or arrow keys to move at your own pace.',
  },
  how: {
    eyebrow: 'The workflow',
    heading: 'Four steps from document to answer.',
    steps: [
      {
        n: '01', title: 'Upload your documents',
        body: 'A Lawyer uploads PDF files — statutes, judgments, commentaries, contracts. LexBase extracts and indexes the text. Scanned (image-only) PDFs are not supported.',
      },
      {
        n: '02', title: 'Ask a question or enter a phrase',
        body: 'Type a plain-English question or a legal reference such as "section 302" or "2023 SCMR 1011". LexBase runs hybrid retrieval — semantic and keyword — and returns the ten most relevant passages.',
      },
      {
        n: '03', title: 'Review ranked passages',
        body: 'Each result shows the source document, page number, and the passage text. Click to open the original PDF at the exact page.',
      },
      {
        n: '04', title: 'Summarise with citations (optional)',
        body: 'Lawyers and Associates can request a short answer built only from the retrieved passages. Every claim carries a numbered citation. If the passages do not support a claim, the system does not make it.',
      },
    ],
  },
  features: {
    eyebrow: 'Capabilities',
    heading: 'What LexBase does today.',
    items: [
      { title: 'PDF ingestion',              body: 'Upload PDFs up to 25 MB, max 10 per firm. Text extracted page-by-page. Scanned (image-only) PDFs are not supported.' },
      { title: 'Hybrid search',              body: 'Full-text keyword search combined with vector similarity search, fused via Reciprocal Rank Fusion. Finds passages relevant to the meaning of the query.' },
      { title: 'Page-level source links',    body: 'Every passage card shows the source filename and page number. Click to open the original PDF at the exact page.' },
      { title: 'Summary with citations',     body: 'A short answer built only from retrieved passages, with numbered inline citations. Uncited claims are suppressed. Requires Lawyer or Associate role.' },
      { title: 'Role-based access',          body: 'Lawyer manages the firm and uploads. Associate can search and summarise. Paralegal can search and view. Each firm\'s documents are fully isolated.' },
      { title: 'Research history',           body: 'Sessions are saved for seven days — query, results, and summary. Return to a previous session without re-running the search.' },
      { title: 'Query suggestions',          body: 'The search bar surfaces suggestions based on content already indexed for your firm.' },
      { title: 'Local embeddings',           body: 'Document embeddings are generated on your server using a local model. No document text is sent to a third party during indexing.' },
      { title: 'Honest no-result handling',  body: 'If no passage meets the relevance threshold, LexBase returns an empty result rather than fabricating an answer.' },
    ],
  },
  privacy: {
    eyebrow: 'Privacy and security',
    heading: 'Your documents stay within your firm.',
    intro: 'LexBase is designed for organisations that cannot share client documents with third-party services.',
    points: [
      { title: 'Per-firm isolation',         body: 'Every firm\'s documents, embeddings, and search history are stored separately. No cross-firm data access is possible.' },
      { title: 'Local embeddings',           body: 'The model that converts documents into vectors runs on your own server. Document text is not sent to any external API during indexing.' },
      { title: 'Minimal LLM exposure',       body: 'When you use Summary with citations, only the retrieved passages — not the full documents — are sent to the language model. You control which provider is configured.' },
      { title: 'Role-based access control',  body: 'Paralegals cannot use the summary feature. Access to documents is limited to members of the same firm.' },
      { title: 'No public sign-up',          body: 'Accounts are created by a firm administrator. There is no way for an outside party to register or access your workspace.' },
    ],
    note: 'LexBase does not claim any compliance certification. Review the source code and deployment configuration to assess suitability for your organisation.',
  },
  limits: {
    eyebrow: 'Limits, stated plainly',
    heading: 'What LexBase does not do.',
    items: [
      'English-language documents only.',
      'Digital-text PDFs only. Scanned or image-based PDFs are rejected.',
      'Document limit per firm is set by the operator (default: 10).',
      'Maximum 25 MB per file.',
      'The summary feature is not available to Paralegals.',
      'LexBase does not give legal advice and does not replace professional judgment.',
      'Retrieval quality depends on the clarity of the query and the content of the uploaded documents.',
    ],
  },
  faq: {
    eyebrow: 'FAQ',
    heading: 'Common questions.',
    items: [
      {
        q: 'Can I check the source behind an answer?',
        a: 'Yes. Every passage result shows the source document and page number. Click the result to open the original PDF at that page. When you use Summary with citations, each claim carries a numbered citation mapped to a specific passage.',
      },
      {
        q: 'Do I need an account?',
        a: 'Yes. There is no public sign-up. A firm administrator (Lawyer role) creates accounts for their team. To get access, contact your firm\'s administrator or follow the Quick Start in the README to set up the first account.',
      },
      {
        q: 'What should I verify before relying on an answer?',
        a: 'Open the cited source passage and read the surrounding context. Confirm that the passage actually supports the conclusion. LexBase is a research aid — apply professional judgment before using any result in legal work.',
      },
      {
        q: 'Where do my documents go?',
        a: 'Documents are stored on the server where LexBase is deployed. Embeddings are generated locally on that server. When you use Summary with citations, only the retrieved passages are sent to the configured language model — not the full documents.',
      },
      {
        q: 'What happens if the answer is not in my documents?',
        a: 'If no passage meets the relevance threshold, LexBase returns an empty result and says so. The summary feature will not generate an answer from general knowledge. You will not receive a confident-sounding answer that has no basis in your documents.',
      },
      {
        q: 'Who can use the summary feature?',
        a: 'Lawyers and Associates. Paralegals can search and view results but cannot request a summary.',
      },
      {
        q: 'What document types are supported?',
        a: 'Digital-text PDFs only — files where the text can be selected and copied. Scanned documents that are images inside a PDF are not supported and will be rejected during upload.',
      },
    ],
  },
  cta: {
    heading: 'Your documents already contain the answer.',
    body: 'LexBase helps you find it, trace it to its source, and spend your time on analysis — not the search that precedes it.',
    cta1: 'Request access',
    cta2: 'View the repository',
  },
  footer: {
    desc: 'Legal document research for law firms.',
    links: [
      { label: 'GitHub',         href: GITHUB_URL },
      { label: 'Documentation',  href: `${GITHUB_URL}#readme` },
      { label: 'Issues',         href: `${GITHUB_URL}/issues` },
    ],
    licence: 'MIT licence',
    credit: '[Your Name] · [Organisation]',
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS — mirrors index.css :root
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  brand:    '#0b1f33',
  brandHov: '#183c5e',
  accent:   '#386641',
  accentHov:'#2e5636',
  accentBg: '#e2eee4',
  accentTxt:'#2a5031',   // darker than C.accent — AA on white
  gold:     '#c58b2a',
  goldBg:   '#fff2d8',
  goldTxt:  '#6b4610',   // darker — AA on goldBg and on white
  text:     '#102a43',
  textSec:  '#34495e',
  textMut:  '#4a5568',   // was #667085 — lifted for AA on cream bg
  textDis:  '#6b7280',   // was #aab4ad — lifted for AA
  border:   '#d9ddd8',
  bg:       '#f5f3ee',
  bgSurf:   '#ffffff',
  bgSec:    '#f2f4f1',
  bgElev:   '#e8ede8',
  info:     '#1e3a5f',   // darker — AA on white
  infoBg:   '#dce6f0',
  error:    '#7a2d36',
  errorBg:  '#f4e9ea',
  n50:      '#f8fafc',
  n200:     '#e2e8f0',
  n400:     '#94a3b8',
  n500:     '#64748b',
  n700:     '#334155',   // AA on white
  navTxt:   '#c8d8e8',   // AA on brand navy
}

// ─────────────────────────────────────────────────────────────────────────────
// ICONS — inline SVG, 2px stroke, round caps/joins
// ─────────────────────────────────────────────────────────────────────────────
function IconScale({ s = 20 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v18M5 6l-2 8h4L5 6zM19 6l-2 8h4L19 6z"/><path d="M3 20h18"/>
    </svg>
  )
}
function IconSearch({ s = 18 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  )
}
function IconFile({ s = 18 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  )
}
function IconUsers({ s = 18 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}
function IconGithub({ s = 18 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  )
}
function IconMenu() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  )
}
function IconClose() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}
function IconChevLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  )
}
function IconChevRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  )
}
function IconLock({ s = 20 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}
function IconBookOpen({ s = 20 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  )
}
function IconCheckCircle({ s = 20 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  )
}
function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BUTTON PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────
interface BtnProps {
  children: React.ReactNode
  onClick?: () => void
  href?: string
  size?: 'sm' | 'md' | 'lg'
  light?: boolean    // ghost on dark bg
}

function BtnPrimary({ children, onClick, href, size = 'md' }: BtnProps) {
  const pad = size === 'lg' ? '0.875rem 2rem' : size === 'sm' ? '0.4rem 0.875rem' : '0.625rem 1.375rem'
  const fs  = size === 'lg' ? '1rem' : size === 'sm' ? '0.8rem' : '0.875rem'
  const base: React.CSSProperties = {
    backgroundColor: C.accent, color: '#fff', padding: pad,
    borderRadius: '0.625rem', fontWeight: 600, fontSize: fs, lineHeight: 1.4,
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    border: 'none', cursor: 'pointer', textDecoration: 'none',
    transition: 'background-color 0.15s', fontFamily: 'inherit',
  }
  const hov = (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.backgroundColor = C.accentHov }
  const out = (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.backgroundColor = C.accent }
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" style={base} onMouseEnter={hov} onMouseLeave={out}>{children}</a>
  return <button type="button" style={base} onClick={onClick} onMouseEnter={hov} onMouseLeave={out}>{children}</button>
}

function BtnGhost({ children, onClick, href, size = 'md', light = false }: BtnProps) {
  const pad = size === 'lg' ? '0.875rem 2rem' : size === 'sm' ? '0.4rem 0.875rem' : '0.625rem 1.375rem'
  const fs  = size === 'lg' ? '1rem' : size === 'sm' ? '0.8rem' : '0.875rem'
  // On light bg: text=#102a43 (AA on white/cream), border=#4a5568 (AA)
  // On dark bg (light=true): text=#c8d8e8 (AA on #0b1f33), border=rgba(200,216,232,0.4)
  const base: React.CSSProperties = {
    backgroundColor: 'transparent',
    color: light ? C.navTxt : C.text,
    border: `1.5px solid ${light ? 'rgba(200,216,232,0.4)' : C.textMut}`,
    padding: pad, borderRadius: '0.625rem', fontWeight: 600, fontSize: fs, lineHeight: 1.4,
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    cursor: 'pointer', textDecoration: 'none', transition: 'all 0.15s', fontFamily: 'inherit',
  }
  const hov = (e: React.MouseEvent) => {
    const el = e.currentTarget as HTMLElement
    if (light) { el.style.color = '#fff'; el.style.borderColor = 'rgba(200,216,232,0.8)' }
    else { el.style.borderColor = C.accent; el.style.color = C.accent; el.style.backgroundColor = C.accentBg }
  }
  const out = (e: React.MouseEvent) => {
    const el = e.currentTarget as HTMLElement
    if (light) { el.style.color = C.navTxt; el.style.borderColor = 'rgba(200,216,232,0.4)' }
    else { el.style.borderColor = C.textMut; el.style.color = C.text; el.style.backgroundColor = 'transparent' }
  }
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" style={base} onMouseEnter={hov} onMouseLeave={out}>{children}</a>
  return <button type="button" style={base} onClick={onClick} onMouseEnter={hov} onMouseLeave={out}>{children}</button>
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED LAYOUT HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function Divider() {
  return <hr style={{ border: 'none', borderTop: `1px solid ${C.border}`, margin: 0 }} />
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '0.7rem', fontWeight: 700, color: C.accentTxt,
                letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 0.625rem' }}>
      {children}
    </p>
  )
}

// Accessible tooltip — shown on hover/focus of the trigger element
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}
          onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
          onFocus={() => setShow(true)} onBlur={() => setShow(false)}>
      {children}
      {show && (
        <span role="tooltip"
              style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%',
                       transform: 'translateX(-50%)', whiteSpace: 'nowrap',
                       backgroundColor: C.brand, color: '#fff', fontSize: '0.72rem',
                       padding: '0.3rem 0.6rem', borderRadius: '0.35rem',
                       zIndex: 100, pointerEvents: 'none',
                       boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}>
          {text}
          <span style={{ position: 'absolute', top: '100%', left: '50%',
                         transform: 'translateX(-50%)', width: 0, height: 0,
                         borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
                         borderTop: `5px solid ${C.brand}` }} />
        </span>
      )}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO MOCKUP — realistic case data, qualitative match labels, Sample data tag
// ─────────────────────────────────────────────────────────────────────────────
const MATCH_LABELS: Record<string, { label: string; tip: string; color: string; bg: string }> = {
  strong: { label: 'Strong match', tip: 'This passage is closely relevant to your query.',       color: C.accentTxt, bg: C.accentBg },
  good:   { label: 'Good match',   tip: 'This passage is relevant but may need verification.',   color: C.goldTxt,   bg: C.goldBg  },
}

function HeroMockup() {
  const results = [
    {
      rank: '01', match: 'strong',
      doc: 'Sarfraz Ahmad v. Ishtiaq Ahmad', page: 3,
      text: 'The court held that the applicant failed to establish sufficient cause for the delay. No violation of natural justice was demonstrated on the facts.',
    },
    {
      rank: '02', match: 'good',
      doc: '2023 SCMR 1011', page: 7,
      text: 'Where the grounds for dismissal are contested, the burden of proof rests with the party seeking reinstatement under the relevant statutory provision.',
    },
  ]
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: '0.875rem',
                  overflow: 'hidden', boxShadow: '0 4px 24px rgba(11,31,51,0.10)' }}>
      {/* Window chrome */}
      <div style={{ backgroundColor: C.brand, padding: '0.5rem 0.875rem',
                    display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
        {['#ef4444','#f59e0b','#22c55e'].map(c => (
          <span key={c} aria-hidden="true"
                style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: c, display: 'inline-block' }} />
        ))}
        <span style={{ marginLeft: '0.5rem', color: C.navTxt, fontSize: '0.72rem' }}>LexBase · Legal Research</span>
        {/* Sample data label */}
        <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: C.n400,
                       backgroundColor: 'rgba(255,255,255,0.08)', padding: '0.15rem 0.5rem',
                       borderRadius: '999px' }}>
          Sample data
        </span>
      </div>
      {/* App shell */}
      <div style={{ display: 'flex', backgroundColor: C.bg }}>
        {/* Mini sidebar */}
        <div style={{ backgroundColor: C.brand, width: 44, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', padding: '0.75rem 0', gap: '1rem', flexShrink: 0 }}>
          <span style={{ color: C.gold }}><IconScale s={15} /></span>
          <span style={{ color: '#fff',  opacity: 0.9 }}><IconSearch s={13} /></span>
          <span style={{ color: C.n400 }}><IconFile s={13} /></span>
          <span style={{ color: C.n400 }}><IconUsers s={13} /></span>
        </div>
        {/* Main content */}
        <div style={{ flex: 1, padding: '0.875rem', overflow: 'hidden' }}>
          <p style={{ fontSize: '0.6rem', fontWeight: 700, color: C.textMut,
                      textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
            Legal Research
          </p>
          {/* Search bar */}
          <div style={{ backgroundColor: C.bgSurf, border: `1.5px solid ${C.gold}`,
                        borderRadius: '0.5rem', padding: '0.4rem 0.625rem',
                        display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.625rem',
                        boxShadow: `0 0 0 3px rgba(197,139,42,0.08)` }}>
            <span style={{ color: C.textMut, flexShrink: 0 }}><IconSearch s={12} /></span>
            <span style={{ fontSize: '0.72rem', color: C.text, flex: 1,
                           overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              What are the grounds for dismissal of this petition?
            </span>
            <span style={{ backgroundColor: C.accent, color: '#fff', borderRadius: '0.3rem',
                           padding: '0.175rem 0.5rem', fontSize: '0.62rem', fontWeight: 600, flexShrink: 0 }}>
              Search
            </span>
          </div>
          {/* Results */}
          {results.map(({ rank, match, doc, page, text }) => {
            const m = MATCH_LABELS[match]
            return (
              <div key={rank} style={{ backgroundColor: C.bgSurf, border: `1px solid ${C.border}`,
                                       borderRadius: '0.5rem', padding: '0.5rem 0.625rem',
                                       marginBottom: '0.375rem', display: 'flex', gap: '0.4rem' }}>
                <div style={{ backgroundColor: match === 'strong' ? C.accentBg : C.infoBg,
                              color: match === 'strong' ? C.accentTxt : C.info,
                              width: 22, height: 22, borderRadius: '0.3rem', flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.58rem', fontWeight: 700 }}>
                  {rank}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.2rem',
                                alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Qualitative match label with accessible tooltip */}
                    <Tooltip text={m.tip}>
                      <span tabIndex={0} style={{ fontSize: '0.6rem', fontWeight: 700, color: m.color,
                                  backgroundColor: m.bg, borderRadius: '999px',
                                  padding: '0.1rem 0.45rem', cursor: 'default',
                                  outline: 'none' }}>
                        {m.label}
                      </span>
                    </Tooltip>
                    <span style={{ fontSize: '0.6rem', color: C.textDis, marginLeft: 'auto',
                                   overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                   maxWidth: '60%' }}>
                      {doc} · p.{page}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.68rem', color: C.textSec, lineHeight: 1.45, margin: 0,
                               overflow: 'hidden', display: '-webkit-box',
                               WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {text}
                  </p>
                </div>
              </div>
            )
          })}
          {/* Summary strip */}
          <div style={{ backgroundColor: C.bgElev, border: `1px solid ${C.accentBg}`,
                        borderRadius: '0.5rem', padding: '0.4rem 0.625rem',
                        display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.64rem', color: C.accentTxt, fontWeight: 600 }}>
              Summary with citations
            </span>
            <span style={{ fontSize: '0.6rem', color: C.textMut, marginLeft: 'auto' }}>
              inline citations · verify before use
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDESHOW — 5-beat narrative (Why built section)
// ─────────────────────────────────────────────────────────────────────────────
function CitationVisual() {
  return (
    <div style={{ backgroundColor: C.bgSurf, borderRadius: '0.75rem',
                  border: `1px solid ${C.border}`, padding: '1rem' }}>
      <p style={{ fontSize: '0.65rem', fontWeight: 700, color: C.textMut,
                  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.625rem' }}>
        Summary with citations
      </p>
      <div style={{ backgroundColor: C.bgSec, borderRadius: '0.45rem', padding: '0.75rem',
                    border: `1px solid ${C.border}`, marginBottom: '0.5rem' }}>
        <p style={{ fontSize: '0.72rem', color: C.textSec, lineHeight: 1.65, margin: 0 }}>
          The petition was dismissed as the applicant failed to establish sufficient cause{' '}
          <span style={{ backgroundColor: C.gold, color: C.brand, borderRadius: '0.25rem',
                         padding: '0.05rem 0.3rem', fontSize: '0.6rem', fontWeight: 700 }}>[1]</span>
          {' '}and no violation of natural justice was found on the facts{' '}
          <span style={{ backgroundColor: C.gold, color: C.brand, borderRadius: '0.25rem',
                         padding: '0.05rem 0.3rem', fontSize: '0.6rem', fontWeight: 700 }}>[2]</span>.
        </p>
      </div>
      <div style={{ padding: '0.5rem 0.625rem', backgroundColor: C.bgSurf,
                    border: `1px solid ${C.border}`, borderRadius: '0.45rem' }}>
        <p style={{ fontSize: '0.6rem', fontWeight: 700, color: C.textMut,
                    textTransform: 'uppercase', margin: '0 0 0.25rem' }}>Sources</p>
        {['[1] Sarfraz Ahmad v. Ishtiaq Ahmad, p.3', '[2] 2023 SCMR 1011, p.7'].map(s => (
          <p key={s} style={{ fontSize: '0.68rem', color: C.accentTxt, margin: '0 0 0.1rem',
                              textDecoration: 'underline' }}>{s}</p>
        ))}
      </div>
    </div>
  )
}

function ContextVisual() {
  return (
    <div style={{ backgroundColor: C.bgSurf, borderRadius: '0.75rem',
                  border: `1px solid ${C.border}`, padding: '1rem' }}>
      <p style={{ fontSize: '0.65rem', fontWeight: 700, color: C.textMut,
                  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.625rem' }}>
        Finding a passage vs. finding an answer
      </p>
      {[
        { label: 'Ctrl+F', q: '"grounds for dismissal"',          hit: '0 exact matches',    ok: false },
        { label: 'LexBase', q: 'What are the grounds for dismissal?', hit: '3 relevant passages', ok: true  },
      ].map(({ label, q, hit, ok }) => (
        <div key={label} style={{ padding: '0.625rem', borderRadius: '0.4rem', marginBottom: '0.4rem',
                                  backgroundColor: ok ? C.bgElev : C.bgSec,
                                  border: `1px solid ${ok ? '#b8d4bc' : C.border}` }}>
          <p style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.05em', margin: '0 0 0.25rem',
                      color: ok ? C.accentTxt : C.textMut }}>{label}</p>
          <p style={{ fontSize: '0.72rem', color: C.textSec, margin: '0 0 0.25rem',
                      fontStyle: 'italic' }}>"{q}"</p>
          <p style={{ fontSize: '0.68rem', fontWeight: 600, margin: 0,
                      color: ok ? C.accentTxt : C.error }}>{ok ? 'Found' : 'No match'} — {hit}</p>
        </div>
      ))}
    </div>
  )
}

function DocumentQueueVisual() {
  return (
    <div style={{ backgroundColor: C.bgSurf, borderRadius: '0.75rem',
                  border: `1px solid ${C.border}`, padding: '1rem' }}>
      <p style={{ fontSize: '0.65rem', fontWeight: 700, color: C.textMut,
                  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.625rem' }}>
        Manual document search
      </p>
      {[
        { name: 'CR.P 521 2024.pdf',    pages: 42, active: true  },
        { name: 'Order April 2024.pdf', pages: 18, active: false },
        { name: 'Petition 2023.pdf',    pages: 67, active: false },
      ].map(({ name, pages, active }) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem',
                                 padding: '0.4rem 0.5rem', borderRadius: '0.375rem', marginBottom: '0.25rem',
                                 backgroundColor: active ? C.bgElev : 'transparent',
                                 border: `1px solid ${active ? '#b8d4bc' : C.border}` }}>
          <span style={{ color: active ? C.accentTxt : C.textDis, flexShrink: 0 }}><IconFile s={13} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.68rem', fontWeight: 600, color: C.text, margin: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
            <p style={{ fontSize: '0.6rem', color: C.textMut, margin: 0 }}>{pages} pages</p>
          </div>
          <span style={{ fontSize: '0.6rem', fontWeight: 700,
                         color: active ? C.accentTxt : C.textDis,
                         backgroundColor: active ? C.accentBg : C.bgSec,
                         borderRadius: '999px', padding: '0.1rem 0.4rem', flexShrink: 0 }}>
            {active ? 'Searching' : 'Queued'}
          </span>
        </div>
      ))}
      <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.5rem', backgroundColor: C.goldBg,
                    borderRadius: '0.375rem', border: `1px solid #e8d09a` }}>
        <p style={{ fontSize: '0.64rem', color: C.goldTxt, margin: 0 }}>
          Estimated 25–40 minutes to search 3 documents manually
        </p>
      </div>
    </div>
  )
}

function RepoVisual({ onAccess }: { onAccess: () => void }) {
  return (
    <div style={{ backgroundColor: C.brand, borderRadius: '0.75rem', padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
        <div style={{ backgroundColor: C.gold, color: C.brand, width: 30, height: 30, borderRadius: '0.45rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconScale s={15} />
        </div>
        <div>
          <p style={{ fontWeight: 700, fontSize: '0.8rem', color: '#fff', margin: 0 }}>marehman-exe / Lexbase</p>
          <p style={{ color: C.n400, fontSize: '0.68rem', margin: 0 }}>github.com · MIT licence</p>
        </div>
      </div>
      {[
        { dot: C.accent,    t: 'FastAPI + Python 3.12 backend'  },
        { dot: '#60a5fa',   t: 'React 19 + TypeScript frontend' },
        { dot: C.gold,      t: 'Hybrid vector + keyword search' },
        { dot: '#f87171',   t: 'Pluggable LLM provider'         },
      ].map(({ dot, t }) => (
        <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: dot,
                         display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: '0.72rem', color: C.navTxt }}>{t}</span>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
        <BtnPrimary size="sm" onClick={onAccess}>Request access</BtnPrimary>
        <BtnGhost size="sm" light href={GITHUB_URL}><IconGithub s={12} /> View source</BtnGhost>
      </div>
    </div>
  )
}

interface Beat {
  n:      string
  label:  string
  h:      string
  sub:    string
  body:   string
  visual: (onAccess: () => void) => React.ReactNode
}

const BEATS: Beat[] = [
  {
    n: '01', label: 'The problem',
    h:    'Legal information is buried in lengthy documents.',
    sub:  'Manual searching costs time that should go to legal analysis.',
    body: 'Finding the passage that answers a specific legal question often means opening each PDF, scanning pages, and repeating across multiple files under time pressure. The information is there — locating it efficiently is the problem.',
    visual: () => <DocumentQueueVisual />,
  },
  {
    n: '02', label: 'The gap',
    h:    'Finding a passage is not the same as finding a supported answer.',
    sub:  'Keywords match words. Legal questions have meaning.',
    body: 'A Ctrl+F search finds exact text, not relevance. A question about "grounds for dismissal" may be answered by a passage that describes the reasoning without using those words. Even when a passage is found, you still need to verify it supports the question.',
    visual: () => <ContextVisual />,
  },
  {
    n: '03', label: 'The solution',
    h:    'LexBase finds relevant passages and links every result to its source.',
    sub:  'Hybrid search. Ranked results. Every result traceable.',
    body: 'Upload your PDFs. Search using a question or a legal reference. LexBase combines keyword and semantic search, ranks passages by relevance, and shows the document title and page number on every result. Open the original PDF at the exact page in one click.',
    visual: () => <HeroMockup />,
  },
  {
    n: '04', label: 'The proof',
    h:    'Every summary in LexBase has a traceable source.',
    sub:  'Inline citations. Original PDF access. No unsupported claims.',
    body: 'When you use Summary with citations, the answer includes numbered inline citations. Each [N] maps to a specific retrieved passage. If a claim cannot be supported by the passages, the system does not make it. The answer is a starting point for judgment — not a replacement for it.',
    visual: () => <CitationVisual />,
  },
  {
    n: '05', label: 'Next steps',
    h:    'Request access, or read the source code first.',
    sub:  'Open source · MIT licence · github.com/marehman-exe/Lexbase',
    body: 'LexBase is publicly available on GitHub — the full backend, frontend, search pipeline, and document ingestion are all in the open. Request access through your firm administrator, or review the implementation before committing.',
    visual: (onAccess) => <RepoVisual onAccess={onAccess} />,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// NARRATIVE SLIDESHOW
// ─────────────────────────────────────────────────────────────────────────────
function NarrativeSlideshow({ onAccess }: { onAccess: () => void }) {
  const [cur, setCur]         = useState(0)
  const [prefRed, setPrefRed] = useState(false)
  const [visible, setVisible] = useState(true)
  const timerRef              = useRef<ReturnType<typeof setInterval> | null>(null)
  const [playing, setPlaying] = useState(false)
  const pendingRef            = useRef<ReturnType<typeof setTimeout> | null>(null)
  const count                 = BEATS.length

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefRed(mq.matches)
    const h = (e: MediaQueryListEvent) => setPrefRed(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])

  const go = useCallback((i: number) => {
    const target = ((i % count) + count) % count
    if (pendingRef.current) clearTimeout(pendingRef.current)
    if (prefRed) { setCur(target); setVisible(true); return }
    setVisible(false)
    pendingRef.current = setTimeout(() => {
      setCur(target); setVisible(true); pendingRef.current = null
    }, 180)
  }, [count, prefRed])

  const prev = useCallback(() => { go(cur - 1); setPlaying(false) }, [cur, go])
  const next = useCallback(() => { go(cur + 1); setPlaying(false) }, [cur, go])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (playing && !prefRed) {
      timerRef.current = setInterval(() => {
        setCur(c => { setVisible(false); setTimeout(() => setVisible(true), 180); return (c + 1) % count })
      }, 8000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [playing, prefRed, count])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [prev, next])

  useEffect(() => () => { if (pendingRef.current) clearTimeout(pendingRef.current) }, [])

  const beat = BEATS[cur]

  return (
    <div>
      <div className="lx-slideshow-grid" style={{ display: 'grid', gap: '0 2.5rem' }}>
        {/* Beat sidebar */}
        <nav aria-label="Story steps" className="lx-beat-sidebar"
             style={{ display: 'flex', flexDirection: 'column', paddingRight: '2rem',
                      borderRight: `1px solid ${C.border}`, gap: 0 }}>
          {BEATS.map((b, i) => (
            <button key={b.n} type="button"
                    onClick={() => { go(i); setPlaying(false) }}
                    aria-label={`${b.n} ${b.label}`}
                    aria-pressed={i === cur}
                    style={{ background: 'none', border: 'none', cursor: 'pointer',
                             padding: '0.75rem 0 0.75rem 0.875rem', textAlign: 'left',
                             fontFamily: 'inherit',
                             borderLeft: `2px solid ${i === cur ? C.accent : 'transparent'}`,
                             borderBottom: i < count - 1 ? `1px solid ${C.border}` : 'none',
                             transition: 'border-color 0.2s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700,
                               color: i === cur ? C.accentTxt : C.textDis,
                               backgroundColor: i === cur ? C.accentBg : C.bgSec,
                               width: 24, height: 24, borderRadius: '50%',
                               display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                               transition: 'all 0.2s', flexShrink: 0 }}>
                  {b.n}
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: i === cur ? 600 : 400,
                               color: i === cur ? C.text : C.textMut, transition: 'color 0.2s' }}>
                  {b.label}
                </span>
              </div>
            </button>
          ))}
        </nav>

        {/* Slide content */}
        <div style={{ opacity: visible ? 1 : 0,
                      transition: prefRed ? 'none' : 'opacity 0.18s ease',
                      minHeight: 380 }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, color: C.accentTxt,
                      letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 0.5rem' }}>
            {beat.n} · {beat.label}
          </p>
          <h3 style={{ fontSize: 'clamp(1.05rem, 2.2vw, 1.4rem)', fontWeight: 700, color: C.text,
                       lineHeight: 1.25, letterSpacing: '-0.015em', margin: '0 0 0.35rem' }}>
            {beat.h}
          </h3>
          <p style={{ fontSize: '0.85rem', fontWeight: 500, color: C.accentTxt, margin: '0 0 1rem' }}>
            {beat.sub}
          </p>
          <div className="lx-beat-content" style={{ display: 'grid', gap: '1.5rem', alignItems: 'start' }}>
            <div>
              <p style={{ fontSize: '0.875rem', color: C.textMut, lineHeight: 1.78, margin: 0 }}>
                {beat.body}
              </p>
              {cur === count - 1 && (
                <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
                  <BtnPrimary onClick={onAccess} size="md">Request access</BtnPrimary>
                </div>
              )}
            </div>
            <div style={{ minWidth: 0 }}>{beat.visual(onAccess)}</div>
          </div>

          {/* Nav controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem',
                        marginTop: '1.5rem', paddingTop: '1rem', borderTop: `1px solid ${C.border}` }}>
            <button type="button" onClick={prev} aria-label="Previous step"
                    style={{ background: C.bgSec, border: `1px solid ${C.border}`, borderRadius: '0.4rem',
                             padding: '0.4rem', cursor: 'pointer', display: 'flex',
                             alignItems: 'center', color: C.text, fontFamily: 'inherit' }}>
              <IconChevLeft />
            </button>
            <div role="tablist" aria-label="Steps"
                 style={{ display: 'flex', gap: '0.3rem', flex: 1, justifyContent: 'center' }}>
              {BEATS.map((b, i) => (
                <button key={b.n} type="button" role="tab"
                        onClick={() => { go(i); setPlaying(false) }}
                        aria-label={`${b.n} ${b.label}`}
                        aria-selected={i === cur}
                        style={{ width: i === cur ? 20 : 6, height: 6, borderRadius: '999px',
                                 backgroundColor: i === cur ? C.accent : C.border,
                                 border: 'none', cursor: 'pointer', padding: 0,
                                 transition: prefRed ? 'none' : 'width 0.2s, background-color 0.2s' }} />
              ))}
            </div>
            <button type="button" onClick={next} aria-label="Next step"
                    style={{ background: C.bgSec, border: `1px solid ${C.border}`, borderRadius: '0.4rem',
                             padding: '0.4rem', cursor: 'pointer', display: 'flex',
                             alignItems: 'center', color: C.text, fontFamily: 'inherit' }}>
              <IconChevRight />
            </button>
            <button type="button" onClick={() => setPlaying(p => !p)}
                    aria-label={playing ? 'Pause auto-advance' : 'Start auto-advance'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer',
                             fontSize: '0.72rem', color: C.textMut, fontFamily: 'inherit',
                             padding: '0.4rem 0.5rem' }}>
              {playing ? 'Pause' : 'Play'}
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

// ─────────────────────────────────────────────────────────────────────────────
// FAQ ACCORDION ITEM
// ─────────────────────────────────────────────────────────────────────────────
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  const id = `faq-${q.slice(0, 20).replace(/\s+/g, '-').toLowerCase()}`
  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <button type="button" id={`${id}-btn`}
              aria-expanded={open} aria-controls={`${id}-panel`}
              onClick={() => setOpen(o => !o)}
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                       padding: '0.875rem 0', display: 'flex', alignItems: 'center',
                       justifyContent: 'space-between', gap: '1rem',
                       fontFamily: 'inherit', textAlign: 'left' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: C.text, flex: 1 }}>{q}</span>
        <span aria-hidden="true"
              style={{ color: C.accentTxt, flexShrink: 0, transition: 'transform 0.2s',
                       transform: open ? 'rotate(45deg)' : 'none', display: 'flex' }}>
          <IconPlus />
        </span>
      </button>
      <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-btn`}
           style={{ overflow: 'hidden', maxHeight: open ? '20rem' : 0,
                    transition: 'max-height 0.22s ease',
                    visibility: open ? 'visible' : 'hidden' }}>
        <p style={{ fontSize: '0.875rem', color: C.textMut, lineHeight: 1.75,
                    margin: 0, paddingBottom: '0.875rem' }}>{a}</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE ROOT
// ─────────────────────────────────────────────────────────────────────────────
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

  const trustIcons: Record<string, React.ReactNode> = {
    lock:   <IconLock s={20} />,
    cite:   <IconBookOpen s={20} />,
    honest: <IconCheckCircle s={20} />,
  }

  return (
    <div style={{ fontFamily: '"DM Sans", system-ui, sans-serif',
                  backgroundColor: C.bg, color: C.text, overflowX: 'hidden' }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50,
                       backgroundColor: C.brand, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="lx-px lx-inner"
             style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <a href="/" aria-label="LexBase home"
             style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', textDecoration: 'none' }}>
            <div style={{ backgroundColor: C.gold, color: C.brand, width: 30, height: 30,
                          borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconScale s={15} />
            </div>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '-0.01em' }}>
              LexBase
            </span>
          </a>

          {/* Desktop nav */}
          <nav aria-label="Site navigation" className="lx-nav-desk"
               style={{ display: 'flex', alignItems: 'center', gap: '0.1rem' }}>
            {CONTENT.nav.links.map(({ label, href }) => (
              <a key={label} href={href}
                 style={{ color: C.navTxt, fontSize: '0.83rem', fontWeight: 500,
                          padding: '0.375rem 0.625rem', borderRadius: '0.4rem',
                          textDecoration: 'none', transition: 'color 0.15s' }}
                 onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff' }}
                 onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.navTxt }}>
                {label}
              </a>
            ))}
            <button type="button" onClick={goLogin}
                    style={{ marginLeft: '0.375rem', backgroundColor: C.accent, color: '#fff',
                             border: 'none', borderRadius: '0.5rem', padding: '0.4rem 0.875rem',
                             fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer',
                             transition: 'background-color 0.15s', fontFamily: 'inherit' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = C.accentHov }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = C.accent }}>
              Log in
            </button>
          </nav>

          {/* Mobile burger */}
          <button type="button" onClick={() => setMenuOpen(v => !v)}
                  aria-label="Toggle navigation" aria-expanded={menuOpen}
                  className="lx-nav-mob"
                  style={{ background: 'none', border: 'none', color: C.navTxt,
                           cursor: 'pointer', padding: 4, display: 'none' }}>
            {menuOpen ? <IconClose /> : <IconMenu />}
          </button>
        </div>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="lx-px"
               style={{ backgroundColor: C.brand, borderTop: '1px solid rgba(255,255,255,0.08)',
                        paddingTop: '1rem', paddingBottom: '1.5rem' }}>
            {CONTENT.nav.links.map(({ label, href }) => (
              <a key={label} href={href} onClick={() => setMenuOpen(false)}
                 style={{ display: 'block', color: C.navTxt, padding: '0.7rem 0',
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                          textDecoration: 'none', fontSize: '0.92rem', fontWeight: 500 }}>
                {label}
              </a>
            ))}
            <button type="button" onClick={() => { setMenuOpen(false); goLogin() }}
                    style={{ marginTop: '0.875rem', width: '100%', backgroundColor: C.accent,
                             color: '#fff', border: 'none', borderRadius: '0.625rem', padding: '0.75rem',
                             fontSize: '0.92rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Log in
            </button>
          </div>
        )}
      </header>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section aria-label="Introduction"
               className="lx-px" style={{ backgroundColor: C.bg, paddingTop: '4rem', paddingBottom: '3rem' }}>
        <div className="lx-inner lx-hero-grid">
          {/* Left */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                          backgroundColor: C.accentBg, color: C.accentTxt, borderRadius: '999px',
                          padding: '0.25rem 0.75rem', fontSize: '0.7rem', fontWeight: 600,
                          marginBottom: '1.5rem', border: `1px solid #b8d4bc` }}>
              <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: '50%',
                         backgroundColor: C.accent, display: 'inline-block' }} />
              {CONTENT.hero.eyebrow}
            </div>

            <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 700, color: C.text,
                         lineHeight: 1.15, letterSpacing: '-0.025em', margin: '0 0 1.125rem' }}>
              {CONTENT.hero.h1a}<br />{CONTENT.hero.h1b}
            </h1>

            <p style={{ fontSize: '1rem', color: C.textMut, lineHeight: 1.75,
                        maxWidth: 480, marginBottom: '1.75rem' }}>
              {CONTENT.hero.body}
            </p>

            <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', marginBottom: '0.875rem' }}>
              <BtnPrimary onClick={goLogin} size="lg">{CONTENT.hero.cta1}</BtnPrimary>
              <BtnGhost href="#how" size="lg">{CONTENT.hero.cta2}</BtnGhost>
            </div>

            <p style={{ fontSize: '0.78rem', color: C.textDis, marginBottom: '1.25rem' }}>
              {CONTENT.hero.ctaNote}
            </p>

            {/* Disclaimer */}
            <div style={{ display: 'inline-flex', alignItems: 'flex-start', gap: '0.5rem',
                          backgroundColor: C.goldBg, border: `1px solid #e5cc88`,
                          borderRadius: '0.5rem', padding: '0.5rem 0.75rem', maxWidth: 480 }}>
              <span aria-hidden="true" style={{ fontSize: '0.8rem', lineHeight: 1.5 }}>⚠</span>
              <p style={{ fontSize: '0.78rem', color: C.goldTxt, lineHeight: 1.5, margin: 0 }}>
                {CONTENT.hero.disclaimer}
              </p>
            </div>
          </div>

          {/* Right: mockup */}
          <div style={{ minWidth: 0 }}>
            <HeroMockup />
          </div>
        </div>
      </section>

      <Divider />

      {/* ── TRUST STRIP ────────────────────────────────────────────────────── */}
      <section aria-label="Key guarantees"
               className="lx-px" style={{ backgroundColor: C.bgSurf, paddingTop: '2.5rem', paddingBottom: '2.5rem' }}>
        <div className="lx-inner lx-trust-grid">
          {CONTENT.trust.map(({ icon, heading, body }) => (
            <div key={heading} style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
              <div style={{ backgroundColor: C.accentBg, color: C.accentTxt, width: 36, height: 36,
                            borderRadius: '0.5rem', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', flexShrink: 0 }}>
                {trustIcons[icon]}
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: 700, color: C.text, margin: '0 0 0.25rem' }}>
                  {heading}
                </p>
                <p style={{ fontSize: '0.825rem', color: C.textMut, lineHeight: 1.6, margin: 0 }}>
                  {body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Divider />

      {/* ── WHY BUILT (SLIDESHOW) ───────────────────────────────────────────── */}
      <section id="narrative" aria-label="Why LexBase was built"
               className="lx-px" style={{ backgroundColor: C.bg, paddingTop: '4rem', paddingBottom: '4rem' }}>
        <div className="lx-inner">
          <Eyebrow>{CONTENT.why.eyebrow}</Eyebrow>
          <h2 style={{ fontSize: 'clamp(1.35rem, 3vw, 1.9rem)', fontWeight: 700, color: C.text,
                       lineHeight: 1.22, letterSpacing: '-0.02em', margin: '0 0 0.625rem' }}>
            {CONTENT.why.heading}
          </h2>
          <p style={{ fontSize: '0.9rem', color: C.textMut, lineHeight: 1.72,
                      maxWidth: 560, margin: '0 0 2.5rem' }}>
            {CONTENT.why.body}
          </p>
          <NarrativeSlideshow onAccess={goLogin} />
        </div>
      </section>

      <Divider />

      {/* ── HOW IT WORKS ───────────────────────────────────────────────────── */}
      <section id="how" aria-label="How LexBase works"
               className="lx-px" style={{ backgroundColor: C.bgSurf, paddingTop: '4rem', paddingBottom: '4rem' }}>
        <div className="lx-inner">
          <Eyebrow>{CONTENT.how.eyebrow}</Eyebrow>
          <h2 style={{ fontSize: 'clamp(1.35rem, 3vw, 1.9rem)', fontWeight: 700, color: C.text,
                       lineHeight: 1.22, letterSpacing: '-0.02em', margin: '0 0 2.25rem' }}>
            {CONTENT.how.heading}
          </h2>
          <div style={{ display: 'grid', gap: '1px', backgroundColor: C.border,
                        borderRadius: '0.875rem', overflow: 'hidden', border: `1px solid ${C.border}` }}>
            {CONTENT.how.steps.map(({ n, title, body }) => (
              <div key={n} style={{ backgroundColor: C.bgSurf, padding: '1.25rem 1.5rem',
                                    display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ backgroundColor: C.accentBg, color: C.accentTxt, width: 34, height: 34,
                              borderRadius: '0.5rem', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', flexShrink: 0, fontSize: '0.72rem', fontWeight: 700 }}>
                  {n}
                </div>
                <div>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600, color: C.text, margin: '0 0 0.3rem' }}>
                    {title}
                  </p>
                  <p style={{ fontSize: '0.84rem', color: C.textMut, lineHeight: 1.7, margin: 0 }}>
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Divider />

      {/* ── FEATURES ───────────────────────────────────────────────────────── */}
      <section id="features" aria-label="Features"
               className="lx-px" style={{ backgroundColor: C.bg, paddingTop: '4rem', paddingBottom: '4rem' }}>
        <div className="lx-inner">
          <Eyebrow>{CONTENT.features.eyebrow}</Eyebrow>
          <h2 style={{ fontSize: 'clamp(1.35rem, 3vw, 1.9rem)', fontWeight: 700, color: C.text,
                       lineHeight: 1.22, letterSpacing: '-0.02em', margin: '0 0 2.25rem' }}>
            {CONTENT.features.heading}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                        gap: '0.875rem' }}>
            {CONTENT.features.items.map(({ title, body }) => (
              <div key={title} style={{ backgroundColor: C.bgSurf, border: `1px solid ${C.border}`,
                                        borderRadius: '0.75rem', padding: '1.125rem' }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: C.text,
                            margin: '0 0 0.375rem' }}>{title}</p>
                <p style={{ fontSize: '0.8rem', color: C.textMut, lineHeight: 1.65, margin: 0 }}>
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Divider />

      {/* ── PRIVACY ────────────────────────────────────────────────────────── */}
      <section id="privacy" aria-label="Privacy and security"
               className="lx-px" style={{ backgroundColor: C.bgSurf, paddingTop: '4rem', paddingBottom: '4rem' }}>
        <div className="lx-inner lx-privacy-grid">
          <div>
            <Eyebrow>{CONTENT.privacy.eyebrow}</Eyebrow>
            <h2 style={{ fontSize: 'clamp(1.35rem, 3vw, 1.9rem)', fontWeight: 700, color: C.text,
                         lineHeight: 1.22, letterSpacing: '-0.02em', margin: '0 0 0.875rem' }}>
              {CONTENT.privacy.heading}
            </h2>
            <p style={{ fontSize: '0.9rem', color: C.textMut, lineHeight: 1.72,
                        margin: '0 0 1.5rem' }}>
              {CONTENT.privacy.intro}
            </p>
            <div style={{ backgroundColor: C.goldBg, border: `1px solid #e5cc88`,
                          borderRadius: '0.5rem', padding: '0.75rem 1rem' }}>
              <p style={{ fontSize: '0.8rem', color: C.goldTxt, lineHeight: 1.65, margin: 0 }}>
                {CONTENT.privacy.note}
              </p>
            </div>
          </div>
          <div>
            {CONTENT.privacy.points.map(({ title, body }) => (
              <div key={title} style={{ paddingTop: '1rem', paddingBottom: '1rem',
                                        borderBottom: `1px solid ${C.border}` }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: C.text,
                            margin: '0 0 0.25rem' }}>{title}</p>
                <p style={{ fontSize: '0.84rem', color: C.textMut, lineHeight: 1.65, margin: 0 }}>
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Divider />

      {/* ── LIMITS ─────────────────────────────────────────────────────────── */}
      <section aria-label="Limits"
               className="lx-px" style={{ backgroundColor: C.bg, paddingTop: '4rem', paddingBottom: '4rem' }}>
        <div className="lx-inner" style={{ maxWidth: 680 }}>
          <Eyebrow>{CONTENT.limits.eyebrow}</Eyebrow>
          <h2 style={{ fontSize: 'clamp(1.35rem, 3vw, 1.9rem)', fontWeight: 700, color: C.text,
                       lineHeight: 1.22, letterSpacing: '-0.02em', margin: '0 0 1.5rem' }}>
            {CONTENT.limits.heading}
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {CONTENT.limits.items.map((item) => (
              <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                                      padding: '0.75rem 0', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ color: C.accentTxt, flexShrink: 0, marginTop: '0.1rem' }}>
                  <IconCheckCircle s={15} />
                </span>
                <span style={{ fontSize: '0.875rem', color: C.textSec, lineHeight: 1.65 }}>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Divider />

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <section id="faq" aria-label="Frequently asked questions"
               className="lx-px" style={{ backgroundColor: C.bgSurf, paddingTop: '4rem', paddingBottom: '4rem' }}>
        <div className="lx-inner lx-faq-grid">
          <div>
            <Eyebrow>{CONTENT.faq.eyebrow}</Eyebrow>
            <h2 style={{ fontSize: 'clamp(1.35rem, 3vw, 1.9rem)', fontWeight: 700, color: C.text,
                         lineHeight: 1.22, letterSpacing: '-0.02em', margin: '0 0 0.875rem' }}>
              {CONTENT.faq.heading}
            </h2>
            <p style={{ fontSize: '0.875rem', color: C.textMut, lineHeight: 1.72 }}>
              More detail in the{' '}
              <a href={`${GITHUB_URL}#readme`} target="_blank" rel="noopener noreferrer"
                 style={{ color: C.accentTxt, fontWeight: 600, textDecoration: 'underline' }}>
                README
              </a>.
            </p>
          </div>
          <div>
            {CONTENT.faq.items.map(f => <FAQItem key={f.q} q={f.q} a={f.a} />)}
          </div>
        </div>
      </section>

      <Divider />

      {/* ── FINAL CTA ──────────────────────────────────────────────────────── */}
      <section aria-label="Get started"
               className="lx-px" style={{ backgroundColor: C.brand, paddingTop: '5rem', paddingBottom: '5rem' }}>
        <div className="lx-inner" style={{ textAlign: 'center', maxWidth: 600 }}>
          <h2 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.2rem)', fontWeight: 700, color: '#fff',
                       lineHeight: 1.2, letterSpacing: '-0.02em', margin: '0 0 1rem' }}>
            {CONTENT.cta.heading}
          </h2>
          <p style={{ fontSize: '0.95rem', color: C.navTxt, lineHeight: 1.75, margin: '0 0 2rem' }}>
            {CONTENT.cta.body}
          </p>
          <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <BtnPrimary onClick={goLogin} size="lg">{CONTENT.cta.cta1}</BtnPrimary>
            <BtnGhost href={GITHUB_URL} light size="lg">
              <IconGithub s={16} /> {CONTENT.cta.cta2}
            </BtnGhost>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="lx-px"
              style={{ backgroundColor: C.brand, borderTop: '1px solid rgba(255,255,255,0.1)',
                       paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
        <div className="lx-inner"
             style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center',
                      justifyContent: 'space-between', gap: '1rem' }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ backgroundColor: C.gold, color: C.brand, width: 24, height: 24,
                          borderRadius: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconScale s={12} />
            </div>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem' }}>LexBase</span>
            <span style={{ color: C.n400, fontSize: '0.78rem' }}>· {CONTENT.footer.desc}</span>
          </div>
          {/* Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            {CONTENT.footer.links.map(({ label, href }) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                 style={{ color: C.n400, fontSize: '0.8rem', textDecoration: 'none', transition: 'color 0.15s' }}
                 onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.navTxt }}
                 onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.n400 }}>
                {label}
              </a>
            ))}
          </div>
          {/* Licence + credit */}
          <p style={{ color: C.n400, fontSize: '0.76rem', margin: 0 }}>
            {CONTENT.footer.licence} ·{' '}
            <a href="https://github.com/marehman-exe" target="_blank" rel="noopener noreferrer"
               style={{ color: C.n400, textDecoration: 'none' }}
               onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.navTxt }}
               onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.n400 }}>
              {CONTENT.footer.credit}
            </a>
          </p>
        </div>
      </footer>

      {/* ── GLOBAL STYLES ─────────────────────────────────────────────────── */}
      <style>{`
        /* Nav show/hide */
        .lx-nav-desk { display: flex !important; }
        .lx-nav-mob  { display: none  !important; }

        /* Horizontal gutter: p-6 mobile / p-8 desktop */
        .lx-px { padding-left: 1.5rem; padding-right: 1.5rem; }
        @media (min-width: 768px) {
          .lx-px { padding-left: 2rem; padding-right: 2rem; }
        }

        /* Max content width — 1120px per spec */
        .lx-inner { max-width: 1120px; margin-left: auto; margin-right: auto; width: 100%; }

        /* Hero: two columns on md+ */
        .lx-hero-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 3rem;
          align-items: center;
        }
        @media (min-width: 800px) {
          .lx-hero-grid { grid-template-columns: 1fr 1fr; }
        }

        /* Trust strip: 3 columns on md+ */
        .lx-trust-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
        }
        @media (min-width: 640px) {
          .lx-trust-grid { grid-template-columns: repeat(3, 1fr); }
        }

        /* Privacy: two columns on md+ */
        .lx-privacy-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2.5rem;
          align-items: start;
        }
        @media (min-width: 768px) {
          .lx-privacy-grid { grid-template-columns: 1fr 1fr; }
        }

        /* FAQ: sidebar + accordion on md+ */
        .lx-faq-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2.5rem;
          align-items: start;
        }
        @media (min-width: 768px) {
          .lx-faq-grid { grid-template-columns: 280px 1fr; }
        }

        /* Slideshow */
        .lx-slideshow-grid { grid-template-columns: 180px 1fr; }
        .lx-beat-sidebar   { display: flex !important; }
        .lx-beat-content   { grid-template-columns: 1fr 1fr; }

        @media (max-width: 767px) {
          .lx-nav-desk { display: none  !important; }
          .lx-nav-mob  { display: flex  !important; }
        }

        @media (max-width: 639px) {
          .lx-slideshow-grid { grid-template-columns: 1fr !important; }
          .lx-beat-sidebar   { display: none !important; }
          .lx-beat-content   { grid-template-columns: 1fr !important; }
        }

        /* Focus rings */
        button:focus-visible, a:focus-visible {
          outline: 2px solid #386641 !important;
          outline-offset: 2px;
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          * { transition: none !important; animation: none !important; }
        }
      `}</style>
    </div>
  )
}
