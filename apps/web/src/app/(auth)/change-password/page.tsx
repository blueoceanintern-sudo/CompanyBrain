'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Network } from 'lucide-react'
import { getAuthUser } from '@/lib/auth'
import { peekTempPassword, clearTempPassword } from '@/lib/pending-credential'
import { ChangePasswordForm } from '@/components/change-password-form'
import { Providers } from '@/app/providers'

// Forced first-login screen. Invited users log in with their temporary
// password, land here (routed by login/page.tsx and the dashboard layout
// guard), and cannot reach the app until they set a new password. Requires an
// authenticated session — the change endpoint reads the caller's id from the
// JWT cookie — so this route is intentionally left out of middleware's
// PUBLIC_PATHS. On success the shared form signs the user out and sends them
// back to /login to sign in with the new password.
function ForcedChangePassword() {
  const router = useRouter()
  const user = getAuthUser()
  // Capture the carried temp password once during render (before any effect can
  // clear it), then drop it from the module holder so it doesn't linger.
  const [initialCurrentPassword] = useState(() => peekTempPassword() ?? undefined)

  useEffect(() => {
    if (!user) router.replace('/login')
  }, [user, router])

  useEffect(() => {
    clearTempPassword()
  }, [])

  if (!user) return null

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
        <div style={{ width: '100%', background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 12, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <div style={{ padding: '24px 24px 0' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0b1c30', margin: '0 0 8px' }}>Set your password</h2>
            <p style={{ fontSize: 14, color: '#585f67', margin: 0, lineHeight: 1.6 }}>
              For security, choose a new password before continuing. Enter the temporary password you were sent, then pick a new one.
            </p>
          </div>
          <ChangePasswordForm orgId={user.orgId} initialCurrentPassword={initialCurrentPassword} />
        </div>
      </div>
    </div>
  )
}

export default function ChangePasswordPage() {
  return (
    <Providers>
      <ForcedChangePassword />
    </Providers>
  )
}
