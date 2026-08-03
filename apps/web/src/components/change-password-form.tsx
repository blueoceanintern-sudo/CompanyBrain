'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useChangePassword } from '@/hooks/use-account'

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
type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>

const inputBase: React.CSSProperties = {
  width: '100%', height: 44, padding: '0 16px', border: '1px solid #c3c6d7', borderRadius: 8,
  background: '#ffffff', fontSize: 14, color: '#0b1c30', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const,
}

// Shared change-password form. Reused by the account settings dialog and the
// forced first-login page (apps/web/src/app/(auth)/change-password) so the
// validation and checks stay identical. Passing onCancel renders the Cancel
// button (dialog mode); omit it for the forced page. On success the underlying
// useChangePassword hook signs the user out and redirects to /login.
export function ChangePasswordForm({
  orgId,
  onCancel,
  initialCurrentPassword,
}: {
  orgId: string
  onCancel?: () => void
  // Prefills "Current Password" — used only by the forced first-login screen to
  // carry the temporary password across. Never passed by the account dialog.
  initialCurrentPassword?: string | undefined
}) {
  const changePassword = useChangePassword(orgId)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: initialCurrentPassword ?? '', newPassword: '', confirmPassword: '' },
  })

  const onSubmit = (data: ChangePasswordFormValues) => {
    changePassword.mutate({ currentPassword: data.currentPassword, newPassword: data.newPassword })
  }

  return (
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
        {onCancel && (
          <button type="button" onClick={onCancel} style={{ flex: 1, height: 44, border: '1px solid #c3c6d7', borderRadius: 12, background: 'transparent', fontSize: 14, cursor: 'pointer', color: '#585f67', fontFamily: 'inherit' }}>Cancel</button>
        )}
        <button
          type="submit"
          disabled={isSubmitting || changePassword.isPending}
          style={{ flex: 1, height: 44, border: 'none', borderRadius: 12, background: '#2563eb', color: '#ffffff', fontSize: 14, fontWeight: 500, cursor: (isSubmitting || changePassword.isPending) ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
        >
          {changePassword.isPending ? 'Saving…' : 'Update Password'}
        </button>
      </div>
    </form>
  )
}
