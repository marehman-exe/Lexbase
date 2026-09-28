// StatusBadge.tsx — themed status indicator
// Renders a small pill badge with a coloured dot and label that visually
// communicates the current state of a record (e.g. Active, Failed, Pending).

// Props accepted by the StatusBadge component:
// status — one of the known status strings that controls colour and label
// size   — 'sm' for compact tables, 'md' for slightly larger display contexts
interface Props {
  status: 'ready' | 'processing' | 'pending' | 'failed' | 'active' | 'inactive' | 'suspended'
  size?:  'sm' | 'md'
}

// Component that maps a status string to a colour-coded badge pill
export default function StatusBadge({ status, size = 'sm' }: Props) {
  // Select padding and font size based on the requested size variant
  const pad = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'

  // Map every possible status value to its background, text, and dot colours.
  // These colours all use the CSS design tokens defined in index.css.
  const styles: Record<string, { bg: string; text: string; dot: string }> = {
    // Green family — things that are working and healthy
    ready:      { bg: 'var(--color-success-bg)',  text: 'var(--color-success)', dot: 'var(--color-success)' },
    active:     { bg: 'var(--color-success-bg)',  text: 'var(--color-success)', dot: 'var(--color-success)' },
    // Amber/gold family — things that are in progress or waiting
    processing: { bg: 'var(--color-warning-bg)',  text: 'var(--color-warning)', dot: 'var(--color-warning)' },
    pending:    { bg: 'var(--color-bg-secondary)', text: 'var(--color-text-muted)', dot: 'var(--color-text-muted)' },
    // Red family — things that have stopped working or are blocked
    failed:     { bg: 'var(--color-error-bg)',    text: 'var(--color-error)',   dot: 'var(--color-error)' },
    // Grey/neutral family — things that are dormant or deactivated
    inactive:   { bg: 'var(--color-bg-secondary)', text: 'var(--color-text-muted)', dot: 'var(--color-text-muted)' },
    suspended:  { bg: 'var(--color-error-bg)',    text: 'var(--color-error)',   dot: 'var(--color-error)' },
  }

  // Look up the colour set for the provided status value
  const s = styles[status]
  return (
    // Pill-shaped inline element with a coloured background
    <span
      style={{ backgroundColor: s.bg, color: s.text }}
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${pad}`}
    >
      {/* Small filled circle dot on the left of the label text */}
      <span style={{ backgroundColor: s.dot }} className="w-1.5 h-1.5 rounded-full" />
      {/* Capitalise the first letter of the status string for the label */}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}
