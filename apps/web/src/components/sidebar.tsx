'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { usePathname, useRouter } from 'next/navigation'
import {
  MessageSquare, FileText, BarChart2, ClipboardCheck,
  Users, Settings, Brain, User, LogOut, Menu, X,
} from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getAuthUser, clearAuth } from '@/lib/auth'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  roles: string[]
}

const NAV: NavItem[] = [
  { label: 'Chat',      href: '/chat',      icon: MessageSquare,  roles: ['super_admin','org_admin','dept_admin','staff','external_client'] },
  { label: 'Documents', href: '/documents', icon: FileText,        roles: ['super_admin','org_admin','dept_admin'] },
  { label: 'Analytics', href: '/analytics', icon: BarChart2,       roles: ['super_admin','org_admin'] },
  { label: 'Audit Log', href: '/audit',     icon: ClipboardCheck,  roles: ['super_admin','org_admin'] },
  { label: 'Users',     href: '/users',     icon: Users,           roles: ['super_admin','org_admin'] },
  { label: 'Settings',  href: '/settings',  icon: Settings,        roles: ['super_admin','org_admin'] },
]

// ─── Sidebar content ──────────────────────────────────────────────────────────

function SidebarContent({
  isSheet = false,
  onClose,
}: {
  isSheet?: boolean
  onClose?: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<ReturnType<typeof getAuthUser>>(null)

  useEffect(() => { setUser(getAuthUser()) }, [])

  const visible = NAV.filter((n) => n.roles.includes(user?.role ?? ''))
  const initial = (user?.email?.[0] ?? '?').toUpperCase()
  const handleLogout = () => { clearAuth(); router.replace('/login') }

  const bgActive   = '#2563eb'
  const bgHover    = '#dce9ff'
  const textActive = '#ffffff'
  const textInactive = '#585f67'
  const borderLeft = '2px solid #004ac6'

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: '#eff4ff', borderRight: '1px solid #c3c6d7', width: isSheet ? 240 : 80 }}
    >
      {/* Logo */}
      <div className="flex items-center justify-center py-6 mb-2">
        {isSheet ? (
          <div className="flex items-center gap-3 px-4 w-full">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#2563eb' }}>
              <Brain size={18} color="#ffffff" />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: '#004ac6', lineHeight: 1.2 }}>Brain</p>
              <p className="text-xs" style={{ color: '#585f67', opacity: 0.7 }}>AI Agent</p>
            </div>
            <button onClick={onClose} className="ml-auto p-1 rounded" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67' }}>
              <X size={18} />
            </button>
          </div>
        ) : (
          <Brain size={28} style={{ color: '#004ac6' }} />
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-col items-center gap-1 flex-1 px-2">
        {visible.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          const linkEl = (
            <Link
              href={item.href as Route}
              {...(isSheet && onClose ? { onClick: onClose } : {})}
              className="flex items-center justify-center rounded-xl transition-colors"
              style={{
                width: isSheet ? '100%' : 48,
                height: 48,
                background: active ? bgActive : 'transparent',
                color: active ? textActive : textInactive,
                borderLeft: active ? borderLeft : '2px solid transparent',
                textDecoration: 'none',
                gap: isSheet ? 12 : 0,
                padding: isSheet ? '0 16px' : 0,
                justifyContent: isSheet ? 'flex-start' : 'center',
              }}
              onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = bgHover }}
              onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <item.icon size={20} aria-hidden className="shrink-0" />
              {isSheet && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          )

          if (!isSheet) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            )
          }
          return <div key={item.href} className="w-full">{linkEl}</div>
        })}
      </nav>

      {/* Footer */}
      <div className="flex flex-col items-center gap-2 px-2 pb-6 mt-auto" style={{ borderTop: '1px solid #c3c6d7', paddingTop: 16 }}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="flex items-center justify-center rounded-xl cursor-default"
              style={{ width: isSheet ? '100%' : 48, height: 48, gap: isSheet ? 12 : 0, padding: isSheet ? '0 16px' : 0, justifyContent: isSheet ? 'flex-start' : 'center' }}
            >
              <div className="flex items-center justify-center rounded-full text-xs font-bold shrink-0" style={{ width: 32, height: 32, background: '#e5eeff', color: '#004ac6' }}>
                {initial}
              </div>
              {isSheet && (
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: '#0b1c30' }}>{user?.email}</p>
                  <p className="text-xs capitalize" style={{ color: '#585f67' }}>{user?.role?.replace(/_/g, ' ')}</p>
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{user?.email}</p>
            <p className="opacity-60 text-xs">{user?.role?.replace(/_/g, ' ')}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleLogout}
              aria-label="Log out"
              className="flex items-center justify-center rounded-xl transition-colors"
              style={{ width: isSheet ? '100%' : 48, height: 36, background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', gap: isSheet ? 12 : 0, padding: isSheet ? '0 16px' : 0, justifyContent: isSheet ? 'flex-start' : 'center' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#0b1c30' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#585f67' }}
            >
              <LogOut size={18} aria-hidden />
              {isSheet && <span className="text-sm">Log out</span>}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Log out</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

// ─── Public exports ───────────────────────────────────────────────────────────

export function Sidebar() {
  return (
    <TooltipProvider delayDuration={200}>
      <aside className="h-screen shrink-0 hidden md:block" style={{ width: 80 }}>
        <SidebarContent />
      </aside>
    </TooltipProvider>
  )
}

export function MobileMenuButton() {
  const [open, setOpen] = useState(false)
  return (
    <TooltipProvider>
      <>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="md:hidden"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0b1c30' }}
        >
          <Menu size={20} />
        </button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="p-0 w-[240px]" style={{ background: '#eff4ff' }}>
            <SidebarContent isSheet onClose={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </>
    </TooltipProvider>
  )
}
