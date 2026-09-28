// AppHeader.tsx — themed page header
// Renders a consistent title and optional subtitle at the top of each page.
// Every inner page imports this component so heading styles stay uniform.

// Props accepted by this component:
// title    — the main heading text displayed in large bold font
// subtitle — optional smaller description text shown below the title
interface Props { title: string; subtitle?: string }

// Simple presentational component with no state or side effects
export default function AppHeader({ title, subtitle }: Props) {
  return (
    // Wrapper div provides consistent bottom margin before the page content
    <div className="mb-6">
      {/* Main page title styled with the primary text colour from design tokens */}
      <h1 style={{ color: 'var(--color-text-primary)' }}
          className="text-xl font-semibold tracking-tight">{title}</h1>
      {/* Subtitle is only rendered when the parent passes a value for it */}
      {subtitle && (
        <p style={{ color: 'var(--color-text-muted)' }}
           className="text-sm mt-0.5">{subtitle}</p>
      )}
    </div>
  )
}
