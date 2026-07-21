'use client'

import { useState } from 'react'
import { Users, User, Search, X, Lock, Trash2 } from 'lucide-react'
import { useGroups, useCompartmentGrants, useSetCompartmentGrants } from '@/hooks/use-groups'
import { useUpdateCompartment } from '@/hooks/use-compartments'
import { useUsers } from '@/hooks/use-users'
import type { CompartmentSummary } from '@company-brain/shared'

// Folder access panel: view mode summarises restriction and who has access;
// edit mode stages restrict/unrestrict + grant changes behind one Save, and
// hosts the delete action. Admins always have access.
//
// Access narrows down the hierarchy: a sub-compartment is only reachable by
// people who can also access its parent, so grants here are inert for anyone
// locked out of a restricted parent — flagged inline so admins can see why.
export function FolderAccessPanel({
  orgId,
  compartment,
  parent = null,
  initialEdit = false,
  onRequestDelete,
}: {
  orgId: string
  compartment: CompartmentSummary
  parent?: CompartmentSummary | null
  initialEdit?: boolean
  onRequestDelete: () => void
}) {
  const { data: groups = [], isLoading: groupsLoading } = useGroups(orgId)
  const { data: allUsers = [], isLoading: usersLoading } = useUsers(orgId)
  const { data: grants, isLoading: grantsLoading } = useCompartmentGrants(orgId, compartment.id)
  const parentRestricted = !!parent?.restricted
  const { data: parentGrants } = useCompartmentGrants(orgId, parentRestricted ? parent.id : null)
  const setGrants = useSetCompartmentGrants(orgId)
  const updateComp = useUpdateCompartment(orgId)

  const [editing, setEditing] = useState(initialEdit)
  const [localName, setLocalName] = useState(compartment.name)
  const [localRestricted, setLocalRestricted] = useState(compartment.restricted)
  const [selectedGroups, setSelectedGroups] = useState<Set<string> | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<Set<string> | null>(null)
  const [search, setSearch] = useState('')

  if (groupsLoading || usersLoading || grantsLoading) {
    return <div style={{ height: 80, background: '#eff4ff', borderRadius: 8, animation: 'cb-skel 1.5s ease-in-out infinite' }} />
  }

  const savedGroupIds = new Set(grants?.groupIds ?? [])
  const savedUserIds = new Set(grants?.userIds ?? [])
  const currentGroups = selectedGroups ?? savedGroupIds
  const currentUsers = selectedUsers ?? savedUserIds

  const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((v) => b.has(v))
  const grantsDirty = !sameSet(currentGroups, savedGroupIds) || !sameSet(currentUsers, savedUserIds)
  const nameDirty = localName.trim().length > 0 && localName.trim() !== compartment.name
  const restrictedDirty = localRestricted !== compartment.restricted
  const dirty = nameDirty || restrictedDirty || (localRestricted && grantsDirty)
  const saving = setGrants.isPending || updateComp.isPending

  // Grants only matter for non-admin internal users
  const grantableUsers = allUsers.filter((u) => u.role === 'dept_admin' || u.role === 'staff')

  const q = search.trim().toLowerCase()
  const grantedGroups = groups.filter((g) => currentGroups.has(g.id))
  const grantedUsers = grantableUsers.filter((u) => currentUsers.has(u.id))
  const addableGroups = groups.filter((g) => !currentGroups.has(g.id) && g.name.toLowerCase().includes(q))
  const addableUsers = grantableUsers.filter((u) => !currentUsers.has(u.id) && u.email.toLowerCase().includes(q))
  const grantedCount = grantedGroups.length + grantedUsers.length

  // Users can already be covered by a granted group's membership; surface that
  // so admins don't add redundant direct grants without realising
  const grantedGroupNames = new Set(grantedGroups.map((g) => g.name))
  const accessViaGroups = (u: { groups?: string[] }) =>
    (u.groups ?? []).filter((name) => grantedGroupNames.has(name))

  // Grants are inert for subjects who cannot access a restricted parent
  const parentUserIds = new Set(parentGrants?.userIds ?? [])
  const parentGroupIds = new Set(parentGrants?.groupIds ?? [])
  const parentGroupNames = new Set(groups.filter((g) => parentGroupIds.has(g.id)).map((g) => g.name))
  const userLacksParentAccess = (u: { id: string; groups?: string[] }) =>
    parentRestricted && !!parentGrants && !parentUserIds.has(u.id) && !(u.groups ?? []).some((n) => parentGroupNames.has(n))
  const groupLacksParentAccess = (g: { id: string }) =>
    parentRestricted && !!parentGrants && !parentGroupIds.has(g.id)

  const parentWarnBadge: React.CSSProperties = {
    marginLeft: 'auto', fontSize: 11, color: '#9a3412', background: '#fff7ed',
    border: '1px solid #fed7aa', padding: '1px 8px', borderRadius: 999, whiteSpace: 'nowrap',
  }

  const toggleGroup = (id: string) => {
    const next = new Set(currentGroups)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedGroups(next)
  }
  const toggleUser = (id: string) => {
    const next = new Set(currentUsers)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedUsers(next)
  }

  const resetStaged = () => {
    setLocalName(compartment.name)
    setLocalRestricted(compartment.restricted)
    setSelectedGroups(null)
    setSelectedUsers(null)
    setSearch('')
  }

  const save = async () => {
    if (nameDirty || restrictedDirty) {
      await updateComp.mutateAsync({
        cId: compartment.id,
        data: {
          ...(nameDirty ? { name: localName.trim() } : {}),
          ...(restrictedDirty ? { restricted: localRestricted } : {}),
        },
      })
    }
    if (localRestricted && grantsDirty) {
      await setGrants.mutateAsync({
        cId: compartment.id,
        grants: { userIds: [...currentUsers], groupIds: [...currentGroups] },
      })
    }
    setSelectedGroups(null)
    setSelectedUsers(null)
    setSearch('')
    setEditing(false)
  }

  const listBox: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 200, overflowY: 'auto',
    border: '1px solid #eff4ff', borderRadius: 8, padding: 4,
  }
  const removeBtn: React.CSSProperties = {
    marginLeft: 'auto', padding: 4, background: 'none', border: 'none', cursor: 'pointer',
    color: '#585f67', borderRadius: 4, display: 'flex',
  }
  const secondaryBtn: React.CSSProperties = {
    height: 36, padding: '0 16px', border: '1px solid #c3c6d7', borderRadius: 8,
    background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#0b1c30', fontFamily: 'inherit',
  }

  // ── View mode ─────────────────────────────────────────────────────────────

  if (!editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {parentRestricted && (
          <p style={{ fontSize: 13, color: '#9a3412', margin: 0, padding: '10px 12px', background: '#fff7ed', borderRadius: 8 }}>
            Only people with access to &ldquo;{parent.name}&rdquo; have access, regardless of grants below.
          </p>
        )}
        {!compartment.restricted ? (
          <p style={{ fontSize: 13, color: '#585f67', margin: 0 }}>
            {parentRestricted
              ? <>Access is inherited from the parent folder.</>
              : <>Open — everyone in the organisation can view and query this folder.</>}
          </p>
        ) : (
          <>
            <p style={{ fontSize: 13, color: '#585f67', margin: 0 }}>
              Restricted · {grantedGroups.length} group{grantedGroups.length === 1 ? '' : 's'}, {grantedUsers.length} user{grantedUsers.length === 1 ? '' : 's'} <br/> Only those listed (plus org admins) can view and query it.
            </p>
            {grantedCount === 0 ? (
              <p style={{ fontSize: 13, color: '#b91c1c', margin: 0, padding: '10px 12px', background: '#fef2f2', borderRadius: 8 }}>
                No access granted yet — only org admins can view this folder.
              </p>
            ) : (
              <div style={listBox}>
                {grantedGroups.map((g) => (
                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px' }}>
                    <Users size={14} color="#004ac6" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#0b1c30' }}>{g.name}</span>
                    <span style={{ fontSize: 11, color: '#585f67' }}>{g.memberCount} member{g.memberCount === 1 ? '' : 's'}</span>
                    {groupLacksParentAccess(g) && (
                      <span style={parentWarnBadge}>only members with access to &ldquo;{parent?.name}&rdquo;</span>
                    )}
                  </div>
                ))}
                {grantedUsers.map((u) => {
                  const via = accessViaGroups(u)
                  return (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px' }}>
                      <User size={14} color="#004ac6" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: '#0b1c30' }}>{u.email}</span>
                      <span style={{ fontSize: 11, color: '#585f67', textTransform: 'capitalize' }}>{u.role.replace(/_/g, ' ')}</span>
                      {userLacksParentAccess(u) ? (
                        <span style={parentWarnBadge}>no access to &ldquo;{parent?.name}&rdquo;</span>
                      ) : via.length > 0 ? (
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#0f766e' }}>also via {via.join(', ')}</span>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </>
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
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#434655', margin: '0 0 6px' }}>Name</label>
        <input
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          placeholder={compartment.name}
          style={{ width: '100%', height: 40, padding: '0 12px', border: '1px solid #c3c6d7', borderRadius: 8, background: '#ffffff', fontSize: 14, color: '#0b1c30', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
      </div>
      {parentRestricted && (
        <p style={{ fontSize: 13, color: '#9a3412', margin: 0, padding: '10px 12px', background: '#fff7ed', borderRadius: 8 }}>
          Grants here can only narrow further.
        </p>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={localRestricted} onChange={(e) => setLocalRestricted(e.target.checked)} style={{ accentColor: '#2563eb' }} />
        <Lock size={14} color={localRestricted ? '#9a3412' : '#585f67'} />
        <span style={{ fontSize: 13, color: '#0b1c30', fontWeight: 500 }}>Restricted</span>
        <span style={{ fontSize: 12, color: '#585f67' }}>
          {parent
            ? <>— unrestricted, it inherits &ldquo;{parent.name}&rdquo;&rsquo;s audience.</>
            : <>— only selected users (plus admins) can view and query it.</>}
        </span>
      </label>

      {localRestricted && (
        <>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#434655', margin: '0 0 6px' }}>
              Current access ({grantedCount})
            </p>
            {grantedCount === 0 ? (
              <p style={{ fontSize: 13, color: '#585f67', margin: 0, padding: '10px 12px', background: '#f8f9ff', borderRadius: 8 }}>
                No one has access yet — only org admins can view this folder. Add groups or users below.
              </p>
            ) : (
              <div style={listBox}>
                {grantedGroups.map((g) => (
                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', borderRadius: 8, background: '#eff4ff' }}>
                    <Users size={14} color="#004ac6" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#0b1c30' }}>{g.name}</span>
                    <span style={{ fontSize: 11, color: '#585f67' }}>{g.memberCount} member{g.memberCount === 1 ? '' : 's'}</span>
                    {groupLacksParentAccess(g) && (
                      <span style={{ ...parentWarnBadge, marginLeft: 8 }}>only members with access to &ldquo;{parent?.name}&rdquo;</span>
                    )}
                    <button onClick={() => toggleGroup(g.id)} aria-label={`Remove ${g.name}`} style={removeBtn}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#ba1a1a' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#585f67' }}
                    ><X size={14} /></button>
                  </div>
                ))}
                {grantedUsers.map((u) => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', borderRadius: 8, background: '#eff4ff' }}>
                    <User size={14} color="#004ac6" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#0b1c30' }}>{u.email}</span>
                    <span style={{ fontSize: 11, color: '#585f67', textTransform: 'capitalize' }}>{u.role.replace(/_/g, ' ')}</span>
                    {userLacksParentAccess(u) && (
                      <span style={{ ...parentWarnBadge, marginLeft: 8 }}>no access to &ldquo;{parent?.name}&rdquo;</span>
                    )}
                    <button onClick={() => toggleUser(u.id)} aria-label={`Remove ${u.email}`} style={removeBtn}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#ba1a1a' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#585f67' }}
                    ><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#434655', margin: '0 0 6px' }}>Add groups or users</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#585f67' }} />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search groups and users…"
                  aria-label="Search groups and users to add"
                  style={{ width: '100%', height: 36, padding: '0 12px 0 34px', border: '1px solid #c3c6d7', borderRadius: 8, background: '#ffffff', fontSize: 13, color: '#0b1c30', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>
              <div style={listBox}>
                {addableGroups.length === 0 && addableUsers.length === 0 && (
                  <p style={{ fontSize: 13, color: '#585f67', margin: 0, padding: '12px', textAlign: 'center' }}>
                    {q ? <>Nothing matches &ldquo;{search}&rdquo;</> : 'All groups and users already have access.'}
                  </p>
                )}
                {addableGroups.map((g) => (
                  <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={false} onChange={() => toggleGroup(g.id)} style={{ accentColor: '#2563eb' }} />
                    <Users size={14} color="#585f67" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#0b1c30' }}>{g.name}</span>
                    <span style={{ fontSize: 11, color: '#585f67' }}>{g.memberCount} member{g.memberCount === 1 ? '' : 's'}</span>
                    {groupLacksParentAccess(g) && (
                      <span style={parentWarnBadge}>only members with access to &ldquo;{parent?.name}&rdquo;</span>
                    )}
                  </label>
                ))}
                {addableUsers.map((u) => {
                  const via = accessViaGroups(u)
                  return (
                    <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={false} onChange={() => toggleUser(u.id)} style={{ accentColor: '#2563eb' }} />
                      <User size={14} color="#585f67" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: '#0b1c30' }}>{u.email}</span>
                      <span style={{ fontSize: 11, color: '#585f67', textTransform: 'capitalize' }}>{u.role.replace(/_/g, ' ')}</span>
                      {userLacksParentAccess(u) ? (
                        <span style={parentWarnBadge}>no access to &ldquo;{parent?.name}&rdquo;</span>
                      ) : via.length > 0 ? (
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#0f766e', background: '#f0fdfa', border: '1px solid #99f6e4', padding: '1px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                          has access via {via.join(', ')}
                        </span>
                      ) : null}
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
        <button
          onClick={onRequestDelete}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px', border: 'none', borderRadius: 8, background: 'none', fontSize: 13, fontWeight: 500, color: '#ba1a1a', cursor: 'pointer', fontFamily: 'inherit' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#fff1f0' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none' }}
        >
          <Trash2 size={14} /> Delete folder
        </button>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => { resetStaged(); setEditing(false) }} style={secondaryBtn}>Cancel</button>
          <button
            disabled={!dirty || saving}
            onClick={save}
            style={{ height: 36, padding: '0 16px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#ffffff', fontSize: 13, fontWeight: 500, cursor: (!dirty || saving) ? 'not-allowed' : 'pointer', opacity: (!dirty || saving) ? 0.6 : 1, fontFamily: 'inherit' }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
