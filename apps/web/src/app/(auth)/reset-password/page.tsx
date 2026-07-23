'use client'

import { Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Network } from 'lucide-react'
import { resetPassword } from '@/lib/api'
import { Providers } from '@/app/providers'

const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string().min(8, 'At least 8 characters'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })
type ResetPasswordForm = z.infer<typeof resetPasswordSchema>

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordForm>({ resolver: zodResolver(resetPasswordSchema) })

  const onSubmit = async (data: ResetPasswordForm) => {
    const result = await resetPassword(token, data.newPassword)
    if (!result.success) {
      toast.error(result.error.message)
      return
    }
    toast.success('Password reset — sign in with your new password.')
    router.push('/login')
  }

  const inputBase: React.CSSProperties = {
    width: '100%',
    height: 48,
    padding: '0 16px',
    border: '1px solid #c3c6d7',
    borderRadius: 8,
    background: '#ffffff',
    color: '#0b1c30',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'inherit',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9ff', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Branding */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, background: '#2563eb', borderRadius: 12, marginBottom: 24 }}>
            <Network size={28} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0b1c30', margin: '0 0 8px' }}>Company&apos;s Brain</h1>
          <p style={{ fontSize: 14, color: '#434655', margin: 0 }}>BlueOcean Intelligent Ecosystem</p>
        </div>

        {/* Card */}
        <div style={{ width: '100%', background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 12, padding: 32, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
          {!token ? (
            <p style={{ fontSize: 14, color: '#ba1a1a', margin: 0, lineHeight: 1.6 }}>
              This reset link is missing its token. Request a new one from the{' '}
              <a href="/forgot-password" style={{ color: '#004ac6' }}>forgot password</a> page.
            </p>
          ) : (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0b1c30', margin: '0 0 8px' }}>Reset your password</h2>
              <p style={{ fontSize: 14, color: '#585f67', margin: '0 0 24px', lineHeight: 1.6 }}>
                Choose a new password for your account.
              </p>
              <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label htmlFor="newPassword" style={{ fontSize: 14, fontWeight: 500, color: '#434655' }}>New Password</label>
                  <input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    {...register('newPassword')}
                    placeholder="Min. 8 characters"
                    style={{ ...inputBase, borderColor: errors.newPassword ? '#ba1a1a' : '#c3c6d7' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = errors.newPassword ? '#ba1a1a' : '#c3c6d7'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                  {errors.newPassword && <p style={{ fontSize: 12, color: '#ba1a1a', margin: 0 }}>{errors.newPassword.message}</p>}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label htmlFor="confirmPassword" style={{ fontSize: 14, fontWeight: 500, color: '#434655' }}>Confirm New Password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    {...register('confirmPassword')}
                    style={{ ...inputBase, borderColor: errors.confirmPassword ? '#ba1a1a' : '#c3c6d7' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = errors.confirmPassword ? '#ba1a1a' : '#c3c6d7'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                  {errors.confirmPassword && <p style={{ fontSize: 12, color: '#ba1a1a', margin: 0 }}>{errors.confirmPassword.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    width: '100%', height: 48, background: isSubmitting ? '#737686' : '#2563eb',
                    color: '#ffffff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {isSubmitting ? 'Resetting…' : 'Reset password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Providers>
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </Providers>
  )
}
