'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-4)',
        background: 'var(--color-bg)',
      }}
    >
      <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-semibold)' }}>500</h1>
      <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-muted)' }}>Something went wrong</p>
      <button
        onClick={reset}
        style={{
          height: 'var(--input-h)',
          padding: '0 var(--space-5)',
          background: 'var(--color-brand)',
          color: 'var(--color-brand-fg)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--font-medium)',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  )
}
