'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useUsers, useInviteUser, useUpdateUserRole } from '@/hooks/use-users'
import { getAuthUser } from '@/lib/auth'
import { formatDate } from '@/lib/utils'

const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  super_admin:     { bg: 'var(--color-danger-subtle)',   color: 'var(--color-danger)'   },
  org_admin:       { bg: 'var(--color-brand-subtle)',    color: 'var(--color-brand)'    },
  dept_admin:      { bg: 'var(--color-internal-subtle)', color: 'var(--color-internal)' },
  staff:           { bg: 'var(--color-surface)',          color: 'var(--color-text-muted)' },
  external_client: { bg: 'var(--color-external-subtle)', color: 'var(--color-external)' },
}

const inviteSchema = z.object({
  email: z.string().email('Valid email required'),
  role: z.enum(['org_admin', 'dept_admin', 'staff', 'external_client']),
  temporaryPassword: z.string().min(8, 'At least 8 characters'),
})

type InviteForm = z.infer<typeof inviteSchema>

function Skeleton({ h }: { h: number }) {
  return <div style={{ height: h, background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', animation: 'cb-skel 1.5s ease-in-out infinite' }}>
    <style>{`@keyframes cb-skel { 0%,100% { opacity:.5 } 50% { opacity:1 } }`}</style>
  </div>
}

function InviteDialog({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const invite = useInviteUser(orgId)
  const { register, handleSubmit, formState: { errors } } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'staff' },
  })

  const onSubmit = (data: InviteForm) => {
    invite.mutate(data, { onSuccess: onClose })
  }

  const input: React.CSSProperties = {
    width: '100%', height: 'var(--input-h)', padding: '0 var(--space-3)',
    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
    background: 'var(--color-surface-raised)', color: 'var(--color-text)', fontSize: 'var(--text-sm)',
  }

  return (
    <div
      role="dialog"
      aria-labelledby="invite-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'oklch(0% 0 0 / 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
    >
      <div style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-8)', width: 'min(440px, 90vw)', boxShadow: 'var(--shadow-lg)' }}>
        <h2 id="invite-title" style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-6)' }}>Invite user</h2>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', marginBottom: 'var(--space-2)' }}>Email</label>
            <input type="email" {...register('email')} style={{ ...input, borderColor: errors.email ? 'var(--color-danger)' : 'var(--color-border)' }} placeholder="user@company.com" />
            {errors.email && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)', margin: '2px 0 0' }}>{errors.email.message}</p>}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', marginBottom: 'var(--space-2)' }}>Role</label>
            <select {...register('role')} style={input}>
              <option value="staff">Staff</option>
              <option value="dept_admin">Dept Admin</option>
              <option value="org_admin">Org Admin</option>
              <option value="external_client">External Client</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', marginBottom: 'var(--space-2)' }}>Temporary password</label>
            <input type="password" {...register('temporaryPassword')} style={{ ...input, borderColor: errors.temporaryPassword ? 'var(--color-danger)' : 'var(--color-border)' }} placeholder="Min. 8 characters" />
            {errors.temporaryPassword && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)', margin: '2px 0 0' }}>{errors.temporaryPassword.message}</p>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
            <button type="button" onClick={onClose} style={{ height: 'var(--input-h)', padding: '0 var(--space-5)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', fontSize: 'var(--text-sm)', cursor: 'pointer', color: 'var(--color-text)' }}>Cancel</button>
            <button type="submit" disabled={invite.isPending} style={{ height: 'var(--input-h)', padding: '0 var(--space-5)', border: 'none', borderRadius: 'var(--radius-md)', background: 'var(--color-brand)', color: 'var(--color-brand-fg)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', cursor: invite.isPending ? 'not-allowed' : 'pointer' }}>
              {invite.isPending ? 'Sending…' : 'Send invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function UsersPage() {
  const user = getAuthUser()
  const orgId = user?.orgId ?? ''
  const [showInvite, setShowInvite] = useState(false)

  const { data: users = [], isLoading } = useUsers(orgId)
  const updateRole = useUpdateUserRole(orgId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ height: 'var(--header-h)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--space-8)', position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 10, flexShrink: 0 }}>
        <h1 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>Users</h1>
        <button
          onClick={() => setShowInvite(true)}
          style={{ height: 'var(--input-h)', padding: '0 var(--space-4)', border: 'none', borderRadius: 'var(--radius-md)', background: 'var(--color-brand)', color: 'var(--color-brand-fg)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', cursor: 'pointer' }}
        >
          Invite user
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-8)' }}>
        <div style={{ width: 'min(900px, 100%)', margin: '0 auto' }}>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={40} />)}
            </div>
          ) : (
            <table aria-label="Users" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)', background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Email', 'Role', 'Joined', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '0 var(--space-4)', height: 'var(--row-height-default)', textAlign: 'left', fontWeight: 'var(--font-medium)', color: 'var(--color-text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                    <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-medium)', margin: '0 0 var(--space-2)' }}>No users yet</p>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: 0 }}>Invite team members to get started.</p>
                  </td></tr>
                )}
                {users.map((u) => {
                  const rs = ROLE_STYLE[u.role] ?? ROLE_STYLE['staff']!
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '0 var(--space-4)', height: 'var(--row-height-default)', fontWeight: 'var(--font-medium)' }}>{u.email}</td>
                      <td style={{ padding: '0 var(--space-4)', height: 'var(--row-height-default)' }}>
                        <span style={{ display: 'inline-block', padding: '1px var(--space-2)', background: rs.bg, color: rs.color, borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)' }}>
                          {u.role.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '0 var(--space-4)', height: 'var(--row-height-default)', color: 'var(--color-text-muted)', width: 120 }}>{formatDate(u.createdAt)}</td>
                      <td style={{ padding: '0 var(--space-4)', height: 'var(--row-height-default)', width: 120 }}>
                        <select
                          defaultValue={u.role}
                          aria-label={`Change role for ${u.email}`}
                          onChange={(e) => updateRole.mutate({ userId: u.id, role: e.target.value })}
                          style={{ height: 28, padding: '0 var(--space-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface-raised)', fontSize: 'var(--text-xs)', color: 'var(--color-text)', cursor: 'pointer' }}
                        >
                          <option value="staff">Staff</option>
                          <option value="dept_admin">Dept Admin</option>
                          <option value="org_admin">Org Admin</option>
                          <option value="external_client">External Client</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showInvite && <InviteDialog orgId={orgId} onClose={() => setShowInvite(false)} />}
    </div>
  )
}
