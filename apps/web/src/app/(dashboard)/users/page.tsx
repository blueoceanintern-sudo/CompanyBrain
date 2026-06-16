'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Users, Shield, UserCheck, MoreVertical, UserPlus, X } from 'lucide-react'
import { useUsers, useInviteUser, useUpdateUserRole } from '@/hooks/use-users'
import { getAuthUser } from '@/lib/auth'
import { formatDate } from '@/lib/utils'

interface PendingRoleChange {
  userId: string
  email: string
  currentRole: string
  pendingRole: string
}

const ROLE_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  super_admin:     { bg: '#fee2e2', color: '#991b1b', label: 'Super Admin' },
  org_admin:       { bg: '#dbeafe', color: '#1e40af', label: 'Admin' },
  dept_admin:      { bg: '#ede9fe', color: '#6d28d9', label: 'Dept Admin' },
  staff:           { bg: '#f1f5f9', color: '#475569', label: 'Staff' },
  external_client: { bg: '#fed7aa', color: '#c2410c', label: 'External' },
}

const inviteSchema = z.object({
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

// ─── Invite dialog ────────────────────────────────────────────────────────────

function InviteDialog({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const invite = useInviteUser(orgId)
  const { register, handleSubmit, formState: { errors } } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'staff' },
  })

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
        <form onSubmit={handleSubmit((data) => invite.mutate(data, { onSuccess: onClose }))} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
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
  const [cancelKey, setCancelKey] = useState(0)
  const [page, setPage] = useState(1)

  const { data: users = [], isLoading } = useUsers(orgId)
  const updateRole = useUpdateUserRole(orgId)

  const totalUsers = users.length
  const adminCount = users.filter((u) => u.role === 'org_admin' || u.role === 'super_admin').length
  const activeCount = users.length

  const PAGE_SIZE = 10
  const pageSlice = users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top nav */}
      <header style={{ height: 50, borderBottom: '1px solid #c3c6d7', background: '#f8f9ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0, position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#004ac6' }}>Users</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 14, color: '#434655' }}>Status: Internal</span>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', display: 'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </button>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', display: 'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </button>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#dce9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#004ac6', border: '1px solid #c3c6d7' }}>
            {user ? initials(user.email ?? 'A') : 'A'}
          </div>
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
                  {['Name', 'Email', 'Role', 'Joined Date', 'Actions'].map((h, i) => (
                    <th key={h} style={{ padding: '16px 24px', textAlign: i === 4 ? 'right' : 'left', fontSize: 11, fontWeight: 500, color: '#585f67', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} style={{ padding: '12px 24px' }}><Skel h={28} /></td></tr>
                ))}
                {!isLoading && users.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 48, textAlign: 'center' }}>
                    <p style={{ fontSize: 18, fontWeight: 500, color: '#0b1c30', margin: '0 0 8px' }}>No users yet</p>
                    <p style={{ fontSize: 14, color: '#585f67', margin: 0 }}>Invite team members to get started.</p>
                  </td></tr>
                )}
                {pageSlice.map((u) => {
                  const rs = ROLE_STYLE[u.role] ?? ROLE_STYLE['staff']!
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#fafbff' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#dbe1ff', color: '#00174b', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #c3c6d7' }}>
                            {initials(u.email ?? 'U')}
                          </div>
                          <span style={{ fontWeight: 500, color: '#0b1c30' }}>{u.email?.split('@')[0] ?? 'User'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', color: '#585f67' }}>{u.email}</td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ display: 'inline-block', padding: '4px 12px', background: rs.bg, color: rs.color, borderRadius: 9999, fontSize: 12, fontWeight: 500 }}>
                          {rs.label}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', color: '#585f67' }}>{formatDate(u.createdAt)}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
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
                          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', display: 'flex' }}>
                            <MoreVertical size={16} />
                          </button>
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
      <style>{`@keyframes cb-skel { 0%,100%{opacity:.5}50%{opacity:1} }`}</style>
    </div>
  )
}
