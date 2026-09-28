// Disclaimer.tsx — themed legal disclaimer
// Displays a small warning paragraph reminding users that LexBase
// results are not a substitute for professional legal advice.
// This is shown at the bottom of every AI-generated research answer.

// Stateless component — no props needed, always renders the same text
export default function Disclaimer() {
  return (
    // Muted small text separated from the content above by a thin border
    <p style={{ color: 'var(--color-text-muted)', borderTopColor: 'var(--color-border)' }}
       className="text-xs border-t pt-3 mt-3 leading-relaxed">
      LexBase provides retrieved information from your firm's knowledge base and is not a
      substitute for professional legal judgment. Verify all sources before relying on
      retrieved content.
    </p>
  )
}
