'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FolderOpen, FileText, Plus, Pencil, Trash2 } from 'lucide-react'
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

function Skel({ h }: { h: number }) {
  return <div style={{ height: h, background: '#eff4ff', borderRadius: 8, animation: 'cb-skel 1.5s ease-in-out infinite' }} />
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const user = getAuthUser()
  const orgId = user?.orgId ?? ''
  const [tab, setTab] = useState<Tab>('general')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')

  const { data: compartments = [], isLoading: compartmentsLoading } = useCompartments(orgId)
  const { data: sub, isLoading: subLoading } = useSubscription(orgId)
  const createComp = useCreateCompartment(orgId)
  const cancelSub = useCancelSubscription(orgId)

  const inputBase: React.CSSProperties = {
    width: '100%', height: 48, padding: '0 16px', border: '1px solid #c3c6d7', borderRadius: 8,
    background: '#ffffff', fontSize: 14, color: '#0b1c30', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'general', label: 'General' },
    { key: 'compartments', label: 'Compartments' },
    { key: 'subscription', label: 'Subscription' },
    { key: 'danger', label: 'Danger Zone' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top nav */}
      <header style={{ height: 50, borderBottom: '1px solid #c3c6d7', background: '#f8f9ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0, position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#004ac6' }}>Settings</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ padding: '4px 12px', background: '#e5eeff', color: '#434655', borderRadius: 9999, fontSize: 13 }}>Status: Internal</span>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', display: 'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </button>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', display: 'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </button>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '48px 16px', background: '#ffffff' }}>
        <div style={{ width: 'min(680px, 100%)', margin: '0 auto' }}>

          {/* Tabs */}
          <div role="tablist" style={{ display: 'flex', gap: 32, borderBottom: '1px solid #c3c6d7', marginBottom: 48 }}>
            {TABS.map(({ key, label }) => (
              <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
                style={{ padding: '0 0 12px', border: 'none', borderBottom: tab === key ? '2px solid #2563eb' : '2px solid transparent', background: 'transparent', fontSize: 14, fontWeight: tab === key ? 600 : 400, color: tab === key ? '#004ac6' : '#585f67', cursor: 'pointer', fontFamily: 'inherit', transition: 'color 0.2s' }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── General ── */}
          {tab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 600, color: '#0b1c30', margin: '0 0 8px' }}>Organization Profile</h2>
                <p style={{ fontSize: 14, color: '#434655', margin: '0 0 24px', lineHeight: 1.6 }}>
                  Manage your organization&apos;s core identification settings and branding identity within the Brain ecosystem.
                </p>
                <div style={{ border: '1px solid #c3c6d7', borderRadius: 12, padding: 32, display: 'flex', flexDirection: 'column', gap: 24, background: '#ffffff' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 14, fontWeight: 500, color: '#434655' }}>Organization Name</label>
                    <input type="text" defaultValue={user?.email?.split('@')[1]?.split('.')[0] ?? 'BlueOcean EdTech'}
                      style={inputBase}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#c3c6d7'; e.currentTarget.style.boxShadow = 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 14, fontWeight: 500, color: '#434655' }}>Workspace URL</label>
                    <div style={{ display: 'flex' }}>
                      <span style={{ padding: '0 16px', height: 48, display: 'flex', alignItems: 'center', background: '#e5eeff', border: '1px solid #c3c6d7', borderRight: 'none', borderRadius: '8px 0 0 8px', fontSize: 14, color: '#434655', whiteSpace: 'nowrap' }}>brain.blueocean.ai/</span>
                      <input type="text" defaultValue="education-hub"
                        style={{ ...inputBase, borderRadius: '0 8px 8px 0', flex: 1 }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = '#c3c6d7'; e.currentTarget.style.boxShadow = 'none' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 14, fontWeight: 500, color: '#434655' }}>Email</label>
                    <input type="text" readOnly value={user?.email ?? ''} style={{ ...inputBase, color: '#585f67', background: '#f8f9ff' }} aria-label="Email" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 14, fontWeight: 500, color: '#434655' }}>Role</label>
                    <input type="text" readOnly value={user?.role?.replace(/_/g, ' ') ?? ''} style={{ ...inputBase, color: '#585f67', background: '#f8f9ff', textTransform: 'capitalize' }} aria-label="Role" />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
                    <button style={{ padding: '10px 24px', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                      onClick={() => toast.success('Changes saved')}
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Compartments ── */}
          {tab === 'compartments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 600, color: '#0b1c30', margin: '0 0 8px' }}>Data Compartments</h2>
                  <p style={{ fontSize: 14, color: '#434655', margin: 0 }}>Isolate data and AI training contexts into secure logical containers.</p>
                </div>
                <button
                  onClick={() => setShowCreate(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', background: '#004ac6', color: '#ffffff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <Plus size={16} /> New Compartment
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {compartmentsLoading && Array.from({ length: 3 }).map((_, i) => <Skel key={i} h={64} />)}
                {!compartmentsLoading && compartments.length === 0 && !showCreate && (
                  <p style={{ color: '#585f67', fontSize: 14, textAlign: 'center', padding: 32 }}>No compartments. Create one to organise your knowledge.</p>
                )}
                {compartments.map((c) => (
                  <div key={c.id}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, border: '1px solid #c3c6d7', borderRadius: 12, background: '#ffffff', transition: 'border-color 0.2s' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#2563eb' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#c3c6d7' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: '#e5eeff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {c.mode === 'schema_driven' ? <FileText size={18} color="#004ac6" /> : <FolderOpen size={18} color="#004ac6" />}
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 500, color: '#0b1c30', margin: 0 }}>{c.name}</p>
                        {c.description && <p style={{ fontSize: 12, color: '#585f67', margin: '2px 0 0' }}>{c.description}</p>}
                        <p style={{ fontSize: 12, color: '#585f67', margin: '2px 0 0' }}>{c.mode}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', borderRadius: 6, display: 'flex' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#004ac6' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#585f67' }}
                      >
                        <Pencil size={18} />
                      </button>
                      <button style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', borderRadius: 6, display: 'flex' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#ba1a1a' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#585f67' }}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Also show static preview rows if no real compartments */}
              {!compartmentsLoading && compartments.length === 0 && !showCreate && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { name: 'Student Performance Records', desc: '324 Documents • Created 2m ago', icon: FolderOpen },
                    { name: 'Curriculum Standards 2024', desc: '15 Documents • Created 15d ago', icon: FileText },
                  ].map(({ name, desc, icon: Icon }) => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, border: '1px solid #c3c6d7', borderRadius: 12, background: '#ffffff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 8, background: '#e5eeff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon size={18} color="#004ac6" />
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 500, color: '#0b1c30', margin: 0 }}>{name}</p>
                          <p style={{ fontSize: 12, color: '#585f67', margin: '2px 0 0' }}>{desc}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', borderRadius: 6, display: 'flex' }}><Pencil size={18} /></button>
                        <button style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', borderRadius: 6, display: 'flex' }}><Trash2 size={18} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showCreate && (
                <div style={{ padding: 16, border: '1px solid #c3c6d7', borderRadius: 12, background: '#f8f9ff', display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#434655', marginBottom: 8 }}>Name</label>
                    <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} style={inputBase} placeholder="e.g. HR Department" />
                  </div>
                  <button
                    onClick={() => createComp.mutate({ name: newName }, { onSuccess: () => { setShowCreate(false); setNewName('') } })}
                    disabled={!newName.trim() || createComp.isPending}
                    style={{ height: 48, padding: '0 16px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#ffffff', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Create
                  </button>
                  <button onClick={() => { setShowCreate(false); setNewName('') }} style={{ height: 48, padding: '0 16px', border: '1px solid #c3c6d7', borderRadius: 8, background: 'transparent', fontSize: 14, cursor: 'pointer', color: '#0b1c30', fontFamily: 'inherit' }}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Subscription ── */}
          {tab === 'subscription' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: '#0b1c30', margin: 0 }}>Plan &amp; Billing</h2>
              {subLoading ? <Skel h={200} /> : (
                <div style={{ border: '1px solid #c3c6d7', borderRadius: 12, padding: 32, background: '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <h3 style={{ fontSize: 20, fontWeight: 600, color: '#0b1c30', margin: 0, textTransform: 'capitalize' }}>{sub?.plan ?? 'Enterprise AI'}</h3>
                        {sub?.status && (
                          <span style={{ padding: '2px 8px', background: '#dcfce7', color: '#166534', fontSize: 11, fontWeight: 700, borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{sub.status}</span>
                        )}
                      </div>
                      <p style={{ fontSize: 14, color: '#434655', margin: 0 }}>Professional grade intelligence for large scale educational institutions.</p>
                      {sub?.subscriptionId && <p style={{ fontSize: 12, color: '#585f67', fontFamily: 'JetBrains Mono, monospace', margin: '8px 0 0' }}>{sub.subscriptionId}</p>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 20, fontWeight: 600, color: '#0b1c30', margin: 0 }}>$1,200<span style={{ fontSize: 14, fontWeight: 400, color: '#585f67' }}>/mo</span></p>
                      <p style={{ fontSize: 12, color: '#585f67', margin: '4px 0 0' }}>Next billing: Oct 24, 2024</p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                    {[
                      { label: 'API Requests', value: '84%', detail: 'of 1M', pct: 84 },
                      { label: 'Storage', value: '12.4 GB', detail: 'of 100 GB', pct: 12.4 },
                    ].map(({ label, value, detail, pct }) => (
                      <div key={label} style={{ padding: 16, border: '1px solid #c3c6d7', borderRadius: 8, background: '#f8f9ff' }}>
                        <p style={{ fontSize: 12, color: '#585f67', margin: '0 0 4px' }}>{label}</p>
                        <p style={{ fontSize: 16, fontWeight: 700, color: '#0b1c30', margin: '0 0 8px' }}>{value} <span style={{ fontSize: 12, fontWeight: 400, color: '#585f67' }}>{detail}</span></p>
                        <div style={{ width: '100%', background: '#e5eeff', height: 6, borderRadius: 3 }}>
                          <div style={{ width: `${pct}%`, background: '#004ac6', height: 6, borderRadius: 3 }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    style={{ width: '100%', padding: '12px 0', border: '1px solid #c3c6d7', borderRadius: 8, background: '#ffffff', fontSize: 14, cursor: 'pointer', color: '#0b1c30', fontFamily: 'inherit' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#eff4ff' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#ffffff' }}
                  >
                    Manage Billing &amp; Payment Methods
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Danger zone ── */}
          {tab === 'danger' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: '#ba1a1a', margin: 0 }}>Danger Zone</h2>
              <div style={{ border: '1px solid #ffdad6', borderRadius: 12, overflow: 'hidden' }}>
                {/* Cancel subscription */}
                <div style={{ padding: 24, borderBottom: '1px solid #ffdad6', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, background: 'rgba(255,218,214,0.05)' }}>
                  <div>
                    <h4 style={{ fontSize: 16, fontWeight: 600, color: '#ba1a1a', margin: '0 0 4px' }}>Cancel Subscription</h4>
                    <p style={{ fontSize: 14, color: '#434655', margin: 0, maxWidth: 360, lineHeight: 1.5 }}>Once you cancel, your organization will lose access to premium AI models at the end of the current billing cycle.</p>
                  </div>
                  <button
                    disabled={cancelSub.isPending || sub?.plan === 'free'}
                    onClick={() => { if (confirm('Are you sure? This cannot be undone.')) cancelSub.mutate() }}
                    style={{ padding: '10px 24px', background: '#ba1a1a', color: '#ffffff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: cancelSub.isPending || sub?.plan === 'free' ? 'not-allowed' : 'pointer', opacity: sub?.plan === 'free' ? 0.5 : 1, fontFamily: 'inherit', flexShrink: 0 }}
                  >
                    {cancelSub.isPending ? 'Cancelling…' : sub?.plan === 'free' ? 'No active plan' : 'Cancel Subscription'}
                  </button>
                </div>
                {/* Delete organization */}
                <div style={{ padding: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <h4 style={{ fontSize: 16, fontWeight: 600, color: '#ba1a1a', margin: '0 0 4px' }}>Delete Organization</h4>
                    <p style={{ fontSize: 14, color: '#434655', margin: 0, maxWidth: 360, lineHeight: 1.5 }}>Permanently remove all data, documents, and AI training history. This action cannot be undone.</p>
                  </div>
                  <button
                    onClick={() => toast.error('Contact support to delete your organization.')}
                    style={{ padding: '10px 24px', background: 'transparent', color: '#ba1a1a', border: '1px solid #ba1a1a', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#ffdad6' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    Delete Forever
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
      <style>{`@keyframes cb-skel { 0%,100%{opacity:.5}50%{opacity:1} }`}</style>
    </div>
  )
}
