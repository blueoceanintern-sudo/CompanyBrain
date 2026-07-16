'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FolderOpen, Plus, CreditCard, Check, X, Lock, AlertTriangle, ChevronDown, ChevronRight, CornerDownRight } from 'lucide-react'
import { useCompartments, useCreateCompartment, useUpdateCompartment, useDeleteCompartment } from '@/hooks/use-compartments'
import { GroupsSection } from '@/components/settings/groups-section'
import { CompartmentDetails } from '@/components/settings/compartment-access'
import type { CompartmentSummary } from '@company-brain/shared'

import { useConnectStatus, useStartConnectOnboarding, useExternalPricing, useSetExternalPricing, useStartOrgUpgrade, useOpenBillingPortal } from '@/hooks/use-payments'
import { getAuthUser } from '@/lib/auth'
import { getSubscription, cancelSubscription } from '@/lib/api'
import { hasPermission } from '@company-brain/shared'

type Tab = 'general' | 'compartments' | 'groups' | 'subscription' | 'danger'

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

// ─── Compartments (users:manage only for edit/delete) ──────────────────────────

function CompartmentsSection({ orgId, canManage, inputBase, autoCreate = false, onAutoCreateHandled }: { orgId: string; canManage: boolean; inputBase: React.CSSProperties; autoCreate?: boolean; onAutoCreateHandled?: () => void }) {
  const { data: compartments = [], isLoading } = useCompartments(orgId)
  const createComp = useCreateCompartment(orgId)
  const updateComp = useUpdateCompartment(orgId)
  const deleteComp = useDeleteCompartment(orgId)

  const [showCreate, setShowCreate] = useState(false)
  const [createParent, setCreateParent] = useState<CompartmentSummary | null>(null) // non-null = creating a sub-compartment
  const [newName, setNewName] = useState('')
  const [newRestricted, setNewRestricted] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('') // must equal "delete" to enable the button
  const [reassignTarget, setReassignTarget] = useState('') // '' = delete documents too
  const [panel, setPanel] = useState<{ id: string; edit: boolean } | null>(null) // expanded compartment panel

  // One level of nesting: sub-compartments render under their parent, and
  // access only narrows down the tree (a sub is unreachable without parent access)
  const topLevel = compartments.filter((c) => !c.parentCompartmentId)
  const subsOf = (parentId: string) => compartments.filter((c) => c.parentCompartmentId === parentId)
  const compartmentLabel = (c: CompartmentSummary) => {
    const parent = compartments.find((p) => p.id === c.parentCompartmentId)
    return parent ? `${parent.name} / ${c.name}` : c.name
  }

  // Deep link from the documents page: open the create form on arrival
  useEffect(() => {
    if (autoCreate && canManage) {
      setShowCreate(true)
      setCreateParent(null)
      setNewName('')
      setNewRestricted(false)
      onAutoCreateHandled?.()
    }
  }, [autoCreate, canManage, onAutoCreateHandled])

  const openCreate = (parent: CompartmentSummary | null) => {
    setShowCreate(true)
    setCreateParent(parent)
    setNewName('')
    setNewRestricted(false)
  }
  const closeCreate = () => {
    setShowCreate(false)
    setCreateParent(null)
    setNewName('')
    setNewRestricted(false)
  }

  const createCompartment = () => {
    const name = newName.trim()
    if (!name) return
    createComp.mutate(
      { name, restricted: newRestricted, ...(createParent ? { parentId: createParent.id } : {}) },
      {
        onSuccess: (created) => {
          closeCreate()
          // A restricted compartment starts with no grants — open the panel in
          // edit mode immediately so it doesn't end up locked to everyone
          if (newRestricted && created?.id) setPanel({ id: created.id, edit: true })
        },
      }
    )
  }

  const requestDelete = (c: CompartmentSummary) => {
    if (subsOf(c.id).length > 0) {
      toast.error(`Delete the sub-compartments of "${c.name}" first`)
      return
    }
    setDeletingId(c.id)
    setDeleteConfirm('')
    setReassignTarget('')
    setPanel(null)
  }

  const startEdit = (c: CompartmentSummary) => { setEditingId(c.id); setEditName(c.name) }
  const saveEdit = (cId: string) => {
    const name = editName.trim()
    if (!name) return
    updateComp.mutate({ cId, data: { name } }, { onSuccess: () => setEditingId(null) })
  }
  const confirmDelete = (cId: string) => {
    const vars = reassignTarget ? { cId, targetCompartmentId: reassignTarget } : { cId }
    deleteComp.mutate(vars, { onSuccess: () => setDeletingId(null) })
  }

  const iconBtn: React.CSSProperties = { padding: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', borderRadius: 6, display: 'flex' }

  const renderCreateForm = () => (
    <div style={{ padding: 16, border: '1px solid #c3c6d7', borderRadius: 12, background: '#f8f9ff', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {createParent && (
        <p style={{ fontSize: 12, color: '#585f67', margin: 0 }}>
          New sub-compartment of <strong style={{ color: '#0b1c30' }}>{createParent.name}</strong> — only people
          with access to &ldquo;{createParent.name}&rdquo; will be able to see it.
        </p>
      )}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#434655', marginBottom: 8 }}>Name</label>
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') createCompartment(); if (e.key === 'Escape') closeCreate() }}
            style={inputBase}
            placeholder={createParent ? 'e.g. Payroll' : 'e.g. HR Department'}
          />
        </div>
        <button
          onClick={createCompartment}
          disabled={!newName.trim() || createComp.isPending}
          style={{ height: 48, padding: '0 16px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#ffffff', fontSize: 14, fontWeight: 500, cursor: (!newName.trim() || createComp.isPending) ? 'not-allowed' : 'pointer', opacity: (!newName.trim() || createComp.isPending) ? 0.6 : 1, fontFamily: 'inherit' }}
        >
          {createComp.isPending ? 'Creating…' : 'Create'}
        </button>
        <button onClick={closeCreate} style={{ height: 48, padding: '0 16px', border: '1px solid #c3c6d7', borderRadius: 8, background: 'transparent', fontSize: 14, cursor: 'pointer', color: '#0b1c30', fontFamily: 'inherit' }}>
          Cancel
        </button>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '4px 0' }}>
        <input type="checkbox" checked={newRestricted} onChange={(e) => setNewRestricted(e.target.checked)} style={{ accentColor: '#2563eb' }} />
        <Lock size={14} color={newRestricted ? '#9a3412' : '#585f67'} />
        <span style={{ fontSize: 13, color: '#0b1c30' }}>Restricted</span>
        <span style={{ fontSize: 12, color: '#585f67' }}>
          {createParent
            ? <>— narrows access further.</>
            : <>— only granted users and groups (plus admins) can see and query it.</>}
        </span>
      </label>
    </div>
  )

  const renderCard = (c: CompartmentSummary, parent: CompartmentSummary | null) => (
    <div style={{ border: '1px solid #c3c6d7', borderRadius: 12, background: '#ffffff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: '#e5eeff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FolderOpen size={18} color="#004ac6" />
          </div>
          {editingId === c.id ? (
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(c.id); if (e.key === 'Escape') setEditingId(null) }}
              style={{ ...inputBase, height: 40 }}
            />
          ) : (
            <div
              style={{ minWidth: 0 }}
              onDoubleClick={() => { if (canManage) startEdit(c) }}
              title={canManage ? 'Double-click to rename' : undefined}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: '#0b1c30', margin: 0 }}>{c.name}</p>
                {c.restricted && c.grantCount === 0 && (
                  <button
                    onClick={() => canManage && setPanel({ id: c.id, edit: true })}
                    title={canManage ? 'Grant access to users or groups' : undefined}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 11, fontWeight: 600, borderRadius: 999, cursor: canManage ? 'pointer' : 'default', fontFamily: 'inherit' }}
                  >
                    <AlertTriangle size={10} /> No access granted — admins only
                  </button>
                )}
              </div>
              {c.description && <p style={{ fontSize: 12, color: '#585f67', margin: '2px 0 0' }}>{c.description}</p>}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
          {c.restricted && <Lock size={16} color="#9a3412" aria-label="Restricted" />}
          {canManage && (editingId === c.id ? (
            <>
              <button onClick={() => saveEdit(c.id)} disabled={updateComp.isPending || !editName.trim()} aria-label="Save name" style={{ ...iconBtn, color: '#16a34a', cursor: updateComp.isPending ? 'not-allowed' : 'pointer' }}><Check size={18} /></button>
              <button onClick={() => setEditingId(null)} aria-label="Cancel rename" style={iconBtn}><X size={18} /></button>
            </>
          ) : (
            <>
              {!c.parentCompartmentId && (
                <button
                  onClick={() => openCreate(c)}
                  aria-label={`New sub-compartment in ${c.name}`}
                  title="New sub-compartment"
                  style={iconBtn}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#004ac6' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#585f67' }}
                ><Plus size={18} /></button>
              )}
              <button
                onClick={() => setPanel(panel?.id === c.id ? null : { id: c.id, edit: false })}
                aria-label={panel?.id === c.id ? 'Collapse compartment details' : 'Expand compartment details'}
                style={{ ...iconBtn, color: panel?.id === c.id ? '#004ac6' : '#585f67' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#004ac6' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = panel?.id === c.id ? '#004ac6' : '#585f67' }}
              >{panel?.id === c.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</button>
            </>
          ))}
        </div>
      </div>

      {panel?.id === c.id && canManage && (
        <div style={{ borderTop: '1px solid #eff4ff', padding: 16 }}>
          <CompartmentDetails
            key={c.id + (panel.edit ? '-edit' : '')}
            orgId={orgId}
            compartment={c}
            parent={parent}
            initialEdit={panel.edit}
            onRequestDelete={() => requestDelete(c)}
          />
        </div>
      )}

    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#0b1c30', margin: '0 0 8px' }}>Data Compartments</h2>
          <p style={{ fontSize: 14, color: '#434655', margin: 0 }}>Create, and manage access to logical containers.</p>
        </div>
        {canManage && (
          <button
            onClick={() => openCreate(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', background: '#004ac6', color: '#ffffff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
          >
            <Plus size={16} /> New Compartment
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {isLoading && Array.from({ length: 3 }).map((_, i) => <Skel key={i} h={64} />)}
        {!isLoading && compartments.length === 0 && !showCreate && (
          <p style={{ color: '#585f67', fontSize: 14, textAlign: 'center', padding: 32 }}>Create a compartment to organise your knowledge.</p>
        )}

        {showCreate && !createParent && renderCreateForm()}
        {topLevel.map((c) => (
          <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {renderCard(c, null)}
            {subsOf(c.id).map((s) => (
              <div key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <CornerDownRight size={16} color="#c3c6d7" style={{ marginTop: 26, marginLeft: 10, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>{renderCard(s, c)}</div>
              </div>
            ))}
            {showCreate && createParent?.id === c.id && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <CornerDownRight size={16} color="#c3c6d7" style={{ marginTop: 26, marginLeft: 10, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>{renderCreateForm()}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      {deletingId && (() => {
        const target = compartments.find((o) => o.id === deletingId)
        if (!target) return null
        return (
          <div role="dialog" onClick={(e) => e.target === e.currentTarget && setDeletingId(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
            <div style={{ background: '#ffffff', border: '1px solid #ffdad6', borderRadius: 12, padding: 32, width: 'min(440px, 100%)', boxShadow: '0 10px 30px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 600, color: '#ba1a1a', margin: '0 0 8px' }}>Delete &ldquo;{target.name}&rdquo;?</h2>
                <p style={{ fontSize: 14, color: '#585f67', margin: 0, lineHeight: 1.6 }}>Choose what happens to the documents in this compartment. This cannot be undone.</p>
              </div>
              <select value={reassignTarget} onChange={(e) => setReassignTarget(e.target.value)} style={{ ...inputBase, height: 44 }}>
                <option value="">Delete all documents in this compartment</option>
                {compartments.filter((o) => o.id !== target.id).map((o) => (
                  <option key={o.id} value={o.id}>Move documents to &ldquo;{compartmentLabel(o)}&rdquo;</option>
                ))}
              </select>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#434655', marginBottom: 6 }}>
                  Type <strong style={{ color: '#ba1a1a' }}>Delete</strong> to confirm (case-sensitive)
                </label>
                <input
                  autoFocus
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="Delete"
                  style={{ ...inputBase, height: 44 }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button onClick={() => setDeletingId(null)} style={{ height: 40, padding: '0 20px', border: '1px solid #c3c6d7', borderRadius: 8, background: 'transparent', fontSize: 14, cursor: 'pointer', color: '#0b1c30', fontFamily: 'inherit' }}>Cancel</button>
                {(() => {
                  const confirmed = deleteConfirm.trim() === 'Delete'
                  const disabled = !confirmed || deleteComp.isPending
                  return (
                    <button onClick={() => confirmDelete(target.id)} disabled={disabled}
                      style={{ height: 40, padding: '0 20px', border: 'none', borderRadius: 8, background: '#ba1a1a', color: '#ffffff', fontSize: 14, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, fontFamily: 'inherit' }}
                    >{deleteComp.isPending ? 'Deleting…' : 'Delete Compartment'}</button>
                  )
                })()}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const user = getAuthUser()
  const orgId = user?.orgId ?? ''
  const [tab, setTab] = useState<Tab>('general')
  const [autoCreateCompartment, setAutoCreateCompartment] = useState(false)

  const searchParams = useSearchParams()
  const router = useRouter()
  const qc = useQueryClient()

  useEffect(() => {
    const connect = searchParams.get('connect')
    const upgrade = searchParams.get('upgrade')
    const tabParam = searchParams.get('tab')
    if (tabParam && ['general', 'compartments', 'groups', 'subscription', 'danger'].includes(tabParam)) {
      setTab(tabParam as Tab)
      if (tabParam === 'compartments' && searchParams.get('create') === '1') {
        setAutoCreateCompartment(true)
      }
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
  const canManageCompartments = !!user?.role && hasPermission(user.role, 'users:manage')

  const inputBase: React.CSSProperties = {
    width: '100%', height: 48, padding: '0 16px', border: '1px solid #c3c6d7', borderRadius: 8,
    background: '#ffffff', fontSize: 14, color: '#0b1c30', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'general', label: 'General' },
    { key: 'compartments', label: 'Compartments' },
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
                    <input type="text" defaultValue={user?.email?.split('@')[1]?.split('.')[0] ?? 'BlueOcean EdTech'}
                      style={inputBase}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#c3c6d7'; e.currentTarget.style.boxShadow = 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 14, fontWeight: 500, color: '#434655' }}>Workspace Slug</label>
                    <div style={{ display: 'flex' }}>
                      <span style={{ padding: '0 16px', height: 48, display: 'flex', alignItems: 'center', background: '#e5eeff', border: '1px solid #c3c6d7', borderRight: 'none', borderRadius: '8px 0 0 8px', fontSize: 14, color: '#434655', whiteSpace: 'nowrap' }}>app/</span>
                      <input type="text" defaultValue={user?.orgId ?? ''}
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
            <CompartmentsSection
              orgId={orgId}
              canManage={canManageCompartments}
              inputBase={inputBase}
              autoCreate={autoCreateCompartment}
              onAutoCreateHandled={() => setAutoCreateCompartment(false)}
            />
          )}

          {/* ── Groups ── */}
          {tab === 'groups' && (
            <GroupsSection orgId={orgId} canManage={canManageCompartments} inputBase={inputBase} />
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
