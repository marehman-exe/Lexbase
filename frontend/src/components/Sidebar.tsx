// Sidebar.tsx — navy sidebar matching ui.html visual identity
// This component renders the left-hand navigation panel that is
// visible on every page once the user is signed in.

// Import the UserRole type to determine which nav items to show
import type { UserRole } from '../types/auth'

// Describes a single entry in the navigation menu
interface NavItem { key: string; label: string; icon: JSX.Element }

// All props the Sidebar component needs from its parent
interface Props {
  role:       UserRole
  active:     string
  onNavigate: (key: string) => void
  userName:   string
  firmId:     string | null
  onSignOut:  () => void
}

// ── Lucide-style inline SVG icons ────────────────────────────────────────────
// Each icon is a small inline SVG so there is no external icon library needed.
// They are stored in a plain object so they can be referenced by name.

const icons = {
  // Magnifying glass — used for the Research navigation item
  search: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  ),
  // Two stacked books — used for the Documents navigation item
  library: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h7v18H3z"/><path d="M14 3h7v18h-7z"/>
    </svg>
  ),
  // Group of people silhouettes — used for the Team navigation item
  users: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  // Shield shape — available for admin/security-related menu items
  shield: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  // Balance scales — brand logo icon displayed in the sidebar header
  scale: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18M5 6l-2 8h4L5 6zM19 6l-2 8h4L19 6z"/>
      <path d="M3 20h18"/>
    </svg>
  ),
  // Gear/cog — used for the Settings navigation item
  settings: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  // Door with arrow — used on the sign-out button in the user footer
  logOut: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
}

// Build the list of navigation items appropriate for a given user role.
// Super admins see only the Lawyer Accounts item; firm users see Research etc.
function getNavItems(role: UserRole): NavItem[] {
  const items: NavItem[] = []
  // Super admin only manages lawyer accounts — no research or documents
  if (role === 'super_admin')
    items.push({ key: 'lawyers', label: 'Lawyer Accounts', icon: icons.scale })
  // Firm users (lawyer, associate, paralegal) get research and documents
  if (role === 'lawyer' || role === 'associate' || role === 'paralegal') {
    items.push({ key: 'research',  label: 'Research',  icon: icons.search  })
    items.push({ key: 'documents', label: 'Documents', icon: icons.library })
  }
  // Only the lawyer (firm owner) can manage their team of associates/paralegals
  if (role === 'lawyer')
    items.push({ key: 'team', label: 'Team', icon: icons.users })
  return items
}

// Human-readable display labels for each role shown below the user's name
const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin', lawyer: 'Lawyer',
  associate: 'Associate',     paralegal: 'Paralegal',
}

// Main sidebar component — renders brand, navigation, workspace card, and user info
export default function Sidebar({ role, active, onNavigate, userName, firmId, onSignOut }: Props) {
  // Build the nav items array based on the signed-in user's role
  const navItems = getNavItems(role)
  // Create a two-letter initials string for the user avatar circle
  const initials = userName.slice(0, 2).toUpperCase()

  return (
    // Full-height navy sidebar fixed on the left side of the screen
    <aside
      style={{ backgroundColor: '#0b1f33', width: '17rem', minHeight: '100vh' }}
      className="flex flex-col shrink-0 p-5"
      aria-label="Primary navigation"
    >
      {/* ── Brand header ── */}
      {/* Gold scales icon and LexBase title at the top of the sidebar */}
      <header className="flex items-center gap-3 px-2 pb-8">
        <div
          style={{ backgroundColor: '#c58b2a', color: '#0b1f33' }}
          className="h-10 w-10 rounded-xl flex items-center justify-center shadow-lg"
        >
          {icons.scale}
        </div>
        <div>
          <p className="text-white font-bold tracking-tight text-sm">LexBase</p>
          <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Legal Knowledge Assistant</p>
        </div>
      </header>

      {/* ── Navigation ── */}
      {/* List of page links filtered to the current user's role */}
      <nav className="space-y-1" aria-label="Workspace">
        {navItems.map(item => (
          // Each button highlights when it matches the currently active page
          <button
            key={item.key}
            type="button"
            onClick={() => onNavigate(item.key)}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition-all duration-200"
            style={
              active === item.key
                ? { backgroundColor: 'rgba(255,255,255,.12)', color: '#ffffff', fontWeight: 600 }
                : { color: '#94a3b8', fontWeight: 500 }
            }
            // Subtle slide-right effect on hover for inactive items
            onMouseEnter={e => {
              if (active !== item.key)
                (e.currentTarget as HTMLElement).style.transform = 'translateX(3px)'
            }}
            onMouseLeave={e => {
              if (active !== item.key)
                (e.currentTarget as HTMLElement).style.transform = ''
            }}
          >
            <span className="w-4 h-4 shrink-0">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* ── Firm workspace card ── */}
      {/* Only shown for users who belong to a firm (firmId is not null) */}
      {firmId && (
        <div className="mt-8">
          <p className="px-3 text-[10px] tracking-[.16em] uppercase font-bold mb-3"
             style={{ color: '#64748b' }}>Workspace</p>
          <div className="rounded-2xl p-4 border"
               style={{ backgroundColor: '#14314b', borderColor: 'rgba(255,255,255,.1)' }}>
            <p className="text-sm font-semibold text-white">Firm Workspace</p>
            {/* Green dot and "Connected" label showing the workspace is active */}
            <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: '#6ee7b7' }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#34d399' }} />
              Connected
            </div>
          </div>
        </div>
      )}

      {/* ── Settings ── */}
      {/* Settings button rendered separately below the main nav list */}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition-all duration-200"
          style={
            active === 'settings'
              ? { backgroundColor: 'rgba(255,255,255,.12)', color: '#ffffff', fontWeight: 600 }
              : { color: '#94a3b8', fontWeight: 500 }
          }
          onMouseEnter={e => {
            if (active !== 'settings')
              (e.currentTarget as HTMLElement).style.transform = 'translateX(3px)'
          }}
          onMouseLeave={e => {
            if (active !== 'settings')
              (e.currentTarget as HTMLElement).style.transform = ''
          }}
        >
          <span className="w-4 h-4 shrink-0">{icons.settings}</span>
          Settings
        </button>
      </div>

      {/* ── User footer ── */}
      {/* Avatar, user name, role label, and sign-out button at bottom */}
      <footer className="mt-auto pt-8">
        <div className="flex items-center gap-3 px-2">
          {/* Circular avatar showing the user's two-letter initials */}
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
            style={{ backgroundColor: '#d9ddd8', color: '#102a43' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            {/* Display name truncates if it is too long for the sidebar width */}
            <p className="text-sm font-semibold text-white truncate">{userName}</p>
            <p className="text-xs" style={{ color: '#94a3b8' }}>{ROLE_LABELS[role]}</p>
          </div>
          {/* Sign-out button — calls the parent's onSignOut handler when clicked */}
          <button
            type="button"
            onClick={onSignOut}
            title="Sign out"
            className="ml-auto transition-colors focus:outline-none rounded"
            style={{ color: '#94a3b8' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#ffffff'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#94a3b8'}
            aria-label="Sign out"
          >
            {icons.logOut}
          </button>
        </div>
      </footer>
    </aside>
  )
}
