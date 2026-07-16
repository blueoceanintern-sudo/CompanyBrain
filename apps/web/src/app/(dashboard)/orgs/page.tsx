'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, Plus, X, Copy } from 'lucide-react'
import { useOrgs, useCreateOrg } from '@/hooks/use-orgs'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'

const PLAN_STYLE: Record<string, { bg: string; color: string }> = {
  free: { bg: '#f1f5f9', color: '#475569' },
  paid: { bg: '#dcfce7', color: '#166534' },
}

const createOrgSchema = z.object({
  orgName: z.string().min(1, 'Required'),
  adminEmail: z.string().email('Valid email required'),
  adminTemporaryPassword: z.string().min(8, 'At least 8 characters'),
})
type CreateOrgForm = z.infer<typeof createOrgSchema>

function Skel({ h }: { h: number }) {
  return <div style={{ height: h, background: '#eff4ff', borderRadius: 8, animation: 'cb-skel 1.5s ease-in-out infinite' }} />
}

// ─── Create dialog ────────────────────────────────────────────────────────────

function CreateOrgDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (admin: { email: string; password: string }) => void }) {
  const createOrg = useCreateOrg()
  const { register, handleSubmit, formState: { errors } } = useForm<CreateOrgForm>({
    resolver: zodResolver(createOrgSchema),
  })

  const inputBase: React.CSSProperties = {
    width: '100%', height: 44, padding: '0 16px', border: '1px solid #c3c6d7', borderRadius: 12,
    background: '#ffffff', fontSize: 14, color: '#0b1c30', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const,
  }

  const onSubmit = (data: CreateOrgForm) => {
    createOrg.mutate(data, {
      onSuccess: () => {
        onCreated({ email: data.adminEmail, password: data.adminTemporaryPassword })
        onClose()
      },
    })
  }

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div style={{ background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 12, width: 'min(440px, 100%)', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #c3c6d7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 20, fontWeight: 600, color: '#0b1c30', margin: 0 }}>Create Organisation</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', display: 'flex' }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: '#434655' }}>Organisation Name</label>
            <input type="text" {...register('orgName')} placeholder="e.g. Riverdale School District" style={{ ...inputBase, borderColor: errors.orgName ? '#ba1a1a' : '#c3c6d7' }} />
            {errors.orgName && <p style={{ fontSize: 12, color: '#ba1a1a', margin: 0 }}>{errors.orgName.message}</p>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: '#434655' }}>First Admin Email</label>
            <input type="email" {...register('adminEmail')} placeholder="admin@org.com" style={{ ...inputBase, borderColor: errors.adminEmail ? '#ba1a1a' : '#c3c6d7' }} />
            {errors.adminEmail && <p style={{ fontSize: 12, color: '#ba1a1a', margin: 0 }}>{errors.adminEmail.message}</p>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: '#434655' }}>Temporary Password</label>
            <input type="password" {...register('adminTemporaryPassword')} placeholder="Min. 8 characters" style={{ ...inputBase, borderColor: errors.adminTemporaryPassword ? '#ba1a1a' : '#c3c6d7' }} />
            {errors.adminTemporaryPassword && <p style={{ fontSize: 12, color: '#ba1a1a', margin: 0 }}>{errors.adminTemporaryPassword.message}</p>}
          </div>
          <div style={{ display: 'flex', gap: 12, paddingTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, height: 44, border: '1px solid #c3c6d7', borderRadius: 12, background: 'transparent', fontSize: 14, cursor: 'pointer', color: '#585f67', fontFamily: 'inherit' }}>Cancel</button>
            <button type="submit" disabled={createOrg.isPending} style={{ flex: 1, height: 44, border: 'none', borderRadius: 12, background: '#2563eb', color: '#ffffff', fontSize: 14, fontWeight: 500, cursor: createOrg.isPending ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {createOrg.isPending ? 'Creating…' : 'Create Organisation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrgsPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [createdAdmin, setCreatedAdmin] = useState<{ email: string; password: string } | null>(null)
  const { data: orgs = [], isLoading } = useOrgs()

  const copyCredentials = () => {
    if (!createdAdmin) return
    navigator.clipboard.writeText(`Email: ${createdAdmin.email}\nTemporary password: ${createdAdmin.password}`)
      .then(() => toast.success('Credentials copied to clipboard'))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header style={{ height: 50, borderBottom: '1px solid #c3c6d7', background: '#f8f9ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0, position: 'sticky', top: 0, zIndex: 40 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#004ac6' }}>Organisations</span>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: 32, background: '#ffffff' }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 600, color: '#0b1c30', margin: '0 0 4px', letterSpacing: '-0.01em' }}>Platform Organisations</h2>
              <p style={{ fontSize: 14, color: '#585f67', margin: 0 }}>Provision new client organisations and their first admin account.</p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <Plus size={18} /> Create Organisation
            </button>
          </div>

          {createdAdmin && (
            <div style={{ border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: 12, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#166534', margin: '0 0 4px' }}>Organisation created — hand these credentials to the new admin</p>
                <p style={{ fontSize: 13, color: '#15803d', margin: 0, fontFamily: 'JetBrains Mono, monospace' }}>{createdAdmin.email} · {createdAdmin.password}</p>
                <p style={{ fontSize: 12, color: '#16a34a', margin: '4px 0 0' }}>No email was sent — this password will not be shown again.</p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={copyCredentials} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#ffffff', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 12, cursor: 'pointer', color: '#166534', fontFamily: 'inherit' }}>
                  <Copy size={14} /> Copy
                </button>
                <button onClick={() => setCreatedAdmin(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', display: 'flex' }}><X size={16} /></button>
              </div>
            </div>
          )}

          <div style={{ border: '1px solid #c3c6d7', borderRadius: 12, overflow: 'hidden' }}>
            <table aria-label="Organisations" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, background: '#ffffff' }}>
              <thead style={{ background: '#eff4ff', borderBottom: '1px solid #c3c6d7' }}>
                <tr>
                  {['Organisation', 'Plan', 'Users', 'Documents', 'Queries (30d)', 'Created'].map((h) => (
                    <th key={h} style={{ padding: '16px 24px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: '#585f67', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} style={{ padding: '12px 24px' }}><Skel h={28} /></td></tr>
                ))}
                {!isLoading && orgs.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center' }}>
                    <p style={{ fontSize: 18, fontWeight: 500, color: '#0b1c30', margin: '0 0 8px' }}>No organisations yet</p>
                    <p style={{ fontSize: 14, color: '#585f67', margin: 0 }}>Create the first one to get started.</p>
                  </td></tr>
                )}
                {orgs.map((org) => {
                  const ps = PLAN_STYLE[org.plan] ?? PLAN_STYLE['free']!
                  return (
                    <tr key={org.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#e5eeff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Building2 size={16} color="#004ac6" />
                          </div>
                          <span style={{ fontWeight: 500, color: '#0b1c30' }}>{org.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ display: 'inline-block', padding: '4px 12px', background: ps.bg, color: ps.color, borderRadius: 9999, fontSize: 12, fontWeight: 500, textTransform: 'capitalize' }}>
                          {org.plan}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', color: '#585f67' }}>{org.userCount}</td>
                      <td style={{ padding: '16px 24px', color: '#585f67' }}>{org.documentCount}</td>
                      <td style={{ padding: '16px 24px', color: '#585f67' }}>{org.queryCount30d}</td>
                      <td style={{ padding: '16px 24px', color: '#585f67' }}>{formatDate(org.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showCreate && <CreateOrgDialog onClose={() => setShowCreate(false)} onCreated={setCreatedAdmin} />}
      <style>{`@keyframes cb-skel { 0%,100%{opacity:.5}50%{opacity:1} }`}</style>
    </div>
  )
}
