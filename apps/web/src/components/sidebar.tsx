'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { usePathname } from 'next/navigation'
import { MessageSquare, FileText, BarChart2, Shield, Users, Settings, Menu, X, type LucideIcon } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getAuthUser } from '@/lib/auth'

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
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280)
  useEffect(() => {
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
      <div className="flex justify-center py-3" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div
          title={`Plane: ${plane}`}
          className="size-2 rounded-full"
          style={{ background: plane === 'internal' ? 'var(--color-internal)' : 'var(--color-external)' }}
        />
      </div>
    )
  }
  return (
    <div className="mt-auto px-6 py-4" style={{ borderTop: '1px solid var(--color-border)' }}>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-disabled)' }}>
        Knowledge plane
      </h3>
      <div className="flex items-center text-sm">
        <button
          onClick={() => setPlane('internal')}
          style={{ color: plane === 'internal' ? 'var(--color-brand)' : 'var(--color-text-disabled)', fontWeight: plane === 'internal' ? 500 : 400 }}
        >
          internal
        </button>
        <span className="mx-1" style={{ color: 'var(--color-border-strong)' }}>/</span>
        <button
          onClick={() => setPlane('external')}
          style={{ color: plane === 'external' ? 'var(--color-brand)' : 'var(--color-text-disabled)', fontWeight: plane === 'external' ? 500 : 400 }}
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
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg)', borderRight: '1px solid var(--color-border)' }}>
      {/* Sheet header — mobile only */}
      {mode === 'sheet' && (
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Company&apos;s Brain</span>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded" style={{ color: 'var(--color-text-muted)' }}>
            <X size={18} />
          </button>
        </div>
      )}

      {/* Scrollable: nav + recents */}
      <div className="flex-grow flex flex-col pt-4 overflow-y-auto custom-scrollbar">
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
                  justifyContent: isIconOnly ? 'center' : 'flex-start',
                  fontWeight: active ? 500 : 400,
                  color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
                  background: active ? 'var(--color-surface)' : 'transparent',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--color-surface)' }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
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
            <h3 className="px-6 mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-disabled)' }}>
              Recents
            </h3>
            <div className="space-y-0.5 px-3">
              <p className="px-3 py-2 text-sm italic" style={{ color: 'var(--color-text-disabled)' }}>No recent queries</p>
            </div>
          </div>
        )}

        {/* Plane switcher — admins only, pinned to bottom of scroll area */}
        {isAdmin && <PlaneSwitcher iconOnly={isIconOnly} />}
      </div>

      {/* User footer */}
      <div className="p-3" style={{ borderTop: '1px solid var(--color-border)' }}>
        {isIconOnly ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="w-8 h-8 mx-auto rounded flex items-center justify-center text-white text-xs font-bold cursor-default"
                style={{ background: 'var(--color-brand)' }}
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
          <>
            <div className="w-full py-1 px-3 mb-2 rounded text-xs font-bold text-white" style={{ background: 'var(--color-brand)' }}>
              {(user?.email?.[0] ?? '?').toUpperCase()}
            </div>
            <div className="px-1">
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text)' }}>{user?.email}</p>
              <p className="text-[11px] capitalize" style={{ color: 'var(--color-text-muted)' }}>{user?.role?.replace(/_/g, ' ')}</p>
            </div>
          </>
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
          <SheetContent side="left" className="p-0 w-[240px]" style={{ background: 'var(--color-bg)' }}>
            <SidebarContent mode="sheet" onClose={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </>
    </TooltipProvider>
  )
}
