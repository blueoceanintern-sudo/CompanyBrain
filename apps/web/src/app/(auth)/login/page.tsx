'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { Eye, EyeOff, ArrowRight, Network } from 'lucide-react'
import { login } from '@/lib/api'
import { setAuth } from '@/lib/auth'
import { Providers } from '@/app/providers'

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'blueoceanintern@gmail.com'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type LoginForm = z.infer<typeof loginSchema>

function LoginForm() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginForm) => {
    const result = await login(data.email, data.password, rememberMe)
    if (!result.success) {
      toast.error(result.error.message)
      return
    }
    setAuth(result.data.user)
    router.push('/chat')
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
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Email */}
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

            {/* Password */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="password" style={{ fontSize: 14, fontWeight: 500, color: '#434655' }}>Password</label>
                <Link href="/forgot-password" style={{ fontSize: 12, color: '#004ac6', textDecoration: 'none' }}>Forgot password?</Link>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...register('password')}
                  placeholder="••••••••"
                  style={{ ...inputBase, paddingRight: 44, borderColor: errors.password ? '#ba1a1a' : '#c3c6d7' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = errors.password ? '#ba1a1a' : '#c3c6d7'; e.currentTarget.style.boxShadow = 'none' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#737686', display: 'flex', alignItems: 'center' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p style={{ fontSize: 12, color: '#ba1a1a', margin: 0 }}>{errors.password.message}</p>}
            </div>

            {/* Remember */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ width: 16, height: 16, borderRadius: 4, borderColor: '#c3c6d7', cursor: 'pointer', accentColor: '#2563eb' }}
              />
              <label htmlFor="remember" style={{ fontSize: 14, color: '#434655', cursor: 'pointer' }}>Remember this device</label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: '100%', height: 48, background: isSubmitting ? '#737686' : '#2563eb',
                color: '#ffffff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500,
                cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8, transition: 'opacity 0.2s', fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => { if (!isSubmitting) (e.currentTarget as HTMLElement).style.opacity = '0.9' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
              {!isSubmitting && <ArrowRight size={16} />}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p style={{ marginTop: 32, fontSize: 14, color: '#434655', margin: '32px 0 0' }}>
          Don&apos;t have an account?{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: '#004ac6', fontWeight: 500, textDecoration: 'none' }}>Contact Administrator</a>
        </p>
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
