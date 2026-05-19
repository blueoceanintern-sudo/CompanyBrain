'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useCompartments, useCreateCompartment } from '@/hooks/use-compartments'
import { getAuthUser } from '@/lib/auth'
import { MOCK_USER, MOCK_SUBSCRIPTION } from '@/lib/mock-data'

type Tab = 'general' | 'compartments' | 'subscription' | 'danger'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true' || process.env.NEXT_PUBLIC_API_URL === undefined

function useSubscription(orgId: string) {
  if (USE_MOCK) return { data: MOCK_SUBSCRIPTION, isLoading: false }
  // Real implementation via getSubscription() would go here
  return { data: null, isLoading: false }
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
  const user = getAuthUser() ?? MOCK_USER
  const orgId = user.orgId
  const [tab, setTab] = useState<Tab>('general')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')

  const { data: compartments = [] } = useCompartments(orgId)
  const { data: sub } = useSubscription(orgId)
  const createComp = useCreateCompartment(orgId)

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
          {/* Tab list */}
          <div role="tablist" aria-label="Settings sections" style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: 'var(--space-8)' }}>
            {(['general', 'compartments', 'subscription', 'danger'] as Tab[]).map((t) => (
              <TabBtn key={t} label={t.charAt(0).toUpperCase() + t.slice(1)} active={tab === t} onClick={() => setTab(t)} />
            ))}
          </div>

          {/* General */}
          {tab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', marginBottom: 'var(--space-2)' }}>Organisation name</label>
                <input type="text" defaultValue="Equest School Network" style={inputStyle} aria-label="Organisation name" />
              </div>
              <button
                onClick={() => toast.success('Settings saved')}
                style={{ alignSelf: 'flex-start', height: 'var(--input-h)', padding: '0 var(--space-5)', border: 'none', borderRadius: 'var(--radius-md)', background: 'var(--color-brand)', color: 'var(--color-brand-fg)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', cursor: 'pointer' }}
              >
                Save
              </button>
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

              {compartments.length === 0 && (
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
                    onClick={() => { createComp.mutate({ name: newName }, { onSuccess: () => { setShowCreate(false); setNewName('') } }) }}
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
                <p style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-semibold)', margin: 0, textTransform: 'capitalize' }}>{sub?.plan ?? 'Free'}</p>
                {sub?.status && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: 'var(--space-1) 0 0' }}>Status: {sub.status}</p>}
              </div>
              <button
                onClick={() => toast.info('Wire STRIPE_PORTAL_URL to open billing portal in production')}
                style={{ alignSelf: 'flex-start', height: 'var(--input-h)', padding: '0 var(--space-5)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', fontSize: 'var(--text-sm)', cursor: 'pointer', color: 'var(--color-text)' }}
              >
                Manage billing →
              </button>
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
                onClick={() => { if (confirm('Are you sure? This cannot be undone.')) toast.error('Cancellation — wire up the subscription cancel endpoint') }}
                style={{ height: 'var(--input-h)', padding: '0 var(--space-5)', border: 'none', borderRadius: 'var(--radius-md)', background: 'var(--color-danger)', color: 'var(--color-brand-fg)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', cursor: 'pointer' }}
              >
                Cancel subscription
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
