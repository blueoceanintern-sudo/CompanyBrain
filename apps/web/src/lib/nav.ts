import type { Permission } from '@company-brain/shared'

export interface NavItem {
  label: string
  href: string
  permission: Permission
}

export const NAV: NavItem[] = [
  { label: 'Chat',          href: '/chat',      permission: 'queries:submit'   },
  { label: 'Documents',     href: '/documents', permission: 'documents:view'   },
  { label: 'Analytics',     href: '/analytics', permission: 'analytics:view'   },
  { label: 'Audit Log',     href: '/audit',     permission: 'analytics:view'   },
  { label: 'Users',         href: '/users',     permission: 'users:manage'     },
  { label: 'Organisations', href: '/orgs',      permission: 'orgs:manage'      },
  { label: 'Settings',      href: '/settings',  permission: 'users:manage'     },
]

export function routePermission(pathname: string): Permission | null {
  const item = NAV.find((n) => pathname === n.href || pathname.startsWith(n.href + '/'))
  return item?.permission ?? null
}
