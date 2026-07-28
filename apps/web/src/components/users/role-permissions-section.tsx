'use client'

import { useState } from 'react'
import { Shield, Lock, ChevronRight, X } from 'lucide-react'
import { useRoles, useUpdateRolePermissions } from '@/hooks/use-roles'
import type { Permission, UserRole } from '@company-brain/shared'

// Display order for the role list; super_admin is shown but locked.
const ROLE_ORDER: UserRole[] = ['super_admin', 'org_admin', 'dept_admin', 'staff', 'external_client']

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  org_admin: 'Organisation Admin',
  dept_admin: 'Department Admin',
  staff: 'Staff',
  external_client: 'External Client',
}

const ROLE_STYLE: Record<UserRole, { bg: string; color: string }> = {
  super_admin: { bg: '#fee2e2', color: '#991b1b' },
  org_admin: { bg: '#dbeafe', color: '#1e40af' },
  dept_admin: { bg: '#ede9fe', color: '#6d28d9' },
  staff: { bg: '#f1f5f9', color: '#475569' },
  external_client: { bg: '#fed7aa', color: '#c2410c' },
}

const PERMISSION_LABEL: Record<string, { label: string; description: string }> = {
  'documents:manage': { label: 'Manage documents & folders', description: 'Upload, edit, archive and delete documents; create and manage folders' },
  'documents:view': { label: 'View documents', description: 'Browse and preview the knowledge base' },
  'analytics:view': { label: 'View analytics', description: 'See usage, coverage and query dashboards' },
  'audit:view': { label: 'View audit log', description: 'Read and export the compliance audit trail' },
  'users:manage': { label: 'Manage users', description: 'Invite users, assign roles, and remove members' },
  'access:manage': { label: 'Manage permissions & groups', description: 'Edit role permissions, groups, and compartment access' },
  'billing:manage': { label: 'Manage billing', description: 'Subscriptions, payouts and external pricing' },
  'queries:submit': { label: 'Ask questions', description: 'Submit queries to the knowledge base' },
  'external-access:subscribe': { label: 'Subscribe to external access', description: 'Purchase access to the external knowledge plane' },
  'orgs:manage': { label: 'Manage organizations', description: 'Platform-level organisation administration' },
}

function permLabel(p: string) {
  return PERMISSION_LABEL[p] ?? { label: p, description: '' }
}

function Skel({ h }: { h: number }) {
  return <div style={{ height: h, background: '#eff4ff', borderRadius: 8, animation: 'cb-skel 1.5s ease-in-out infinite' }} />
}

// ─── Edit dialog ────────────────────────────────────────────────────────────────

function EditRoleDialog({
  orgId,
  role,
  current,
  editablePermissions,
  isOwnRole,
  onClose,
}: {
  orgId: string
  role: UserRole
  current: Permission[]
  editablePermissions: Permission[]
  isOwnRole: boolean
  onClose: () => void
}) {
  const update = useUpdateRolePermissions(orgId)
  const initial = new Set(current)
  const [selected, setSelected] = useState<Set<Permission>>(new Set(current))

  const dirty =
    selected.size !== initial.size || [...selected].some((p) => !initial.has(p))

  const toggle = (p: Permission) => {
    // Guard: the actor can't strip access:manage from their own role (it's what
    // grants access to this editor).
    if (p === 'access:manage' && isOwnRole) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  const rs = ROLE_STYLE[role]

  return (
    <div role="dialog" onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div style={{ background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 12, width: 'min(480px, 100%)', boxShadow: '0 10px 30px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #c3c6d7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: '#0b1c30', margin: 0 }}>Edit permissions</h3>
            <span style={{ padding: '3px 10px', background: rs.bg, color: rs.color, borderRadius: 9999, fontSize: 12, fontWeight: 500 }}>{ROLE_LABEL[role]}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', display: 'flex' }}><X size={20} /></button>
        </div>

        <div style={{ padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {editablePermissions.map((p) => {
            const { label, description } = permLabel(p)
            const checked = selected.has(p)
            const locked = p === 'access:manage' && isOwnRole
            return (
              <label key={p} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 12px', borderRadius: 8, cursor: locked ? 'not-allowed' : 'pointer', background: checked ? '#eff4ff' : 'transparent' }}>
                <input type="checkbox" checked={checked} disabled={locked} onChange={() => toggle(p)} style={{ accentColor: '#2563eb', marginTop: 2 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#0b1c30' }}>{label}</span>
                  <span style={{ fontSize: 12, color: '#585f67' }}>{description}</span>
                  {locked && <span style={{ fontSize: 11, color: '#c2410c' }}>You can’t remove this from your own role.</span>}
                </div>
              </label>
            )
          })}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #c3c6d7', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button onClick={onClose} style={{ height: 40, padding: '0 20px', border: '1px solid #c3c6d7', borderRadius: 8, background: 'transparent', fontSize: 14, cursor: 'pointer', color: '#0b1c30', fontFamily: 'inherit' }}>Cancel</button>
          <button
            disabled={!dirty || update.isPending}
            onClick={() => update.mutate({ role, permissions: [...selected] }, { onSuccess: onClose })}
            style={{ height: 40, padding: '0 20px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#ffffff', fontSize: 14, fontWeight: 500, cursor: (!dirty || update.isPending) ? 'not-allowed' : 'pointer', opacity: (!dirty || update.isPending) ? 0.6 : 1, fontFamily: 'inherit' }}
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function RolePermissionsSection({ orgId, canManage, currentRole }: { orgId: string; canManage: boolean; currentRole?: UserRole | undefined }) {
  const { data, isLoading } = useRoles(orgId)
  const [editing, setEditing] = useState<UserRole | null>(null)

  if (isLoading) {
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[0, 1, 2, 3, 4].map((i) => <Skel key={i} h={64} />)}</div>
  }
  if (!data) return null

  const editableRoles = new Set(data.editableRoles)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#0b1c30', margin: '0 0 4px' }}>Roles &amp; Permissions</h2>
        <p style={{ fontSize: 14, color: '#585f67', margin: 0 }}>Control what each role can do. Select a role to edit its permissions.</p>
      </div>

      <div style={{ border: '1px solid #c3c6d7', borderRadius: 12, overflow: 'hidden' }}>
        {ROLE_ORDER.filter((r) => data.matrix[r] !== undefined).map((role, idx) => {
          const perms = data.matrix[role] ?? []
          const isEditable = canManage && editableRoles.has(role)
          const rs = ROLE_STYLE[role]
          return (
            <button
              key={role}
              disabled={!isEditable}
              onClick={() => isEditable && setEditing(role)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                padding: '16px 20px', background: '#ffffff', border: 'none',
                borderTop: idx === 0 ? 'none' : '1px solid #f1f5f9',
                cursor: isEditable ? 'pointer' : 'default', textAlign: 'left', fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => { if (isEditable) (e.currentTarget as HTMLElement).style.background = '#fafbff' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#ffffff' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: rs.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Shield size={18} color={rs.color} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#0b1c30' }}>{ROLE_LABEL[role]}</span>
                    {!editableRoles.has(role) && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 8px', background: '#f8f9ff', border: '1px solid #e5eeff', borderRadius: 9999, fontSize: 11, color: '#737686' }}>
                        <Lock size={11} /> Locked
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 13, color: '#585f67' }}>
                    {perms.length} permission{perms.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
              {isEditable && <ChevronRight size={18} color="#c3c6d7" />}
            </button>
          )
        })}
      </div>

      {editing && (
        <EditRoleDialog
          orgId={orgId}
          role={editing}
          current={data.matrix[editing] ?? []}
          editablePermissions={data.editablePermissions}
          isOwnRole={editing === currentRole}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
