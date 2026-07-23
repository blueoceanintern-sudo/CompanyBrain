'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Users, Shield, UserCheck, MoreVertical, UserPlus, X } from 'lucide-react'
import { useUsers, useInviteUser, useUpdateUserRole, useDeleteUser } from '@/hooks/use-users'
import { useGroups, useSetUserGroups } from '@/hooks/use-groups'
import type { UserSummary } from '@company-brain/shared'
import { getAuthUser } from '@/lib/auth'
import { formatDate } from '@/lib/utils'

interface PendingRoleChange {
  userId: string
  email: string
  currentRole: string
  pendingRole: string
}

interface PendingDelete {
  userId: string
  email: string
}

const ROLE_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  super_admin:     { bg: '#fee2e2', color: '#991b1b', label: 'Super Admin' },
  org_admin:       { bg: '#dbeafe', color: '#1e40af', label: 'Admin' },
  dept_admin:      { bg: '#ede9fe', color: '#6d28d9', label: 'Dept Admin' },
  staff:           { bg: '#f1f5f9', color: '#475569', label: 'Staff' },
  external_client: { bg: '#fed7aa', color: '#c2410c', label: 'External' },
}

const inviteSchema = z.object({
  name: z.string().min(1, 'Required'),
  email: z.string().email('Valid email required'),
  role: z.enum(['org_admin', 'dept_admin', 'staff', 'external_client']),
  temporaryPassword: z.string().min(8, 'At least 8 characters'),
})
type InviteForm = z.infer<typeof inviteSchema>

function initials(str: string) {
  return str.split(/[@.\s]+/).filter(Boolean).map((s) => s[0]).join('').toUpperCase().slice(0, 2)
}

function Skel({ h }: { h: number }) {
  return <div style={{ height: h, background: '#eff4ff', borderRadius: 8, animation: 'cb-skel 1.5s ease-in-out infinite' }} />
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

function RoleConfirmDialog({ pending, onConfirm, onCancel }: { pending: PendingRoleChange; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div role="dialog" onClick={(e) => e.target === e.currentTarget && onCancel()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
      <div style={{ background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 12, padding: 32, width: 'min(400px, 90vw)', boxShadow: '0 10px 30px rgba(0,0,0,0.12)' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#0b1c30', margin: '0 0 12px' }}>Change role?</h2>
        <p style={{ fontSize: 14, color: '#585f67', margin: '0 0 24px', lineHeight: 1.6 }}>
          Set <strong style={{ color: '#0b1c30' }}>{pending.email}</strong> from{' '}
          <strong style={{ color: '#0b1c30' }}>{pending.currentRole.replace(/_/g, ' ')}</strong> to{' '}
          <strong style={{ color: '#0b1c30' }}>{pending.pendingRole.replace(/_/g, ' ')}</strong>?
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button type="button" onClick={onCancel} style={{ height: 40, padding: '0 20px', border: '1px solid #c3c6d7', borderRadius: 8, background: 'transparent', fontSize: 14, cursor: 'pointer', color: '#0b1c30', fontFamily: 'inherit' }}>Cancel</button>
          <button type="button" onClick={onConfirm} style={{ height: 40, padding: '0 20px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#ffffff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Confirm</button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete confirm dialog ────────────────────────────────────────────────────

function DeleteConfirmDialog({ pending, onConfirm, onCancel, isPending }: { pending: PendingDelete; onConfirm: () => void; onCancel: () => void; isPending: boolean }) {
  return (
    <div role="dialog" onClick={(e) => e.target === e.currentTarget && onCancel()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
      <div style={{ background: '#ffffff', border: '1px solid #ffdad6', borderRadius: 12, padding: 32, width: 'min(400px, 90vw)', boxShadow: '0 10px 30px rgba(0,0,0,0.12)' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#ba1a1a', margin: '0 0 12px' }}>Remove user?</h2>
        <p style={{ fontSize: 14, color: '#585f67', margin: '0 0 24px', lineHeight: 1.6 }}>
          <strong style={{ color: '#0b1c30' }}>{pending.email}</strong> will lose access immediately. Their documents and query history will be retained.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button type="button" onClick={onCancel} disabled={isPending} style={{ height: 40, padding: '0 20px', border: '1px solid #c3c6d7', borderRadius: 8, background: 'transparent', fontSize: 14, cursor: 'pointer', color: '#0b1c30', fontFamily: 'inherit' }}>Cancel</button>
          <button type="button" onClick={onConfirm} disabled={isPending} style={{ height: 40, padding: '0 20px', border: 'none', borderRadius: 8, background: '#ba1a1a', color: '#ffffff', fontSize: 14, fontWeight: 500, cursor: isPending ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: isPending ? 0.7 : 1 }}>
            {isPending ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Manage groups dialog ─────────────────────────────────────────────────────

function ManageGroupsDialog({ orgId, user, onClose }: { orgId: string; user: UserSummary; onClose: () => void }) {
  const { data: groups = [], isLoading } = useGroups(orgId)
  const setUserGroupsMut = useSetUserGroups(orgId)
  // user.groups holds names; group names are unique per org
  const [selected, setSelected] = useState<Set<string> | null>(null)

  const initialIds = new Set(groups.filter((g) => (user.groups ?? []).includes(g.name)).map((g) => g.id))
  const current = selected ?? initialIds
  const dirty = selected !== null && (selected.size !== initialIds.size || [...selected].some((id) => !initialIds.has(id)))

  const toggle = (id: string) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  return (
    <div role="dialog" onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div style={{ background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 12, padding: 32, width: 'min(440px, 100%)', boxShadow: '0 10px 30px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: '#0b1c30', margin: '0 0 4px' }}>Groups</h2>
            <p style={{ fontSize: 13, color: '#585f67', margin: 0 }}>{user.email}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', display: 'flex' }}><X size={20} /></button>
        </div>

        {isLoading ? (
          <Skel h={80} />
        ) : groups.length === 0 ? (
          <p style={{ fontSize: 13, color: '#585f67', margin: 0 }}>No groups yet — create them in Settings → Groups.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 280, overflowY: 'auto', border: '1px solid #eff4ff', borderRadius: 8, padding: 4 }}>
            {groups.map((g) => (
              <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', background: current.has(g.id) ? '#eff4ff' : 'transparent' }}>
                <input type="checkbox" checked={current.has(g.id)} onChange={() => toggle(g.id)} style={{ accentColor: '#2563eb' }} />
                <span style={{ fontSize: 13, color: '#0b1c30' }}>{g.name}</span>
                <span style={{ fontSize: 11, color: '#585f67' }}>{g.memberCount} member{g.memberCount === 1 ? '' : 's'}</span>
              </label>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button onClick={onClose} style={{ height: 40, padding: '0 20px', border: '1px solid #c3c6d7', borderRadius: 8, background: 'transparent', fontSize: 14, cursor: 'pointer', color: '#0b1c30', fontFamily: 'inherit' }}>Cancel</button>
          <button
            disabled={!dirty || setUserGroupsMut.isPending}
            onClick={() => setUserGroupsMut.mutate({ userId: user.id, groupIds: [...current] }, { onSuccess: onClose })}
            style={{ height: 40, padding: '0 20px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#ffffff', fontSize: 14, fontWeight: 500, cursor: (!dirty || setUserGroupsMut.isPending) ? 'not-allowed' : 'pointer', opacity: (!dirty || setUserGroupsMut.isPending) ? 0.6 : 1, fontFamily: 'inherit' }}
          >
            {setUserGroupsMut.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Invite dialog ────────────────────────────────────────────────────────────

function InviteDialog({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const invite = useInviteUser(orgId)
  const { data: groups = [] } = useGroups(orgId)
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set())
  const { register, handleSubmit, watch, formState: { errors } } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'staff' },
  })

  const role = watch('role')
  const canJoinGroups = role !== 'external_client' && groups.length > 0

  const toggleGroup = (id: string) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const inputBase: React.CSSProperties = {
    width: '100%', height: 44, padding: '0 16px', border: '1px solid #c3c6d7', borderRadius: 12,
    background: '#ffffff', fontSize: 14, color: '#0b1c30', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const,
  }

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div style={{ background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 12, width: 'min(440px, 100%)', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #c3c6d7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 20, fontWeight: 600, color: '#0b1c30', margin: 0 }}>Invite User</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', display: 'flex' }}><X size={20} /></button>
        </div>
        <form
          onSubmit={handleSubmit((data) =>
            invite.mutate(
              {
                ...data,
                ...(data.role !== 'external_client' && selectedGroups.size > 0
                  ? { groupIds: [...selectedGroups] }
                  : {}),
              },
              { onSuccess: onClose }
            )
          )}
          style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: '#434655' }}>Name</label>
            <input type="text" {...register('name')} placeholder="Jane Doe" style={{ ...inputBase, borderColor: errors.name ? '#ba1a1a' : '#c3c6d7' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = errors.name ? '#ba1a1a' : '#c3c6d7'; e.currentTarget.style.boxShadow = 'none' }}
            />
            {errors.name && <p style={{ fontSize: 12, color: '#ba1a1a', margin: 0 }}>{errors.name.message}</p>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: '#434655' }}>Email Address</label>
            <input type="email" {...register('email')} placeholder="name@company.com" style={{ ...inputBase, borderColor: errors.email ? '#ba1a1a' : '#c3c6d7' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = errors.email ? '#ba1a1a' : '#c3c6d7'; e.currentTarget.style.boxShadow = 'none' }}
            />
            {errors.email && <p style={{ fontSize: 12, color: '#ba1a1a', margin: 0 }}>{errors.email.message}</p>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: '#434655' }}>Assign Role</label>
            <select {...register('role')} style={{ ...inputBase, appearance: 'none' as const, cursor: 'pointer' }}>
              <option value="staff">Staff</option>
              <option value="dept_admin">Dept Admin</option>
              <option value="org_admin">Org Admin</option>
              <option value="external_client">External Client</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: '#434655' }}>Temporary Password</label>
            <input type="password" {...register('temporaryPassword')} placeholder="Min. 8 characters" style={{ ...inputBase, borderColor: errors.temporaryPassword ? '#ba1a1a' : '#c3c6d7' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = errors.temporaryPassword ? '#ba1a1a' : '#c3c6d7'; e.currentTarget.style.boxShadow = 'none' }}
            />
            {errors.temporaryPassword && <p style={{ fontSize: 12, color: '#ba1a1a', margin: 0 }}>{errors.temporaryPassword.message}</p>}
          </div>
          {canJoinGroups && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 14, fontWeight: 500, color: '#434655' }}>Add to Groups <span style={{ fontWeight: 400, color: '#585f67' }}>(optional)</span></label>
              <div style={{ border: '1px solid #c3c6d7', borderRadius: 12, padding: 8, maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {groups.map((g) => (
                  <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: selectedGroups.has(g.id) ? '#eff4ff' : 'transparent' }}>
                    <input type="checkbox" checked={selectedGroups.has(g.id)} onChange={() => toggleGroup(g.id)} style={{ accentColor: '#2563eb' }} />
                    <span style={{ fontSize: 13, color: '#0b1c30' }}>{g.name}</span>
                    <span style={{ fontSize: 11, color: '#585f67' }}>{g.memberCount} member{g.memberCount === 1 ? '' : 's'}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, paddingTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, height: 44, border: '1px solid #c3c6d7', borderRadius: 12, background: 'transparent', fontSize: 14, cursor: 'pointer', color: '#585f67', fontFamily: 'inherit' }}>Cancel</button>
            <button type="submit" disabled={invite.isPending} style={{ flex: 1, height: 44, border: 'none', borderRadius: 12, background: '#2563eb', color: '#ffffff', fontSize: 14, fontWeight: 500, cursor: invite.isPending ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {invite.isPending ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const user = getAuthUser()
  const orgId = user?.orgId ?? ''
  const [showInvite, setShowInvite] = useState(false)
  const [pendingRole, setPendingRole] = useState<PendingRoleChange | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [groupsFor, setGroupsFor] = useState<UserSummary | null>(null)
  const [cancelKey, setCancelKey] = useState(0)
  const [page, setPage] = useState(1)

  const { data: users = [], isLoading } = useUsers(orgId)
  const updateRole = useUpdateUserRole(orgId)
  const deleteUserMut = useDeleteUser(orgId)

  const totalUsers = users.length
  const adminCount = users.filter((u) => u.role === 'org_admin' || u.role === 'super_admin').length
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const activeCount = users.filter((u) => u.lastActiveAt && new Date(u.lastActiveAt).getTime() >= thirtyDaysAgo).length

  const PAGE_SIZE = 10
  const pageSlice = users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top nav */}
      <header style={{ height: '64px', borderBottom: '1px solid #c3c6d7', background: '#f8f9ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0, position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#004ac6' }}>Users</span>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: 32, background: '#ffffff' }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>

          {/* Section header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 600, color: '#0b1c30', margin: '0 0 4px', letterSpacing: '-0.01em' }}>Manage Organization</h2>
              <p style={{ fontSize: 14, color: '#585f67', margin: 0 }}>Add and manage access permissions for your team members.</p>
            </div>
            <button
              onClick={() => setShowInvite(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.9' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
            >
              <UserPlus size={18} /> Invite User
            </button>
          </div>

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {[
              { icon: Users, label: 'Total Users', value: isLoading ? '—' : totalUsers.toLocaleString(), iconColor: '#004ac6' },
              { icon: Shield, label: 'Admins', value: isLoading ? '—' : String(adminCount), iconColor: '#943700' },
              { icon: UserCheck, label: 'Active This Month', value: isLoading ? '—' : activeCount.toLocaleString(), iconColor: '#16a34a' },
            ].map(({ icon: Icon, label, value, iconColor }) => (
              <div key={label} style={{ border: '1px solid #c3c6d7', borderRadius: 12, padding: 24, background: '#ffffff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <Icon size={20} color={iconColor} />
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#585f67' }}>{label}</span>
                </div>
                <span style={{ fontSize: 24, fontWeight: 600, color: '#0b1c30' }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Table */}
          <div style={{ border: '1px solid #c3c6d7', borderRadius: 12, overflow: 'hidden' }}>
            <table aria-label="Users" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, background: '#ffffff' }}>
              <thead style={{ background: '#eff4ff', borderBottom: '1px solid #c3c6d7' }}>
                <tr>
                  {['Name', 'Email', 'Role', 'Groups', 'Joined', 'Last Updated', 'Actions'].map((h, i) => (
                    <th key={h} style={{ padding: '16px 24px', textAlign: i === 6 ? 'right' : 'left', fontSize: 11, fontWeight: 500, color: '#585f67', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} style={{ padding: '12px 24px' }}><Skel h={28} /></td></tr>
                ))}
                {!isLoading && users.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center' }}>
                    <p style={{ fontSize: 18, fontWeight: 500, color: '#0b1c30', margin: '0 0 8px' }}>No users yet</p>
                    <p style={{ fontSize: 14, color: '#585f67', margin: 0 }}>Invite team members to get started.</p>
                  </td></tr>
                )}
                {pageSlice.map((u) => {
                  const rs = ROLE_STYLE[u.role] ?? ROLE_STYLE['staff']!
                  const isSelf = u.id === user?.id
                  const isProtected = isSelf || u.role === 'super_admin'
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#fafbff' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#dbe1ff', color: '#00174b', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #c3c6d7' }}>
                            {initials(u.name ?? u.email ?? 'U')}
                          </div>
                          <span style={{ fontWeight: 500, color: '#0b1c30' }}>{u.name ?? u.email?.split('@')[0] ?? 'User'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', color: '#585f67' }}>{u.email}</td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ display: 'inline-block', padding: '4px 12px', background: rs.bg, color: rs.color, borderRadius: 9999, fontSize: 12, fontWeight: 500 }}>
                          {rs.label}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        {(u.groups ?? []).length === 0 ? (
                          <span style={{ color: '#c3c6d7' }}>—</span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 220 }}>
                            {u.groups.map((name) => (
                              <span key={name} style={{ padding: '2px 8px', background: '#e5eeff', color: '#004ac6', borderRadius: 9999, fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}>
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '16px 24px', color: '#585f67' }}>{formatDate(u.createdAt)}</td>
                      <td style={{ padding: '16px 24px', color: '#585f67' }}>{formatDate(u.updatedAt)}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
                          {isProtected ? (
                            <span style={{ display: 'inline-block', padding: '0 8px', height: 32, lineHeight: '32px', border: '1px solid #e5eeff', borderRadius: 6, background: '#f8f9ff', fontSize: 12, color: '#737686' }}>
                              {isSelf ? 'You' : 'Protected'}
                            </span>
                          ) : (
                            <select
                              key={u.id + '-' + cancelKey}
                              defaultValue={u.role}
                              aria-label={`Change role for ${u.email}`}
                              onChange={(e) => {
                                const newRole = e.target.value
                                if (newRole !== u.role) {
                                  setPendingRole({ userId: u.id, email: u.email, currentRole: u.role, pendingRole: newRole })
                                }
                              }}
                              style={{ height: 32, padding: '0 8px', border: '1px solid #c3c6d7', borderRadius: 6, background: '#ffffff', fontSize: 12, color: '#0b1c30', cursor: 'pointer', fontFamily: 'inherit', outline: 'none' }}
                            >
                              <option value="staff">Staff</option>
                              <option value="dept_admin">Dept Admin</option>
                              <option value="org_admin">Org Admin</option>
                              <option value="external_client">External Client</option>
                            </select>
                          )}
                          {(u.role !== 'external_client' || !isProtected) && (
                            <div style={{ position: 'relative' }}>
                              <button
                                onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === u.id ? null : u.id) }}
                                aria-label={`Actions for ${u.email}`}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', display: 'flex', padding: 4, borderRadius: 4 }}
                              >
                                <MoreVertical size={16} />
                              </button>
                              {menuOpenId === u.id && (
                                <>
                                  <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setMenuOpenId(null)} />
                                  <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 50, minWidth: 160, overflow: 'hidden' }}>
                                    {u.role !== 'external_client' && (
                                      <button
                                        onClick={() => { setMenuOpenId(null); setGroupsFor(u) }}
                                        style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: 14, color: '#0b1c30', cursor: 'pointer', fontFamily: 'inherit', display: 'block' }}
                                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#eff4ff' }}
                                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none' }}
                                      >
                                        Manage groups
                                      </button>
                                    )}
                                    {!isProtected && (
                                      <button
                                        onClick={() => { setMenuOpenId(null); setPendingDelete({ userId: u.id, email: u.email }) }}
                                        style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: 14, color: '#ba1a1a', cursor: 'pointer', fontFamily: 'inherit', display: 'block' }}
                                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#fff1f0' }}
                                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none' }}
                                      >
                                        Remove user
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Pagination */}
            <div style={{ padding: '16px 24px', background: '#eff4ff', borderTop: '1px solid #c3c6d7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#585f67' }}>
                Showing {Math.min(PAGE_SIZE, users.length)} of {users.length} users
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  style={{ width: 36, height: 36, border: '1px solid #c3c6d7', borderRadius: 8, background: page === 1 ? 'transparent' : '#ffffff', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#585f67' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  style={{ width: 36, height: 36, border: '1px solid #c3c6d7', borderRadius: 8, background: page >= totalPages ? 'transparent' : '#ffffff', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#585f67' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showInvite && <InviteDialog orgId={orgId} onClose={() => setShowInvite(false)} />}
      {groupsFor && <ManageGroupsDialog orgId={orgId} user={groupsFor} onClose={() => setGroupsFor(null)} />}
      {pendingRole && (
        <RoleConfirmDialog
          pending={pendingRole}
          onConfirm={() => {
            updateRole.mutate({ userId: pendingRole.userId, role: pendingRole.pendingRole })
            setPendingRole(null)
          }}
          onCancel={() => {
            setCancelKey((k) => k + 1)
            setPendingRole(null)
          }}
        />
      )}
      {pendingDelete && (
        <DeleteConfirmDialog
          pending={pendingDelete}
          isPending={deleteUserMut.isPending}
          onConfirm={() => {
            deleteUserMut.mutate(pendingDelete.userId, { onSettled: () => setPendingDelete(null) })
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
      <style>{`@keyframes cb-skel { 0%,100%{opacity:.5}50%{opacity:1} }`}</style>
    </div>
  )
}
