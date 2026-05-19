import Link from 'next/link'

export default function NotFound() {
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
      <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-semibold)' }}>404</h1>
      <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-muted)' }}>Page not found</p>
      <Link
        href="/dashboard/chat"
        style={{
          height: 'var(--input-h)',
          padding: '0 var(--space-5)',
          background: 'var(--color-brand)',
          color: 'var(--color-brand-fg)',
          borderRadius: 'var(--radius-md)',
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--font-medium)',
        }}
      >
        Back to chat
      </Link>
    </div>
  )
}
