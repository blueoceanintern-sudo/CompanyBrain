'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, X } from 'lucide-react'
import { getAuthUser } from '@/lib/auth'
import { useOrgProfile } from '@/hooks/use-orgs'
import { useChangePassword } from '@/hooks/use-account'

const PASSWORD_MASK = '•'.repeat(10)

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8, 'At least 8 characters'),
    newPassword: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string().min(8, 'At least 8 characters'),
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'New password must be different from your current password',
    path: ['newPassword'],
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })
type ChangePasswordForm = z.infer<typeof changePasswordSchema>

function ProfileRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #eff4ff' }}>
      <span style={{ fontSize: 14, color: '#585f67' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 500, color: '#0b1c30' }}>{value}</span>
    </div>
  )
}

function ChangePasswordDialog({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const changePassword = useChangePassword(orgId)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordForm>({ resolver: zodResolver(changePasswordSchema) })

  const onSubmit = (data: ChangePasswordForm) => {
    changePassword.mutate(
      { currentPassword: data.currentPassword, newPassword: data.newPassword },
      { onSuccess: onClose }
    )
  }

  const inputBase: React.CSSProperties = {
    width: '100%', height: 44, padding: '0 16px', border: '1px solid #c3c6d7', borderRadius: 8,
    background: '#ffffff', fontSize: 14, color: '#0b1c30', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const,
  }

  return (
    <div role="dialog" onClick={(e) => e.target === e.currentTarget && !changePassword.isPending && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div style={{ background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 12, width: 'min(440px, 100%)', boxShadow: '0 10px 30px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #c3c6d7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0b1c30', margin: 0 }}>Change Password</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', display: 'flex' }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: '#434655' }}>Current Password</label>
            <input type="password" {...register('currentPassword')} style={{ ...inputBase, borderColor: errors.currentPassword ? '#ba1a1a' : '#c3c6d7' }} />
            {errors.currentPassword && <p style={{ fontSize: 12, color: '#ba1a1a', margin: 0 }}>{errors.currentPassword.message}</p>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: '#434655' }}>New Password</label>
            <input type="password" {...register('newPassword')} placeholder="Min. 8 characters" style={{ ...inputBase, borderColor: errors.newPassword ? '#ba1a1a' : '#c3c6d7' }} />
            {errors.newPassword && <p style={{ fontSize: 12, color: '#ba1a1a', margin: 0 }}>{errors.newPassword.message}</p>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: '#434655' }}>Confirm New Password</label>
            <input type="password" {...register('confirmPassword')} style={{ ...inputBase, borderColor: errors.confirmPassword ? '#ba1a1a' : '#c3c6d7' }} />
            {errors.confirmPassword && <p style={{ fontSize: 12, color: '#ba1a1a', margin: 0 }}>{errors.confirmPassword.message}</p>}
          </div>
          <div style={{ display: 'flex', gap: 12, paddingTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, height: 44, border: '1px solid #c3c6d7', borderRadius: 12, background: 'transparent', fontSize: 14, cursor: 'pointer', color: '#585f67', fontFamily: 'inherit' }}>Cancel</button>
            <button
              type="submit"
              disabled={isSubmitting || changePassword.isPending}
              style={{ flex: 1, height: 44, border: 'none', borderRadius: 12, background: '#2563eb', color: '#ffffff', fontSize: 14, fontWeight: 500, cursor: (isSubmitting || changePassword.isPending) ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
            >
              {changePassword.isPending ? 'Saving…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AccountPage() {
  const user = getAuthUser()
  const orgId = user?.orgId ?? ''
  const { data: orgProfile } = useOrgProfile(orgId)
  const [showChangePassword, setShowChangePassword] = useState(false)

  const displayName = user?.name || user?.email?.split('@')[0] || 'Your Account'
  const initial = ((user?.name || user?.email)?.[0] ?? '?').toUpperCase()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header style={{ height: 50, borderBottom: '1px solid #c3c6d7', background: '#f8f9ff', display: 'flex', alignItems: 'center', padding: '0 32px', flexShrink: 0, position: 'sticky', top: 0, zIndex: 40 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#004ac6' }}>Account</span>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '48px 16px', background: '#ffffff' }}>
        <div style={{ width: 'min(560px, 100%)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{display: 'flex', padding: '3px', alignItems: 'center', gap: '8px'}}>
                <span
                    className="flex items-center justify-center rounded-full text-xs font-bold "
                    style={{ width: 32, height: 32, background: '#e5eeff', color: '#004ac6', flexShrink: 0 }}
                >
                    {initial}
                </span>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0b1c30', margin: 0 }}>{displayName}</h1>
            </div>

          <div style={{ border: '1px solid #c3c6d7', borderRadius: 12, padding: 32, background: '#ffffff' }}>
            <ProfileRow label="Organisation" value={orgProfile?.name ?? user?.orgName ?? '—'} />
            <ProfileRow label="Email" value={user?.email ?? '—'} />
            <ProfileRow label="Role" value={<span style={{ textTransform: 'capitalize' }}>{user?.role?.replace(/_/g, ' ') ?? '—'}</span>} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0' }}>
              <span style={{ fontSize: 14, color: '#585f67' }}>Password</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#0b1c30', letterSpacing: 2 }}>{PASSWORD_MASK}</span>
                <button
                  onClick={() => setShowChangePassword(true)}
                  aria-label="Change password"
                  title="Change password"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', display: 'flex', padding: 4, borderRadius: 6 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#eff4ff'; (e.currentTarget as HTMLElement).style.color = '#004ac6' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = '#585f67' }}
                >
                  <Pencil size={15} />
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {showChangePassword && <ChangePasswordDialog orgId={orgId} onClose={() => setShowChangePassword(false)} />}
    </div>
  )
}
