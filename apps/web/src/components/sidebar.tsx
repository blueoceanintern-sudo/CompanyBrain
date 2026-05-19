'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  MessageSquare, FileText, BarChart2, Shield, Users, Settings, Menu, X, type LucideIcon,
} from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { getAuthUser, clearAuth } from '@/lib/auth'
import { initials } from '@/lib/utils'
import { MOCK_USER } from '@/lib/mock-data'

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
      <div
        className="flex justify-center py-3 border-t"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div
          title={`Plane: ${plane}`}
          className="size-2 rounded-full cursor-default"
          style={{ background: plane === 'internal' ? 'var(--color-internal)' : 'var(--color-external)' }}
        />
      </div>
    )
  }
  return (
    <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
      <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>Knowledge plane</p>
      <div
        className="flex rounded-md overflow-hidden border text-xs font-medium"
        style={{ borderColor: 'var(--color-border)', height: 28 }}
      >
        {(['internal', 'external'] as Plane[]).map((p) => {
          const active = plane === p
          return (
            <button
              key={p}
              onClick={() => setPlane(p)}
              className="flex-1 capitalize transition-colors"
              style={{
                background: active
                  ? p === 'internal' ? 'var(--color-internal-subtle)' : 'var(--color-external-subtle)'
                  : 'transparent',
                color: active
                  ? p === 'internal' ? 'var(--color-internal)' : 'var(--color-external)'
                  : 'var(--color-text-muted)',
              }}
            >
              {p}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Nav content (shared between fixed sidebar and Sheet) ────────────────────

function SidebarContent({ mode, onClose }: { mode: Mode; onClose?: () => void }) {
  const pathname = usePathname()
  const user = getAuthUser() ?? MOCK_USER
  const isIconOnly = mode === 'icon-only'
  const visible = NAV.filter((n) => n.roles.includes(user.role))
  const isAdmin = user.role === 'super_admin' || user.role === 'org_admin'

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)' }}>
      {/* Logo row */}
      <div
        className="flex items-center shrink-0 border-b"
        style={{ height: 'var(--header-h)', borderColor: 'var(--color-border)', padding: isIconOnly ? '0' : '0 var(--space-4)', justifyContent: isIconOnly ? 'center' : 'space-between' }}
      >
        {!isIconOnly && (
          <span className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>
            Company&apos;s Brain
          </span>
        )}
        {mode === 'sheet' && onClose && (
          <button onClick={onClose} aria-label="Close navigation" className="flex items-center p-1 rounded" style={{ color: 'var(--color-text-muted)' }}>
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto py-3">
        {visible.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          const linkEl = (
            <Link
              href={item.href}
              {...(mode === 'sheet' && onClose ? { onClick: onClose } : {})}
              className="flex items-center gap-3 transition-colors duration-200"
              style={{
                height: 'var(--sidebar-item-h)',
                padding: isIconOnly ? '0' : '0 var(--space-4)',
                justifyContent: isIconOnly ? 'center' : 'flex-start',
                color: active ? 'var(--color-brand)' : 'var(--color-text-muted)',
                background: active ? 'var(--color-brand-subtle)' : 'transparent',
                borderLeft: active && !isIconOnly ? '2px solid var(--color-brand)' : '2px solid transparent',
                textDecoration: 'none',
                fontSize: 'var(--text-sm)',
                fontWeight: active ? 'var(--font-medium)' : 'var(--font-normal)',
              }}
              onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'var(--color-brand-subtle)' } }}
              onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent' } }}
            >
              <item.icon size={16} aria-hidden />
              {!isIconOnly && <span>{item.label}</span>}
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

      {/* Plane switcher */}
      {isAdmin && <PlaneSwitcher iconOnly={isIconOnly} />}

      {/* User footer */}
      <div
        className="flex items-center shrink-0 gap-3 border-t"
        style={{
          padding: isIconOnly ? 'var(--space-3) 0' : 'var(--space-3) var(--space-4)',
          borderColor: 'var(--color-border)',
          justifyContent: isIconOnly ? 'center' : 'flex-start',
        }}
      >
        {isIconOnly ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Avatar className="size-8 cursor-default" style={{ background: 'var(--color-brand-subtle)' }}>
                <AvatarFallback className="text-xs font-medium" style={{ color: 'var(--color-brand)', background: 'var(--color-brand-subtle)' }}>
                  {initials(user.email)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{user.email}</p>
              <p className="opacity-60 text-xs">{user.role.replace(/_/g, ' ')}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <>
            <Avatar className="size-8 shrink-0" style={{ background: 'var(--color-brand-subtle)' }}>
              <AvatarFallback className="text-xs font-medium" style={{ color: 'var(--color-brand)', background: 'var(--color-brand-subtle)' }}>
                {initials(user.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{user.email}</p>
              <p className="text-xs capitalize" style={{ color: 'var(--color-text-muted)' }}>{user.role.replace(/_/g, ' ')}</p>
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
      <aside
        className="fixed left-0 top-0 h-screen overflow-hidden z-20"
        style={{ width, transition: 'width 200ms ease' }}
      >
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
          className="flex items-center p-0"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)' }}
        >
          <Menu size={20} />
        </button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="p-0 w-[260px]" style={{ background: 'var(--color-surface)' }}>
            <SidebarContent mode="sheet" onClose={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </>
    </TooltipProvider>
  )
}

export function useSidebarWidth() {
  const w = useWindowWidth()
  const mode = getMode(w)
  return mode === 'expanded' ? 'var(--sidebar-w)' : mode === 'icon-only' ? 'var(--sidebar-w-icon)' : '0px'
}
