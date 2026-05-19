'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { login } from '@/lib/api'
import { setAuth } from '@/lib/auth'
import { Providers } from '@/app/providers'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type LoginForm = z.infer<typeof loginSchema>

function LoginForm() {
  const router = useRouter()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginForm) => {
    const result = await login(data.email, data.password)
    if (!result.success) {
      toast.error(result.error.message)
      return
    }
    setAuth(result.data.token, result.data.user)
    router.push('/chat')
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
        padding: 'var(--space-5)',
      }}
    >
      <div
        style={{
          width: 'min(400px, 100%)',
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-8)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <h1
            style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 'var(--font-semibold)',
              color: 'var(--color-text)',
            }}
          >
            Company&apos;s Brain
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
            Sign in to your workspace
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label
              htmlFor="email"
              style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', marginBottom: 'var(--space-2)' }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              {...register('email')}
              style={{
                width: '100%',
                height: 'var(--input-h)',
                padding: '0 var(--space-3)',
                border: `1px solid ${errors.email ? 'var(--color-danger)' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface-raised)',
                color: 'var(--color-text)',
                fontSize: 'var(--text-sm)',
              }}
              placeholder="you@company.com"
            />
            {errors.email && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)', marginTop: 'var(--space-1)' }}>
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', marginBottom: 'var(--space-2)' }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              {...register('password')}
              style={{
                width: '100%',
                height: 'var(--input-h)',
                padding: '0 var(--space-3)',
                border: `1px solid ${errors.password ? 'var(--color-danger)' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface-raised)',
                color: 'var(--color-text)',
                fontSize: 'var(--text-sm)',
              }}
              placeholder="••••••••"
            />
            {errors.password && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)', marginTop: 'var(--space-1)' }}>
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              height: 'var(--input-h)',
              background: isSubmitting ? 'var(--color-text-disabled)' : 'var(--color-brand)',
              color: 'var(--color-brand-fg)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-medium)',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              marginTop: 'var(--space-2)',
            }}
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Providers>
      <LoginForm />
    </Providers>
  )
}
