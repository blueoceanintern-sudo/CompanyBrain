'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useCompartments, useCreateCompartment } from '@/hooks/use-compartments'
import { getAuthUser } from '@/lib/auth'
import { getSubscription, cancelSubscription } from '@/lib/api'

type Tab = 'general' | 'compartments' | 'subscription' | 'danger'

function useSubscription(orgId: string) {
  return useQuery({
    queryKey: ['subscription', orgId],
    queryFn: async () => {
      const result = await getSubscription(orgId)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    enabled: !!orgId,
  })
}

function useCancelSubscription(orgId: string) {
  return useMutation({
    mutationFn: async () => {
      const result = await cancelSubscription(orgId)
      if (!result.success) throw new Error(result.error.message)
      return null
    },
    onSuccess: () => toast.success('Subscription cancelled. Your data will be retained for 30 days.'),
    onError: (err: Error) => toast.error(err.message),
  })
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-selected={active}
      role="tab"
      style={{
        height: 36, padding: '0 var(--space-4)', border: 'none',
        borderBottom: active ? '2px solid var(--color-brand)' : '2px solid transparent',
        background: 'transparent',
        color: active ? 'var(--color-brand)' : 'var(--color-text-muted)',
        fontSize: 'var(--text-sm)', fontWeight: active ? 'var(--font-medium)' : 'var(--font-normal)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

export default function SettingsPage() {
  const user = getAuthUser()
  const orgId = user?.orgId ?? ''
  const [tab, setTab] = useState<Tab>('general')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')

  const { data: compartments = [] } = useCompartments(orgId)
  const { data: sub } = useSubscription(orgId)
  const createComp = useCreateCompartment(orgId)
  const cancelSub = useCancelSubscription(orgId)

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 'var(--input-h)', padding: '0 var(--space-3)',
    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
    background: 'var(--color-surface-raised)', color: 'var(--color-text)', fontSize: 'var(--text-sm)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ height: 'var(--header-h)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', padding: '0 var(--space-8)', position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 10, flexShrink: 0 }}>
        <h1 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>Settings</h1>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-8)' }}>
        <div style={{ width: 'min(680px, 100%)', margin: '0 auto' }}>
          <div role="tablist" aria-label="Settings sections" style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: 'var(--space-8)' }}>
            {(['general', 'compartments', 'subscription', 'danger'] as Tab[]).map((t) => (
              <TabBtn key={t} label={t.charAt(0).toUpperCase() + t.slice(1)} active={tab === t} onClick={() => setTab(t)} />
            ))}
          </div>

          {/* General */}
          {tab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', marginBottom: 'var(--space-2)' }}>Email</label>
                <input type="text" readOnly value={user?.email ?? ''} style={{ ...inputStyle, color: 'var(--color-text-muted)' }} aria-label="Email" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', marginBottom: 'var(--space-2)' }}>Role</label>
                <input type="text" readOnly value={user?.role?.replace(/_/g, ' ') ?? ''} style={{ ...inputStyle, color: 'var(--color-text-muted)', textTransform: 'capitalize' }} aria-label="Role" />
              </div>
            </div>
          )}

          {/* Compartments */}
          {tab === 'compartments' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-4)' }}>
                <button onClick={() => setShowCreate(true)} style={{ height: 'var(--input-h)', padding: '0 var(--space-4)', border: 'none', borderRadius: 'var(--radius-md)', background: 'var(--color-brand)', color: 'var(--color-brand-fg)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', cursor: 'pointer' }}>
                  Create compartment
                </button>
              </div>

              {compartments.length === 0 && !showCreate && (
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: 'var(--space-8)' }}>No compartments. Create one to organise your knowledge.</p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {compartments.map((c) => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-raised)' }}>
                    <div>
                      <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', margin: 0 }}>{c.name}</p>
                      {c.description && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>{c.description}</p>}
                    </div>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', background: 'var(--color-surface)', padding: '1px var(--space-2)', borderRadius: 'var(--radius-sm)' }}>{c.mode}</span>
                  </div>
                ))}
              </div>

              {showCreate && (
                <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', background: 'var(--color-surface)' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', marginBottom: 'var(--space-2)' }}>Name</label>
                    <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} style={inputStyle} placeholder="e.g. HR Department" aria-label="Compartment name" />
                  </div>
                  <button
                    onClick={() => createComp.mutate({ name: newName }, { onSuccess: () => { setShowCreate(false); setNewName('') } })}
                    disabled={!newName.trim() || createComp.isPending}
                    style={{ height: 'var(--input-h)', padding: '0 var(--space-4)', border: 'none', borderRadius: 'var(--radius-md)', background: 'var(--color-brand)', color: 'var(--color-brand-fg)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', cursor: 'pointer' }}
                  >
                    Create
                  </button>
                  <button onClick={() => { setShowCreate(false); setNewName('') }} style={{ height: 'var(--input-h)', padding: '0 var(--space-4)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', fontSize: 'var(--text-sm)', cursor: 'pointer', color: 'var(--color-text)' }}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Subscription */}
          {tab === 'subscription' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ padding: 'var(--space-6)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface-raised)' }}>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: '0 0 var(--space-2)' }}>Current plan</p>
                <p style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-semibold)', margin: 0, textTransform: 'capitalize' }}>{sub?.plan ?? '—'}</p>
                {sub?.status && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: 'var(--space-1) 0 0' }}>Status: {sub.status}</p>}
                {sub?.subscriptionId && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', margin: 'var(--space-1) 0 0' }}>{sub.subscriptionId}</p>}
              </div>
            </div>
          )}

          {/* Danger zone */}
          {tab === 'danger' && (
            <div style={{ padding: 'var(--space-6)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-lg)', background: 'var(--color-danger-subtle)' }}>
              <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--color-danger)', margin: '0 0 var(--space-3)' }}>Danger zone</h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: '0 0 var(--space-4)' }}>
                Cancelling your subscription will downgrade your org to the free tier. Your data will be quarantined for 30 days then permanently deleted.
              </p>
              <button
                disabled={cancelSub.isPending || sub?.plan === 'free'}
                onClick={() => {
                  if (confirm('Are you sure? This cannot be undone.')) {
                    cancelSub.mutate()
                  }
                }}
                style={{ height: 'var(--input-h)', padding: '0 var(--space-5)', border: 'none', borderRadius: 'var(--radius-md)', background: 'var(--color-danger)', color: 'var(--color-brand-fg)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', cursor: cancelSub.isPending || sub?.plan === 'free' ? 'not-allowed' : 'pointer', opacity: sub?.plan === 'free' ? 0.5 : 1 }}
              >
                {cancelSub.isPending ? 'Cancelling…' : sub?.plan === 'free' ? 'No active subscription' : 'Cancel subscription'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
