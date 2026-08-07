import type { Permission } from '@company-brain/shared'

export interface NavItem {
  label: string
  href: string
  // A single permission, or a list meaning "any of these grants access".
  permission: Permission | Permission[]
}

export const NAV: NavItem[] = [
  { label: 'Chat',          href: '/chat',      permission: 'queries:submit'   },
  { label: 'Documents',     href: '/documents', permission: 'documents:view'   },
  { label: 'Analytics',     href: '/analytics', permission: 'analytics:view'   },
  { label: 'Audit Log',     href: '/audit',     permission: 'audit:view'       },
  { label: 'Users',         href: '/users',     permission: ['users:manage', 'access:manage', 'roles:manage'] },
  { label: 'Organisations', href: '/orgs',      permission: 'orgs:manage'      },
  { label: 'Settings',      href: '/settings',  permission: 'users:manage'     },
]

export function routePermission(pathname: string): Permission | Permission[] | null {
  const item = NAV.find((n) => pathname === n.href || pathname.startsWith(n.href + '/'))
  return item?.permission ?? null
}
