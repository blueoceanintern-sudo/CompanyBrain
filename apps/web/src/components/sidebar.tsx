'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { usePathname, useRouter } from 'next/navigation'
import {
  MessageSquare, FileText, BarChart2, Shield, Users, Settings,
  Menu, X, LogOut, ChevronLeft, ChevronRight, type LucideIcon,
} from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getAuthUser, clearAuth } from '@/lib/auth'

// Navy sidebar palette — all inline, intentionally NOT using --color-surface tokens
const NAVY        = 'oklch(35% 0.22 258)'
const WHITE       = 'oklch(100% 0 0)'
const WHITE_70    = 'oklch(100% 0 0 / 70%)'
const WHITE_40    = 'oklch(100% 0 0 / 40%)'
const WHITE_15    = 'oklch(100% 0 0 / 15%)'
const WHITE_10    = 'oklch(100% 0 0 / 10%)'
const NAVY_BORDER = `1px solid ${WHITE_10}`

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  roles: string[]
}

const NAV: NavItem[] = [
  { label: 'Chat',      href: '/chat',      icon: MessageSquare, roles: ['super_admin','org_admin','dept_admin','staff','external_client'] },
  { label: 'Documents', href: '/documents', icon: FileText,      roles: ['super_admin','org_admin','dept_admin'] },
  { label: 'Analytics', href: '/analytics', icon: BarChart2,     roles: ['super_admin','org_admin'] },
  { label: 'Audit Log', href: '/audit',     icon: Shield,        roles: ['super_admin','org_admin'] },
  { label: 'Users',     href: '/users',     icon: Users,         roles: ['super_admin','org_admin'] },
  { label: 'Settings',  href: '/settings',  icon: Settings,      roles: ['super_admin','org_admin'] },
]

function useWindowWidth() {
  const [w, setW] = useState<number | null>(null)
  useEffect(() => {
    setW(window.innerWidth)
    const h = () => setW(window.innerWidth)
    window.addEventListener('resize', h, { passive: true })
    return () => window.removeEventListener('resize', h)
  }, [])
  return w
}

// ─── Plane switcher ───────────────────────────────────────────────────────────

type Plane = 'internal' | 'external'

function PlaneSwitcher({ collapsed }: { collapsed: boolean }) {
  const [plane, setPlane] = useState<Plane>('internal')

  if (collapsed) {
    return (
      <div className="flex justify-center py-3" style={{ borderTop: NAVY_BORDER }}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="size-2 rounded-full" style={{ background: plane === 'internal' ? WHITE : 'var(--color-external)' }} />
          </TooltipTrigger>
          <TooltipContent side="right">Plane: {plane}</TooltipContent>
        </Tooltip>
      </div>
    )
  }

  return (
    <div className="px-6 py-4" style={{ borderTop: NAVY_BORDER }}>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: WHITE_40 }}>
        Knowledge plane
      </h3>
      <div className="flex items-center text-sm">
        <button onClick={() => setPlane('internal')} style={{ color: plane === 'internal' ? WHITE : WHITE_40, fontWeight: plane === 'internal' ? 500 : 400 }}>
          internal
        </button>
        <span className="mx-1" style={{ color: WHITE_40 }}>/</span>
        <button onClick={() => setPlane('external')} style={{ color: plane === 'external' ? WHITE : WHITE_40, fontWeight: plane === 'external' ? 500 : 400 }}>
          external
        </button>
      </div>
    </div>
  )
}

// ─── Sidebar content ──────────────────────────────────────────────────────────

function SidebarContent({
  collapsed,
  onToggle,
  isSheet = false,
  onClose,
}: {
  collapsed: boolean
  onToggle?: () => void
  isSheet?: boolean
  onClose?: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<ReturnType<typeof getAuthUser>>(null)

  useEffect(() => { setUser(getAuthUser()) }, [])

  const visible = NAV.filter((n) => n.roles.includes(user?.role ?? ''))
  const isAdmin = user?.role === 'super_admin' || user?.role === 'org_admin'
  const initial = (user?.email?.[0] ?? '?').toUpperCase()
  const handleLogout = () => { clearAuth(); router.replace('/login') }

  // Text fades out fast on collapse, delays fade-in on expand so the sidebar opens first
  const textStyle: React.CSSProperties = {
    opacity: collapsed ? 0 : 1,
    transition: collapsed ? 'opacity 100ms ease' : 'opacity 150ms ease 80ms',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    pointerEvents: collapsed ? 'none' : 'auto',
  }

  return (
    <div className="flex flex-col h-full" style={{ background: NAVY, borderRight: NAVY_BORDER }}>

      {/* Header */}
      <div
        className="flex items-center shrink-0 gap-2"
        style={{ height: 'var(--header-h)', padding: '0 10px', borderBottom: NAVY_BORDER, overflow: 'hidden' }}
      >
        {isSheet ? (
          <>
            <span className="flex-1 text-sm font-semibold" style={{ color: WHITE, letterSpacing: '-0.01em' }}>Company&apos;s Brain</span>
            <button onClick={onClose} aria-label="Close menu" className="p-1 rounded shrink-0" style={{ color: WHITE_70, background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </>
        ) : (
          <>
            <span className="flex-1 text-sm font-semibold" style={{ color: WHITE, letterSpacing: '-0.01em', ...textStyle }}>
              Company&apos;s Brain
            </span>
            {onToggle && (
              <button
                onClick={onToggle}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="shrink-0 p-1 rounded transition-colors"
                style={{ color: WHITE_40, background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = WHITE }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = WHITE_40 }}
              >
                {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
            )}
          </>
        )}
      </div>

      {/* Nav */}
      <div className="flex-grow flex flex-col pt-3 overflow-y-auto custom-scrollbar">
        <nav aria-label="Main navigation" className="space-y-0.5" style={{ padding: '0 6px' }}>
          {visible.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            const linkEl = (
              <Link
                href={item.href as Route}
                {...(isSheet && onClose ? { onClick: onClose } : {})}
                className="flex items-center gap-3 rounded-lg text-sm transition-colors"
                style={{
                  padding: '9px 8px',
                  fontWeight: active ? 500 : 400,
                  color: active ? WHITE : WHITE_70,
                  background: active ? WHITE_15 : 'transparent',
                  textDecoration: 'none',
                  borderLeft: active && !collapsed ? `2px solid ${WHITE}` : '2px solid transparent',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; if (!active) { el.style.background = WHITE_10; el.style.color = WHITE } }}
                onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; if (!active) { el.style.background = 'transparent'; el.style.color = WHITE_70 } }}
              >
                <item.icon size={18} aria-hidden className="shrink-0" />
                <span style={textStyle}>{item.label}</span>
              </Link>
            )

            if (collapsed && !isSheet) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              )
            }
            return <div key={item.href}>{linkEl}</div>
          })}
        </nav>

        {isAdmin && <PlaneSwitcher collapsed={collapsed && !isSheet} />}
      </div>

      {/* Footer */}
      <div className="shrink-0 p-2" style={{ borderTop: NAVY_BORDER }}>
        {collapsed && !isSheet ? (
          <div className="flex flex-col items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold cursor-default" style={{ background: WHITE_15, color: WHITE }}>
                  {initial}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{user?.email}</p>
                <p className="opacity-60 text-xs">{user?.role?.replace(/_/g, ' ')}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={handleLogout} aria-label="Log out" className="w-7 h-7 rounded flex items-center justify-center transition-colors" style={{ color: WHITE_40, background: 'none', border: 'none', cursor: 'pointer' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = WHITE }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = WHITE_40 }}>
                  <LogOut size={15} aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Log out</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-1">
            <div className="w-7 h-7 shrink-0 rounded flex items-center justify-center text-xs font-bold" style={{ background: WHITE_15, color: WHITE }}>
              {initial}
            </div>
            <div className="flex-1 min-w-0" style={textStyle}>
              <p className="text-xs font-semibold truncate" style={{ color: WHITE }}>{user?.email}</p>
              <p className="text-[11px] capitalize" style={{ color: WHITE_70 }}>{user?.role?.replace(/_/g, ' ')}</p>
            </div>
            <button onClick={handleLogout} aria-label="Log out" className="shrink-0 p-1 rounded flex items-center transition-colors" style={{ color: WHITE_40, background: 'none', border: 'none', cursor: 'pointer' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = WHITE }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = WHITE_40 }}>
              <LogOut size={15} aria-hidden />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Public exports ───────────────────────────────────────────────────────────

export function Sidebar() {
  const w = useWindowWidth()
  const [collapsed, setCollapsed] = useState(false)

  if (w === null) return <aside className="h-screen shrink-0" style={{ width: 'var(--sidebar-w)' }} />
  if (w < 768) return null

  const width = collapsed ? 'var(--sidebar-w-icon)' : 'var(--sidebar-w)'
  return (
    <TooltipProvider delayDuration={200}>
      <aside className="h-screen shrink-0 overflow-hidden" style={{ width, transition: 'width 200ms ease' }}>
        <SidebarContent collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      </aside>
    </TooltipProvider>
  )
}

export function MobileMenuButton() {
  const [open, setOpen] = useState(false)
  const w = useWindowWidth()
  if (w === null || w >= 768) return null
  return (
    <TooltipProvider>
      <>
        <button onClick={() => setOpen(true)} aria-label="Open navigation" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)' }}>
          <Menu size={20} />
        </button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="p-0 w-[240px]" style={{ background: NAVY }}>
            <SidebarContent isSheet collapsed={false} onClose={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </>
    </TooltipProvider>
  )
}
