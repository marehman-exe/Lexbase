// KpiCard.tsx — Power BI-style metric card with theme support
// Displays a single key performance indicator: a label, a large value,
// and an optional sub-text. Used in the KPI summary rows on Admin and Team pages.

// Props accepted by the KpiCard component:
// label  — small uppercase caption above the number (e.g. "Total Lawyers")
// value  — the main numeric or text value displayed in large bold type
// sub    — optional tiny descriptor shown below the value
// accent — when true, uses the green accent colour instead of default text
interface Props {
  label:   string
  value:   string | number
  sub?:    string
  accent?: boolean
}

// Renders a bordered card tile containing the metric information
export default function KpiCard({ label, value, sub, accent }: Props) {
  return (
    // White surface card with a border that turns green when accent is active
    <div
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        // Accent border highlights the most important metric on the page
        borderColor: accent ? 'var(--color-accent)' : 'var(--color-border)',
        borderWidth: 1,
        borderStyle: 'solid',
      }}
      className="rounded-lg p-4 flex flex-col gap-1"
    >
      {/* Small uppercase label identifying what this metric measures */}
      <p style={{ color: 'var(--color-text-muted)' }}
         className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      {/* Large bold number — green when accent prop is true, dark otherwise */}
      <p style={{ color: accent ? 'var(--color-accent)' : 'var(--color-text-primary)' }}
         className="text-2xl font-bold tabular-nums">{value}</p>
      {/* Optional sub-label only rendered if the parent passes a value */}
      {sub && <p style={{ color: 'var(--color-text-disabled)' }} className="text-xs">{sub}</p>}
    </div>
  )
}
