'use client'

import { useState } from 'react'
import { Users, Plus, Trash2, ChevronDown, ChevronRight, Search, X, Check } from 'lucide-react'
import { useGroups, useCreateGroup, useUpdateGroup, useDeleteGroup, useGroupMembers, useSetGroupMembers } from '@/hooks/use-groups'
import { useUsers } from '@/hooks/use-users'
import type { GroupSummary } from '@company-brain/shared'

function Skel({ h }: { h: number }) {
  return <div style={{ height: h, background: '#eff4ff', borderRadius: 8, animation: 'cb-skel 1.5s ease-in-out infinite' }} />
}

// Expandable panel for one group, mirroring the compartment panel: view mode
// lists members read-only; edit mode stages member changes behind one Save.
function GroupDetails({ orgId, group, initialEdit = false, inputBase, onRequestDelete }: { orgId: string; group: GroupSummary; initialEdit?: boolean; inputBase: React.CSSProperties; onRequestDelete: () => void }) {
  const { data: allUsers = [], isLoading: usersLoading } = useUsers(orgId)
  const { data: members, isLoading: membersLoading } = useGroupMembers(orgId, group.id)
  const setMembers = useSetGroupMembers(orgId)

  const [editing, setEditing] = useState(initialEdit)
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const [search, setSearch] = useState('')

  if (usersLoading || membersLoading) return <Skel h={80} />

  const internalUsers = allUsers.filter((u) => u.role !== 'external_client')
  const savedIds = new Set((members ?? []).map((m) => m.id))
  const current = selected ?? savedIds
  const dirty = selected !== null && (selected.size !== savedIds.size || [...selected].some((id) => !savedIds.has(id)))

  const memberUsers = internalUsers.filter((u) => current.has(u.id))
  const q = search.trim().toLowerCase()
  const addable = internalUsers.filter((u) => !current.has(u.id) && u.email.toLowerCase().includes(q))

  const toggle = (userId: string) => {
    const next = new Set(current)
    if (next.has(userId)) next.delete(userId)
    else next.add(userId)
    setSelected(next)
  }

  const resetStaged = () => {
    setSelected(null)
    setSearch('')
  }

  const listBox: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 200, overflowY: 'auto',
    border: '1px solid #eff4ff', borderRadius: 8, padding: 4,
  }

  // ── View mode ─────────────────────────────────────────────────────────────

  if (!editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {memberUsers.length === 0 ? (
          <p style={{ fontSize: 13, color: '#585f67', margin: 0 }}>No members yet.</p>
        ) : (
          <div style={listBox}>
            {memberUsers.map((u) => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px' }}>
                <span style={{ fontSize: 13, color: '#0b1c30' }}>{u.email}</span>
                <span style={{ fontSize: 11, color: '#585f67', textTransform: 'capitalize' }}>{u.role.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => { resetStaged(); setEditing(true) }}
            style={{ height: 36, padding: '0 20px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#ffffff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Edit
          </button>
        </div>
      </div>
    )
  }

  // ── Edit mode ─────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#434655', margin: '0 0 6px' }}>
          Members ({current.size})
        </p>
        {current.size === 0 ? (
          <p style={{ fontSize: 13, color: '#585f67', margin: 0, padding: '10px 12px', background: '#f8f9ff', borderRadius: 8 }}>
            No members yet — add users below.
          </p>
        ) : (
          <div style={listBox}>
            {memberUsers.map((u) => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', borderRadius: 8, background: '#eff4ff' }}>
                <span style={{ fontSize: 13, color: '#0b1c30' }}>{u.email}</span>
                <span style={{ fontSize: 11, color: '#585f67', textTransform: 'capitalize' }}>{u.role.replace(/_/g, ' ')}</span>
                <button
                  onClick={() => toggle(u.id)}
                  aria-label={`Remove ${u.email}`}
                  style={{ marginLeft: 'auto', padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', borderRadius: 4, display: 'flex' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#ba1a1a' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#585f67' }}
                ><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#434655', margin: '0 0 6px' }}>Add members</p>
        {internalUsers.length === 0 ? (
          <p style={{ fontSize: 13, color: '#585f67', margin: 0 }}>No internal users to add.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#585f67' }} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users to add…"
                aria-label="Search users to add"
                style={{ ...inputBase, height: 36, paddingLeft: 34, fontSize: 13 }}
              />
            </div>
            <div style={listBox}>
              {addable.length === 0 && (
                <p style={{ fontSize: 13, color: '#585f67', margin: 0, padding: '12px', textAlign: 'center' }}>
                  {q ? <>No users match &ldquo;{search}&rdquo;</> : 'Everyone is already a member.'}
                </p>
              )}
              {addable.map((u) => (
                <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={false} onChange={() => toggle(u.id)} style={{ accentColor: '#2563eb' }} />
                  <span style={{ fontSize: 13, color: '#0b1c30' }}>{u.email}</span>
                  <span style={{ fontSize: 11, color: '#585f67', textTransform: 'capitalize' }}>{u.role.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
        <button
          onClick={onRequestDelete}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px', border: 'none', borderRadius: 8, background: 'none', fontSize: 13, fontWeight: 500, color: '#ba1a1a', cursor: 'pointer', fontFamily: 'inherit' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#fff1f0' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none' }}
        >
          <Trash2 size={14} /> Delete group
        </button>
        <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={() => { resetStaged(); setEditing(false) }}
          style={{ height: 36, padding: '0 16px', border: '1px solid #c3c6d7', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#0b1c30', fontFamily: 'inherit' }}
        >
          Cancel
        </button>
        <button
          disabled={!dirty || setMembers.isPending}
          onClick={() =>
            setMembers.mutate(
              { gId: group.id, userIds: [...current] },
              { onSuccess: () => { resetStaged(); setEditing(false) } }
            )
          }
          style={{ height: 36, padding: '0 16px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#ffffff', fontSize: 13, fontWeight: 500, cursor: (!dirty || setMembers.isPending) ? 'not-allowed' : 'pointer', opacity: (!dirty || setMembers.isPending) ? 0.6 : 1, fontFamily: 'inherit' }}
        >
          {setMembers.isPending ? 'Saving…' : 'Save'}
        </button>
        </div>
      </div>
    </div>
  )
}

export function GroupsSection({ orgId, canManage, inputBase }: { orgId: string; canManage: boolean; inputBase: React.CSSProperties }) {
  const { data: groups = [], isLoading } = useGroups(orgId)
  const createGroup = useCreateGroup(orgId)
  const updateGroup = useUpdateGroup(orgId)
  const deleteGroup = useDeleteGroup(orgId)

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [panel, setPanel] = useState<{ id: string; edit: boolean } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('') // must equal "delete" to enable the button

  const create = () => {
    const name = newName.trim()
    if (!name) return
    createGroup.mutate(
      { name },
      { onSuccess: (g) => { setShowCreate(false); setNewName(''); if (g?.id) setPanel({ id: g.id, edit: true }) } }
    )
  }

  const startRename = (g: GroupSummary) => { setRenamingId(g.id); setRenameValue(g.name) }
  const saveRename = (gId: string) => {
    const name = renameValue.trim()
    if (!name) return
    updateGroup.mutate({ gId, data: { name } }, { onSuccess: () => setRenamingId(null) })
  }

  const iconBtn: React.CSSProperties = { padding: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', borderRadius: 6, display: 'flex' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#0b1c30', margin: '0 0 8px' }}>User Groups</h2>
          <p style={{ fontSize: 14, color: '#434655', margin: 0 }}>Group users by team or department.</p>
        </div>
        {canManage && (
          <button
            onClick={() => { setShowCreate(true); setNewName('') }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', background: '#004ac6', color: '#ffffff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
          >
            <Plus size={16} /> New Group
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {isLoading && Array.from({ length: 3 }).map((_, i) => <Skel key={i} h={64} />)}
        {!isLoading && groups.length === 0 && !showCreate && (
          <p style={{ color: '#585f67', fontSize: 14, textAlign: 'center', padding: 32 }}>No groups yet.</p>
        )}

        {showCreate && (
          <div style={{ padding: 16, border: '1px solid #c3c6d7', borderRadius: 12, background: '#f8f9ff', display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#434655', marginBottom: 8 }}>Name</label>
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') create(); if (e.key === 'Escape') { setShowCreate(false); setNewName('') } }}
                style={inputBase}
                placeholder="e.g. Finance Team"
              />
            </div>
            <button
              onClick={create}
              disabled={!newName.trim() || createGroup.isPending}
              style={{ height: 48, padding: '0 16px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#ffffff', fontSize: 14, fontWeight: 500, cursor: (!newName.trim() || createGroup.isPending) ? 'not-allowed' : 'pointer', opacity: (!newName.trim() || createGroup.isPending) ? 0.6 : 1, fontFamily: 'inherit' }}
            >
              {createGroup.isPending ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => { setShowCreate(false); setNewName('') }} style={{ height: 48, padding: '0 16px', border: '1px solid #c3c6d7', borderRadius: 8, background: 'transparent', fontSize: 14, cursor: 'pointer', color: '#0b1c30', fontFamily: 'inherit' }}>
              Cancel
            </button>
          </div>
        )}

        {groups.map((g) => (
          <div key={g.id} style={{ border: '1px solid #c3c6d7', borderRadius: 12, background: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: '#e5eeff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Users size={18} color="#004ac6" />
                </div>
                {renamingId === g.id ? (
                  <>
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveRename(g.id); if (e.key === 'Escape') setRenamingId(null) }}
                      style={{ ...inputBase, height: 40 }}
                    />
                    <button onClick={() => saveRename(g.id)} disabled={updateGroup.isPending || !renameValue.trim()} aria-label="Save name" style={{ ...iconBtn, color: '#16a34a', cursor: updateGroup.isPending ? 'not-allowed' : 'pointer' }}><Check size={18} /></button>
                    <button onClick={() => setRenamingId(null)} aria-label="Cancel rename" style={iconBtn}><X size={18} /></button>
                  </>
                ) : (
                  <div
                    style={{ minWidth: 0 }}
                    onDoubleClick={() => { if (canManage) startRename(g) }}
                    title={canManage ? 'Double-click to rename' : undefined}
                  >
                    <p style={{ fontSize: 14, fontWeight: 500, color: '#0b1c30', margin: 0 }}>{g.name}</p>
                    <p style={{ fontSize: 12, color: '#585f67', margin: '2px 0 0' }}>{g.memberCount} member{g.memberCount === 1 ? '' : 's'}</p>
                  </div>
                )}
              </div>

              {canManage && renamingId !== g.id && (
                <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8, alignItems: 'center' }}>
                  <button
                    onClick={() => setPanel(panel?.id === g.id ? null : { id: g.id, edit: false })}
                    aria-label={panel?.id === g.id ? 'Collapse group details' : 'Expand group details'}
                    style={{ ...iconBtn, color: panel?.id === g.id ? '#004ac6' : '#585f67' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#004ac6' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = panel?.id === g.id ? '#004ac6' : '#585f67' }}
                  >{panel?.id === g.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</button>
                </div>
              )}
            </div>

            {panel?.id === g.id && canManage && (
              <div style={{ borderTop: '1px solid #eff4ff', padding: 16 }}>
                <GroupDetails
                  key={g.id + (panel.edit ? '-edit' : '')}
                  orgId={orgId}
                  group={g}
                  initialEdit={panel.edit}
                  inputBase={inputBase}
                  onRequestDelete={() => { setDeletingId(g.id); setDeleteConfirm(''); setPanel(null) }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {deletingId && (() => {
        const target = groups.find((o) => o.id === deletingId)
        if (!target) return null
        const confirmed = deleteConfirm.trim() === 'Delete'
        const disabled = !confirmed || deleteGroup.isPending
        return (
          <div role="dialog" onClick={(e) => e.target === e.currentTarget && setDeletingId(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
            <div style={{ background: '#ffffff', border: '1px solid #ffdad6', borderRadius: 12, padding: 32, width: 'min(440px, 100%)', boxShadow: '0 10px 30px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 600, color: '#ba1a1a', margin: '0 0 8px' }}>Delete &ldquo;{target.name}&rdquo;?</h2>
                <p style={{ fontSize: 14, color: '#585f67', margin: 0, lineHeight: 1.6 }}>
                  Its members lose whatever compartment access this group granted them. The users themselves are not deleted. This cannot be undone.
                </p>
              </div>
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
                <button
                  onClick={() => deleteGroup.mutate(target.id, { onSuccess: () => setDeletingId(null) })}
                  disabled={disabled}
                  style={{ height: 40, padding: '0 20px', border: 'none', borderRadius: 8, background: '#ba1a1a', color: '#ffffff', fontSize: 14, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, fontFamily: 'inherit' }}
                >{deleteGroup.isPending ? 'Deleting…' : 'Delete Group'}</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
