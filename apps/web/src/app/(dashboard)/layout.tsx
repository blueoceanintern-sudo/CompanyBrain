'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sidebar, MobileMenuButton } from '@/components/sidebar'
import { Providers } from '@/app/providers'
import { ChatHistoryProvider, useChatHistory } from '@/lib/chat-history-context'
import { getAuthUser, isAuthenticated } from '@/lib/auth'
import { routePermission } from '@/lib/nav'
import { hasPermission } from '@company-brain/shared'

function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [allowed, setAllowed] = useState(false)
  const { saveCurrentAsSession } = useChatHistory()
  const prevPathRef = useRef(pathname)

  useEffect(() => {
    const prev = prevPathRef.current
    prevPathRef.current = pathname
    if (prev.startsWith('/chat') && !pathname.startsWith('/chat')) {
      saveCurrentAsSession()
    }
  }, [pathname, saveCurrentAsSession])

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login')
      return
    }

    const permission = routePermission(pathname)
    if (permission) {
      const user = getAuthUser()
      if (!user || !hasPermission(user.role, permission)) {
        router.replace('/chat')
        return
      }
    }

    setAllowed(true)
  }, [pathname, router])

  if (!allowed) return null

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f8f9ff' }}>
      <Sidebar />
      {/* Mobile top bar */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-4"
        style={{ height: 56, background: '#f8f9ff', borderBottom: '1px solid #c3c6d7' }}
      >
        <MobileMenuButton />
        <span style={{ fontSize: 14, fontWeight: 600, color: '#004ac6' }}>Company&apos;s Brain</span>
      </div>
      <main
        style={{
          flex: 1,
          minWidth: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
        }}
      >
        {/* Spacer for mobile top bar */}
        <div className="md:hidden" style={{ height: 56, flexShrink: 0 }} />
        {children}
      </main>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <ChatHistoryProvider>
        <DashboardShell>{children}</DashboardShell>
      </ChatHistoryProvider>
    </Providers>
  )
}
