// EmptyState.tsx — themed empty states
// Shows a centred placeholder when a list or data section has no items yet.
// Used on pages like Documents or Team when there is nothing to display.

// Props this component accepts from its parent:
// icon   — an emoji or symbol shown large and faded at the top
// title  — short bold heading describing why nothing is here
// body   — longer explanation or instruction for the user
// action — optional button the user can click to create something
interface Props {
  icon:    string
  title:   string
  body:    string
  action?: { label: string; onClick: () => void }
}

// Centred empty-state layout with optional call-to-action button
export default function EmptyState({ icon, title, body, action }: Props) {
  return (
    // Full-width centred column with generous vertical padding
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
      {/* Large faded icon gives visual context for why the state is empty */}
      <div className="text-4xl mb-4 opacity-30">{icon}</div>
      {/* Bold heading tells the user what they are looking at */}
      <h3 style={{ color: 'var(--color-text-primary)' }}
          className="text-base font-semibold mb-1">{title}</h3>
      {/* Muted body text provides a hint on how to populate this section */}
      <p style={{ color: 'var(--color-text-muted)' }}
         className="text-sm max-w-sm">{body}</p>
      {/* Optional action button is only rendered when the parent provides one */}
      {action && (
        <button
          onClick={action.onClick}
          style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}
          className="mt-5 px-4 py-2 text-sm font-medium rounded-md hover:opacity-90 transition-opacity"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
