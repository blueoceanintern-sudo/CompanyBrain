'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CreditCard } from 'lucide-react'
import { GroupsSection } from '@/components/settings/groups-section'

import { useSubscription, useConnectStatus, useStartConnectOnboarding, useExternalPricing, useSetExternalPricing, useStartOrgUpgrade, useOpenBillingPortal } from '@/hooks/use-payments'
import { useOrgProfile, useUpdateOrgProfile } from '@/hooks/use-orgs'
import { getAuthUser } from '@/lib/auth'
import { cancelSubscription } from '@/lib/api'
import { hasPermission } from '@company-brain/shared'

type Tab = 'general' | 'groups' | 'subscription' | 'danger'

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

// ─── Billing (org_admin / super_admin only) ────────────────────────────────────

function BillingSection({ orgId, plan, inputBase }: { orgId: string; plan: string | undefined; inputBase: React.CSSProperties }) {
  const { data: connectStatus, isLoading: connectLoading } = useConnectStatus(orgId)
  const startOnboarding = useStartConnectOnboarding(orgId)
  const { data: pricing, isLoading: pricingLoading } = useExternalPricing(orgId)
  const setPricing = useSetExternalPricing(orgId)
  const [priceInput, setPriceInput] = useState('')

  useEffect(() => {
    if (pricing?.priceCents != null) setPriceInput((pricing.priceCents / 100).toFixed(2))
  }, [pricing?.priceCents])

  const isPaid = plan === 'paid'

  return (
    <div style={{ border: '1px solid #c3c6d7', borderRadius: 12, padding: 32, background: '#ffffff', display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0b1c30', margin: '0 0 4px' }}>External Knowledge Access</h3>
        <p style={{ fontSize: 13, color: '#585f67', margin: 0 }}>Connect a payout account and set a price so external clients can subscribe to your published knowledge base. BlueOcean takes a 15% platform fee automatically.</p>
      </div>

      {!isPaid && (
        <div style={{ padding: '12px 16px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, fontSize: 13, color: '#9a3412' }}>
          External access requires the paid plan. Upgrade above before connecting payouts or setting a price.
        </div>
      )}

      {/* Connect status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <CreditCard size={20} color={connectStatus?.chargesEnabled ? '#16a34a' : '#585f67'} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: '#0b1c30', margin: 0 }}>Payout account</p>
            <p style={{ fontSize: 12, color: '#585f67', margin: 0 }}>
              {connectLoading ? 'Checking…' : connectStatus?.chargesEnabled ? 'Connected and ready to receive payouts' : connectStatus?.connected ? 'Onboarding started but not yet complete' : 'Not connected'}
            </p>
          </div>
        </div>
        <button
          disabled={!isPaid || startOnboarding.isPending}
          onClick={() => startOnboarding.mutate()}
          style={{ height: 40, padding: '0 20px', border: '1px solid #c3c6d7', borderRadius: 8, background: '#ffffff', fontSize: 13, fontWeight: 500, cursor: (!isPaid || startOnboarding.isPending) ? 'not-allowed' : 'pointer', opacity: !isPaid ? 0.5 : 1, color: '#0b1c30', fontFamily: 'inherit', flexShrink: 0 }}
        >
          {startOnboarding.isPending ? 'Redirecting…' : connectStatus?.connected ? 'Manage payout account' : 'Connect with Stripe'}
        </button>
      </div>

      {/* External pricing */}
      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 24, display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#434655', marginBottom: 8 }}>Monthly price for external clients (USD)</label>
          {pricingLoading ? <Skel h={48} /> : (
            <input
              type="number" min="0" step="0.01"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              disabled={!isPaid}
              placeholder="e.g. 50.00"
              style={{ ...inputBase, opacity: !isPaid ? 0.6 : 1 }}
            />
          )}
        </div>
        <button
          disabled={!isPaid || setPricing.isPending || !priceInput.trim()}
          onClick={() => {
            const cents = Math.round(parseFloat(priceInput) * 100)
            if (Number.isNaN(cents) || cents <= 0) { toast.error('Enter a valid price'); return }
            setPricing.mutate(cents)
          }}
          style={{ height: 48, padding: '0 20px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#ffffff', fontSize: 14, fontWeight: 500, cursor: (!isPaid || setPricing.isPending) ? 'not-allowed' : 'pointer', opacity: !isPaid ? 0.5 : 1, fontFamily: 'inherit' }}
        >
          {setPricing.isPending ? 'Saving…' : 'Save Price'}
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const user = getAuthUser()
  const orgId = user?.orgId ?? ''
  const [tab, setTab] = useState<Tab>('general')

  const searchParams = useSearchParams()
  const router = useRouter()
  const qc = useQueryClient()

  useEffect(() => {
    const connect = searchParams.get('connect')
    const upgrade = searchParams.get('upgrade')
    const tabParam = searchParams.get('tab')
    if (tabParam && ['general', 'groups', 'subscription', 'danger'].includes(tabParam)) {
      setTab(tabParam as Tab)
      router.replace('/settings')
    }
    if (connect === 'success') {
      toast.success('Stripe onboarding completed')
      router.replace('/settings')
    } else if (connect === 'refresh') {
      toast.info('Onboarding link expired — click "Connect with Stripe" to try again')
      router.replace('/settings')
    } else if (upgrade === 'success') {
      toast.success('Plan upgraded — you\'re now on the paid plan')
      qc.invalidateQueries({ queryKey: ['subscription', orgId] })
      setTab('subscription')
      router.replace('/settings')
    } else if (upgrade === 'cancel') {
      toast.info('Upgrade cancelled')
      router.replace('/settings')
    }
  }, [searchParams, router, qc, orgId])

  const { data: sub, isLoading: subLoading } = useSubscription(orgId)
  const cancelSub = useCancelSubscription(orgId)
  const orgUpgrade = useStartOrgUpgrade(orgId)
  const billingPortal = useOpenBillingPortal(orgId)
  const canManageBilling = !!user?.role && hasPermission(user.role, 'billing:manage')
  const canManageGroups = !!user?.role && hasPermission(user.role, 'users:manage')
  const canManageOrgProfile = !!user?.role && hasPermission(user.role, 'users:manage')

  const { data: orgProfile } = useOrgProfile(orgId)
  const updateOrgProfile = useUpdateOrgProfile(orgId)
  const [orgName, setOrgName] = useState('')
  useEffect(() => {
    if (orgProfile) setOrgName(orgProfile.name)
  }, [orgProfile])

  const inputBase: React.CSSProperties = {
    width: '100%', height: 48, padding: '0 16px', border: '1px solid #c3c6d7', borderRadius: 8,
    background: '#ffffff', fontSize: 14, color: '#0b1c30', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'general', label: 'General' },
    { key: 'groups', label: 'Groups' },
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
                    <input type="text" value={orgName} disabled={!canManageOrgProfile}
                      onChange={(e) => setOrgName(e.target.value)}
                      style={{ ...inputBase, ...(canManageOrgProfile ? {} : { color: '#585f67', background: '#f8f9ff' }) }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#c3c6d7'; e.currentTarget.style.boxShadow = 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 14, fontWeight: 500, color: '#434655' }}>Organisation ID</label>
                    <input type="text" readOnly value={orgProfile?.id ?? user?.orgId ?? ''} style={{ ...inputBase, color: '#585f67', background: '#f8f9ff', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }} aria-label="Organisation ID" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 14, fontWeight: 500, color: '#434655' }}>Email</label>
                    <input type="text" readOnly value={user?.email ?? ''} style={{ ...inputBase, color: '#585f67', background: '#f8f9ff' }} aria-label="Email" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 14, fontWeight: 500, color: '#434655' }}>Role</label>
                    <input type="text" readOnly value={user?.role?.replace(/_/g, ' ') ?? ''} style={{ ...inputBase, color: '#585f67', background: '#f8f9ff', textTransform: 'capitalize' }} aria-label="Role" />
                  </div>
                  {canManageOrgProfile && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
                      <button
                        disabled={updateOrgProfile.isPending || !orgName.trim() || orgName === orgProfile?.name}
                        style={{ padding: '10px 24px', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: (updateOrgProfile.isPending || !orgName.trim() || orgName === orgProfile?.name) ? 'not-allowed' : 'pointer', opacity: (updateOrgProfile.isPending || !orgName.trim() || orgName === orgProfile?.name) ? 0.5 : 1, fontFamily: 'inherit' }}
                        onClick={() => updateOrgProfile.mutate({ name: orgName.trim() })}
                      >
                        {updateOrgProfile.isPending ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Groups ── */}
          {tab === 'groups' && (
            <GroupsSection orgId={orgId} canManage={canManageGroups} inputBase={inputBase} />
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
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                    {[
                      { label: 'API Requests', value: '—' },
                      { label: 'Storage', value: '—' },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ padding: 16, border: '1px solid #c3c6d7', borderRadius: 8, background: '#f8f9ff' }}>
                        <p style={{ fontSize: 12, color: '#585f67', margin: '0 0 4px' }}>{label}</p>
                        <p style={{ fontSize: 16, fontWeight: 700, color: '#0b1c30', margin: '0 0 8px' }}>{value}</p>
                        <div style={{ width: '100%', background: '#e5eeff', height: 6, borderRadius: 3 }}>
                          <div style={{ width: '0%', background: '#004ac6', height: 6, borderRadius: 3 }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {sub?.plan === 'paid' ? (
                    <button
                      disabled={billingPortal.isPending}
                      onClick={() => billingPortal.mutate()}
                      style={{ width: '100%', padding: '12px 0', border: '1px solid #c3c6d7', borderRadius: 8, background: '#ffffff', fontSize: 14, cursor: billingPortal.isPending ? 'not-allowed' : 'pointer', color: '#0b1c30', fontFamily: 'inherit' }}
                      onMouseEnter={(e) => { if (!billingPortal.isPending) (e.currentTarget as HTMLElement).style.background = '#eff4ff' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#ffffff' }}
                    >
                      {billingPortal.isPending ? 'Opening…' : 'Manage Billing & Payment Methods'}
                    </button>
                  ) : canManageBilling && (
                    <button
                      disabled={orgUpgrade.isPending}
                      onClick={() => orgUpgrade.mutate()}
                      style={{ width: '100%', padding: '14px 0', border: 'none', borderRadius: 8, background: '#2563eb', color: '#ffffff', fontSize: 15, fontWeight: 600, cursor: orgUpgrade.isPending ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: orgUpgrade.isPending ? 0.7 : 1 }}
                    >
                      {orgUpgrade.isPending ? 'Redirecting to payment…' : 'Upgrade to Paid Plan'}
                    </button>
                  )}
                </div>
              )}

              {canManageBilling && (
                <BillingSection orgId={orgId} plan={sub?.plan} inputBase={inputBase} />
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
                    disabled={cancelSub.isPending || !sub?.subscriptionId}
                    onClick={() => { if (confirm('Are you sure? This cannot be undone.')) cancelSub.mutate() }}
                    style={{ padding: '10px 24px', background: '#ba1a1a', color: '#ffffff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: cancelSub.isPending || !sub?.subscriptionId ? 'not-allowed' : 'pointer', opacity: !sub?.subscriptionId ? 0.5 : 1, fontFamily: 'inherit', flexShrink: 0 }}
                  >
                    {cancelSub.isPending ? 'Cancelling…' : !sub?.subscriptionId ? 'No active plan' : 'Cancel Subscription'}
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
