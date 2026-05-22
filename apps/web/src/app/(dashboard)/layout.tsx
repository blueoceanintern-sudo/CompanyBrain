'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar, MobileMenuButton, useSidebarWidth } from '@/components/sidebar'
import { Providers } from '@/app/providers'
import { isAuthenticated } from '@/lib/auth'

function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const sidebarWidth = useSidebarWidth()

  useEffect(() => {
    if (!isAuthenticated()) {
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
