'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { ArrowLeft, MailCheck, Network } from 'lucide-react'
import { requestPasswordReset } from '@/lib/api'
import { Providers } from '@/app/providers'

const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email'),
})
type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>

function ForgotPasswordForm() {
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordForm>({ resolver: zodResolver(forgotPasswordSchema) })

  const onSubmit = async (data: ForgotPasswordForm) => {
    // The API always returns the same generic success response regardless of
    // whether the email exists, so there's nothing to branch on here — that's
    // what keeps this from being usable to enumerate registered accounts.
    await requestPasswordReset(data.email)
    setSent(true)
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
          {sent ? (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: '#e5eeff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MailCheck size={26} color="#004ac6" />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0b1c30', margin: '0 0 8px' }}>Check your email</h2>
                <p style={{ fontSize: 14, color: '#585f67', margin: 0, lineHeight: 1.6 }}>
                  If an account exists for that email, we&apos;ve sent a link to reset your password. It expires in 1 hour.
                </p>
              </div>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0b1c30', margin: '0 0 8px' }}>Forgot password?</h2>
              <p style={{ fontSize: 14, color: '#585f67', margin: '0 0 24px', lineHeight: 1.6 }}>
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>
              <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label htmlFor="email" style={{ fontSize: 14, fontWeight: 500, color: '#434655' }}>Email Address</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    {...register('email')}
                    placeholder="name@blueocean.edu"
                    style={{ ...inputBase, borderColor: errors.email ? '#ba1a1a' : '#c3c6d7' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = errors.email ? '#ba1a1a' : '#c3c6d7'; e.currentTarget.style.boxShadow = 'none' }}
                  />
                  {errors.email && <p style={{ fontSize: 12, color: '#ba1a1a', margin: 0 }}>{errors.email.message}</p>}
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
                  {isSubmitting ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            </>
          )}
        </div>

        <Link href="/login" style={{ marginTop: 32, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#004ac6', textDecoration: 'none' }}>
          <ArrowLeft size={14} /> Back to sign in
        </Link>
      </div>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Providers>
      <ForgotPasswordForm />
    </Providers>
  )
}
