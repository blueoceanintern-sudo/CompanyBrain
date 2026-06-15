'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { usePathname } from 'next/navigation'
import { MessageSquare, FileText, BarChart2, Shield, Users, Settings, Menu, X, type LucideIcon } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getAuthUser } from '@/lib/auth'

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
  const [w, setW] = useState(1280)
  useEffect(() => {
    setW(window.innerWidth)
    const h = () => setW(window.innerWidth)
    window.addEventListener('resize', h, { passive: true })
    return () => window.removeEventListener('resize', h)
  }, [])
  return w
}

type Mode = 'expanded' | 'icon-only' | 'sheet'

function getMode(w: number): Mode {
  if (w >= 1024) return 'expanded'
  if (w >= 768) return 'icon-only'
  return 'sheet'
}

// ─── Plane switcher ───────────────────────────────────────────────────────────

type Plane = 'internal' | 'external'

function PlaneSwitcher({ iconOnly }: { iconOnly?: boolean }) {
  const [plane, setPlane] = useState<Plane>('internal')
  if (iconOnly) {
    return (
      <div className="flex justify-center py-3" style={{ borderTop: NAVY_BORDER }}>
        <div
          title={`Plane: ${plane}`}
          className="size-2 rounded-full"
          style={{ background: plane === 'internal' ? WHITE : 'var(--color-external)' }}
        />
      </div>
    )
  }
  return (
    <div className="mt-auto px-6 py-4" style={{ borderTop: NAVY_BORDER }}>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: WHITE_40 }}>
        Knowledge plane
      </h3>
      <div className="flex items-center text-sm">
        <button
          onClick={() => setPlane('internal')}
          style={{ color: plane === 'internal' ? WHITE : WHITE_40, fontWeight: plane === 'internal' ? 500 : 400 }}
        >
          internal
        </button>
        <span className="mx-1" style={{ color: WHITE_40 }}>/</span>
        <button
          onClick={() => setPlane('external')}
          style={{ color: plane === 'external' ? WHITE : WHITE_40, fontWeight: plane === 'external' ? 500 : 400 }}
        >
          external
        </button>
      </div>
    </div>
  )
}

// ─── Sidebar content ──────────────────────────────────────────────────────────

function SidebarContent({ mode, onClose }: { mode: Mode; onClose?: () => void }) {
  const pathname = usePathname()
  const user = getAuthUser()
  const isIconOnly = mode === 'icon-only'
  const visible = NAV.filter((n) => n.roles.includes(user?.role ?? ''))
  const isAdmin = user?.role === 'super_admin' || user?.role === 'org_admin'

  return (
    <div className="flex flex-col h-full" style={{ background: NAVY, borderRight: NAVY_BORDER }}>

      {/* Logo / brand header */}
      {mode !== 'sheet' && (
        <div
          className="flex items-center shrink-0"
          style={{
            height: 'var(--header-h)',
            padding: isIconOnly ? '0' : '0 var(--space-5)',
            justifyContent: isIconOnly ? 'center' : 'flex-start',
            borderBottom: NAVY_BORDER,
          }}
        >
          {isIconOnly ? (
            <span className="text-sm font-bold" style={{ color: WHITE, letterSpacing: '-0.01em' }}>CB</span>
          ) : (
            <span className="text-sm font-semibold" style={{ color: WHITE, letterSpacing: '-0.01em' }}>Company&apos;s Brain</span>
          )}
        </div>
      )}

      {/* Sheet header — mobile only */}
      {mode === 'sheet' && (
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="text-sm font-semibold" style={{ color: WHITE }}>Company&apos;s Brain</span>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded" style={{ color: WHITE_70 }}>
            <X size={18} />
          </button>
        </div>
      )}

      {/* Scrollable: nav + recents */}
      <div className="flex-grow flex flex-col pt-3 overflow-y-auto custom-scrollbar">
        <nav aria-label="Main navigation" className="space-y-0.5" style={{ padding: isIconOnly ? '0 8px' : '0 12px' }}>
          {visible.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            const linkEl = (
              <Link
                href={item.href as Route}
                {...(mode === 'sheet' && onClose ? { onClick: onClose } : {})}
                className="flex items-center gap-3 rounded-lg text-sm transition-colors"
                style={{
                  padding: '8px 12px',
                  paddingLeft: active && !isIconOnly ? '10px' : '12px',
                  justifyContent: isIconOnly ? 'center' : 'flex-start',
                  fontWeight: active ? 500 : 400,
                  color: active ? WHITE : WHITE_70,
                  background: active ? WHITE_15 : 'transparent',
                  textDecoration: 'none',
                  borderLeft: active && !isIconOnly ? `2px solid ${WHITE}` : '2px solid transparent',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement
                  if (!active) { el.style.background = WHITE_10; el.style.color = WHITE }
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement
                  if (!active) { el.style.background = 'transparent'; el.style.color = WHITE_70 }
                }}
              >
                <item.icon size={20} aria-hidden />
                {!isIconOnly && item.label}
              </Link>
            )
            if (isIconOnly) {
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

        {/* Recents — expanded only */}
        {!isIconOnly && (
          <div className="mt-8">
            <h3 className="px-6 mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: WHITE_40 }}>
              Recents
            </h3>
            <div className="space-y-0.5 px-3">
              <p className="px-3 py-2 text-sm italic" style={{ color: WHITE_40 }}>No recent queries</p>
            </div>
          </div>
        )}

        {/* Plane switcher — admins only */}
        {isAdmin && <PlaneSwitcher iconOnly={isIconOnly} />}
      </div>

      {/* User footer */}
      <div className="p-3" style={{ borderTop: NAVY_BORDER }}>
        {isIconOnly ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="w-8 h-8 mx-auto rounded flex items-center justify-center text-xs font-bold cursor-default"
                style={{ background: WHITE_15, color: WHITE }}
              >
                {(user?.email?.[0] ?? '?').toUpperCase()}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{user?.email}</p>
              <p className="opacity-60 text-xs">{user?.role?.replace(/_/g, ' ')}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-3 px-1">
            <div
              className="w-8 h-8 shrink-0 rounded flex items-center justify-center text-xs font-bold"
              style={{ background: WHITE_15, color: WHITE }}
            >
              {(user?.email?.[0] ?? '?').toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: WHITE }}>{user?.email}</p>
              <p className="text-[11px] capitalize" style={{ color: WHITE_70 }}>{user?.role?.replace(/_/g, ' ')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Public exports ───────────────────────────────────────────────────────────

export function Sidebar() {
  const w = useWindowWidth()
  const mode = getMode(w)
  if (mode === 'sheet') return null
  const width = mode === 'expanded' ? 'var(--sidebar-w)' : 'var(--sidebar-w-icon)'
  return (
    <TooltipProvider delayDuration={300}>
      <aside className="h-screen shrink-0 overflow-hidden" style={{ width, transition: 'width 200ms ease' }}>
        <SidebarContent mode={mode} />
      </aside>
    </TooltipProvider>
  )
}

export function MobileMenuButton() {
  const [open, setOpen] = useState(false)
  const w = useWindowWidth()
  if (w >= 768) return null
  return (
    <TooltipProvider>
      <>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)' }}
        >
          <Menu size={20} />
        </button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="p-0 w-[240px]" style={{ background: NAVY }}>
            <SidebarContent mode="sheet" onClose={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </>
    </TooltipProvider>
  )
}
