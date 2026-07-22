'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { usePathname, useRouter } from 'next/navigation'
import {
  MessageSquare, FileText, BarChart2, ClipboardCheck,
  Users, Settings, Brain, LogOut, Menu, X, Building2,
  ChevronLeft, ChevronRight, Plus, MessageCircle,
} from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useChatHistory } from '@/lib/chat-history-context'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getAuthUser, clearAuth } from '@/lib/auth'
import { NAV } from '@/lib/nav'
import { hasPermission } from '@company-brain/shared'

const NAV_ICONS: Record<string, React.ElementType> = {
  '/chat':      MessageSquare,
  '/documents': FileText,
  '/analytics': BarChart2,
  '/audit':     ClipboardCheck,
  '/users':     Users,
  '/orgs':      Building2,
  '/settings':  Settings,
}

// ─── Sidebar content ──────────────────────────────────────────────────────────

function SidebarContent({
  collapsed = false,
  onToggle,
  isSheet = false,
  onClose,
}: {
  collapsed?: boolean
  onToggle?: () => void
  isSheet?: boolean
  onClose?: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<ReturnType<typeof getAuthUser>>(null)
  const [logoHovered, setLogoHovered] = useState(false)

  useEffect(() => { setUser(getAuthUser()) }, [])

  const { sessions, loadSession, saveCurrentAsSession } = useChatHistory()

  const visible = NAV.filter((n) => user?.role && hasPermission(user.role, n.permission))
  const initial = (user?.email?.[0] ?? '?').toUpperCase()
  const handleLogout = async () => {
    clearAuth()
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    router.replace('/login')
  }

  const bgActive     = '#2563eb'
  const bgHover      = '#dce9ff'
  const textActive   = '#ffffff'
  const textInactive = '#585f67'

  // Fixed-width icon zone — always flex-centered, no conditional padding.
  // At 64px collapsed width, nav/footer px-2 (8px each side) leaves 48px content = iconZone width,
  // so every icon lands exactly at the sidebar's geometric centre.
  const iconZone: React.CSSProperties = {
    width: 48,
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  }

  // Labels collapse their max-width in sync with the sidebar, then fade out.
  // No layout space is held while hidden, so icons stay perfectly centred.
  const labelStyle: React.CSSProperties = {
    opacity: collapsed ? 0 : 1,
    maxWidth: collapsed ? '0px' : '200px',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    pointerEvents: collapsed ? 'none' : 'auto',
    transition: collapsed
      ? 'max-width 200ms ease, opacity 150ms ease'
      : 'max-width 200ms ease, opacity 150ms ease 60ms',
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#eff4ff', borderRight: '1px solid #c3c6d7' }}>

      {/* Logo — padding-left 16px keeps Brain icon (32px wide) centred: 16 + 16 = 32px = 64px / 2 */}
      <div
        className="flex items-center shrink-0"
        style={{ height: 64, padding: '0 16px', borderBottom: '1px solid #c3c6d7', overflow: 'hidden', gap: 12 }}
      >
        {collapsed && !isSheet ? (
          <button
            onClick={onToggle}
            aria-label="Expand sidebar"
            onMouseEnter={() => setLogoHovered(true)}
            onMouseLeave={() => setLogoHovered(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
            style={{ background: logoHovered ? '#1d4ed8' : '#2563eb', border: 'none', cursor: 'pointer', color: '#ffffff' }}
          >
            {logoHovered ? <ChevronRight size={18} /> : <Brain size={18} />}
          </button>
        ) : (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#2563eb' }}>
            <Brain size={18} color="#ffffff" />
          </div>
        )}

        {isSheet ? (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold" style={{ color: '#004ac6', lineHeight: 1.2 }}>Brain</p>
              <p className="text-xs" style={{ color: '#585f67', opacity: 0.7 }}>AI Agent</p>
            </div>
            <button onClick={onClose} className="p-1 rounded shrink-0" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67' }}>
              <X size={18} />
            </button>
          </>
        ) : (
          <>
            {/* Text stays in DOM and collapses via labelStyle — no reflow jump */}
            <div className="flex-1 min-w-0" style={labelStyle}>
              <p className="text-sm font-bold" style={{ color: '#004ac6', lineHeight: 1.2 }}>Brain</p>
              <p className="text-xs" style={{ color: '#585f67', opacity: 0.7 }}>AI Agent</p>
            </div>
            {onToggle && (
              <span style={{ ...labelStyle, display: 'flex', alignItems: 'center' }}>
                <button
                  onClick={onToggle}
                  aria-label="Collapse sidebar"
                  className="p-1 rounded transition-colors"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#737686', display: 'flex' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#004ac6' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#737686' }}
                >
                  <ChevronLeft size={16} />
                </button>
              </span>
            )}
          </>
        )}
      </div>

      {/* Nav — px-2 (8px each side) + 64px sidebar = 48px content = iconZone width */}
      <nav className="flex flex-col gap-1 flex-1 px-2 pt-3">
        {visible.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = NAV_ICONS[item.href]
          // Same-route Link clicks are a no-op in Next (URL doesn't change), so
          // clicking "Documents" while already inside a folder wouldn't reset
          // the page's local folder-browsing state. Route through ?home=1
          // instead so the documents page can detect it and reset itself.
          const isDocumentsReset = item.href === '/documents' && pathname.startsWith('/documents')
          const linkEl = (
            <Link
              href={(isDocumentsReset ? '/documents?home=1' : item.href) as Route}
              {...(isSheet && onClose ? { onClick: onClose } : {})}
              className="flex items-center rounded-xl"
              style={{
                height: 48,
                background: active ? bgActive : 'transparent',
                color: active ? textActive : textInactive,
                // inset shadow replaces borderLeft — zero layout impact, icon never shifts
                boxShadow: active ? 'inset 2px 0 0 #004ac6' : 'none',
                textDecoration: 'none',
                overflow: 'hidden',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = bgHover }}
              onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span style={iconZone}>
                {Icon && <Icon size={20} aria-hidden />}
              </span>
              <span className="text-sm font-medium" style={isSheet ? { whiteSpace: 'nowrap' } : labelStyle}>
                {item.label}
              </span>
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

          if (item.href === '/chat') {
            return (
              <div key={item.href} className="w-full">
                {linkEl}
                <div style={{ paddingLeft: 48, paddingRight: 8, display: 'flex', flexDirection: 'column', gap: 1, marginTop: 2 }}>
                  <button
                    onClick={() => { saveCurrentAsSession(); router.push('/chat') }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 8px', background: 'none', border: 'none', cursor: 'pointer', color: '#004ac6', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', borderRadius: 8, width: '100%', textAlign: 'left' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#dce9ff' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none' }}
                  >
                    <Plus size={13} /> New Chat
                  </button>
                  {sessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { loadSession(s.id); router.push('/chat') }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 8px', background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', fontSize: 12, fontFamily: 'inherit', borderRadius: 8, width: '100%', textAlign: 'left', overflow: 'hidden' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#dce9ff'; (e.currentTarget as HTMLElement).style.color = '#0b1c30' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = '#585f67' }}
                    >
                      <MessageCircle size={12} style={{ flexShrink: 0, color: '#737686' }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          }

          return <div key={item.href} className="w-full">{linkEl}</div>
        })}
      </nav>

      {/* Footer — same px-2 centering as nav */}
      <div className="flex flex-col gap-2 px-2 pb-6 mt-auto" style={{ borderTop: '1px solid #c3c6d7', paddingTop: 16 }}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center rounded-xl cursor-default" style={{ height: 48, overflow: 'hidden' }}>
              <span style={iconZone}>
                <span
                  className="flex items-center justify-center rounded-full text-xs font-bold"
                  style={{ width: 32, height: 32, background: '#e5eeff', color: '#004ac6', flexShrink: 0 }}
                >
                  {initial}
                </span>
              </span>
              <div className="min-w-0" style={isSheet ? undefined : labelStyle}>
                <p className="text-xs font-semibold truncate" style={{ color: '#0b1c30' }}>{user?.email}</p>
                <p className="text-xs capitalize" style={{ color: '#585f67' }}>{user?.role?.replace(/_/g, ' ')}</p>
              </div>
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
              className="flex items-center rounded-xl w-full"
              style={{ height: 36, background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', overflow: 'hidden', transition: 'color 0.15s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#0b1c30' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#585f67' }}
            >
              <span style={iconZone}>
                <LogOut size={18} aria-hidden />
              </span>
              <span className="text-sm" style={isSheet ? undefined : labelStyle}>Log out</span>
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
  const [collapsed, setCollapsed] = useState(false)
  const width = collapsed ? 64 : 240

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className="h-screen shrink-0 hidden md:block overflow-hidden"
        style={{ width, transition: 'width 200ms ease' }}
      >
        <SidebarContent collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
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
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarContent isSheet onClose={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </>
    </TooltipProvider>
  )
}
