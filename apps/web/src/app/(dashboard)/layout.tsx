'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar, MobileMenuButton, useSidebarWidth } from '@/components/sidebar'
import { Providers } from '@/app/providers'
import { isAuthenticated } from '@/lib/auth'
import { MOCK_USER } from '@/lib/mock-data'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const sidebarWidth = useSidebarWidth()

  useEffect(() => {
    // Skip auth redirect in mock mode
    if (!USE_MOCK && !isAuthenticated()) {
      // Seed mock user so the UI has something to show in development
      if (process.env.NODE_ENV === 'development') {
        localStorage.setItem('auth_user', JSON.stringify(MOCK_USER))
        return
      }
      router.replace('/login')
    }
  }, [router])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main
        style={{
          flex: 1,
          marginLeft: sidebarWidth,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          transition: 'margin-left 200ms ease',
        }}
      >
        {/* Mobile top bar — only renders when sidebar is hidden */}
        <MobileTopBar />
        {children}
      </main>
    </div>
  )
}

function MobileTopBar() {
  return (
    <div
      className="mobile-topbar"
      style={{
        display: 'none',
        height: 'var(--header-h)',
        alignItems: 'center',
        padding: '0 var(--space-4)',
        gap: 'var(--space-3)',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-bg)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        flexShrink: 0,
      }}
    >
      <MobileMenuButton />
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>Company&apos;s Brain</span>
      <style>{`@media (max-width: 767px) { .mobile-topbar { display: flex !important; } }`}</style>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <DashboardShell>{children}</DashboardShell>
    </Providers>
  )
}
