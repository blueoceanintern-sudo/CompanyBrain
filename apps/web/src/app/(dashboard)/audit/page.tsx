'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, Search, X } from 'lucide-react'
import { getAuthUser } from '@/lib/auth'
import { exportAuditLog, listAuditLogs, unwrap } from '@/lib/api'
import type { AuditLogEntry } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'

const DATE_RANGES = [
  { value: '24h', label: 'Last 24h', days: 1 },
  { value: '7d', label: 'Last 7 Days', days: 7 },
  { value: '30d', label: 'Last 30 Days', days: 30 },
  { value: 'all', label: 'All Time', days: 0 },
] as const
type DateRange = (typeof DATE_RANGES)[number]['value']

const PAGE_SIZE = 50

function useAuditLogs(orgId: string, days: number, page: number) {
  return useQuery({
    queryKey: ['audit-logs', orgId, days, page],
    queryFn: async () =>
      unwrap(await listAuditLogs(orgId, { days, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })),
    enabled: !!orgId,
    placeholderData: (prev) => prev,
  })
}

async function downloadCSV(orgId: string) {
  try {
    const blob = await exportAuditLog(orgId)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-${orgId}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch {
    toast.error('Export failed')
  }
}

function Skel({ h }: { h: number }) {
  return <div style={{ height: h, background: '#eff4ff', borderRadius: 6, animation: 'cb-skel 1.5s ease-in-out infinite' }} />
}

function initials(str: string) {
  return str.split(/\s+/).map((s) => s[0]).join('').toUpperCase().slice(0, 2)
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({ entry, onClose }: { entry: AuditLogEntry; onClose: () => void }) {
  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(entry, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-event-${entry.id}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.15)' }} onClick={onClose} />
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 480, background: '#ffffff', borderLeft: '1px solid #c3c6d7', display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 30px rgba(0,0,0,0.08)', animation: 'cb-slide-in 0.3s ease' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #c3c6d7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h3 style={{ fontSize: 20, fontWeight: 600, color: '#0b1c30', margin: 0 }}>Event Details</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', display: 'flex', borderRadius: 8, padding: 4 }}>
            <X size={20} />
          </button>
        </div>
        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* Event Context */}
          <div>
            <h4 style={{ fontSize: 11, fontWeight: 500, color: '#585f67', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 16px' }}>Event Context</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Actor ID', value: entry.userId || '—', mono: true },
                { label: 'Actor Email', value: entry.actorEmail || '—', mono: false },
                { label: 'Org ID', value: entry.orgId || '—', mono: true },
                { label: 'Org Name', value: entry.orgName || '—', mono: false },
                { label: 'Action', value: entry.action, mono: true },
                { label: 'Resource Type', value: entry.resourceType || '—', mono: false },
                { label: 'Resource ID', value: entry.resourceId || '—', mono: true },
                { label: 'Timestamp', value: entry.createdAt, mono: true },
              ].map(({ label, value, mono }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#737686', flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: 13, color: '#0b1c30', fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit', textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Metadata */}
          <div>
            <h4 style={{ fontSize: 11, fontWeight: 500, color: '#585f67', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 16px' }}>Metadata</h4>
            {entry.metadata && Object.keys(entry.metadata).length > 0 ? (
              <pre style={{ background: '#eff4ff', border: '1px solid #c3c6d7', borderRadius: 8, padding: 16, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, lineHeight: 1.7, color: '#0b1c30', margin: 0, overflowX: 'auto' }}>
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            ) : (
              <p style={{ fontSize: 13, color: '#737686', margin: 0 }}>No metadata recorded for this event.</p>
            )}
          </div>
        </div>
        {/* Footer */}
        <div style={{ padding: 24, borderTop: '1px solid #c3c6d7', flexShrink: 0 }}>
          <button
            onClick={downloadJson}
            style={{ width: '100%', padding: '12px 0', background: '#0b1c30', color: '#ffffff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Download Event JSON
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const user = getAuthUser()
  const orgId = user?.orgId ?? ''
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState<DateRange>('30d')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<AuditLogEntry | null>(null)

  const days = DATE_RANGES.find((r) => r.value === dateFilter)?.days ?? 0
  const { data, isLoading } = useAuditLogs(orgId, days, page)
  const logs = data?.entries ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const actionOptions = [...new Set(logs.map((l) => l.action))].sort()

  const filtered = logs.filter((l) => {
    if (search) {
      const q = search.toLowerCase()
      const haystack = [l.action, l.actorEmail ?? '', l.resourceType, l.resourceId ?? ''].join(' ').toLowerCase()
      if (!haystack.includes(q)) return false
    }
    if (actionFilter !== 'all' && l.action !== actionFilter) return false
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top nav */}
      <header style={{ height: 50, borderBottom: '1px solid #c3c6d7', background: '#f8f9ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0, position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#004ac6' }}>Audit Log</span>
          <span style={{ padding: '2px 8px', background: '#dce3ec', color: '#5e656d', borderRadius: 4, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Internal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', display: 'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </button>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', display: 'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </button>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e5eeff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#004ac6' }}>
            {user ? initials(user.email ?? 'A') : 'A'}
          </div>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: 32, background: '#ffffff' }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>

          {/* Page header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 600, color: '#0b1c30', margin: '0 0 4px', letterSpacing: '-0.01em' }}>System Activity</h2>
              <p style={{ fontSize: 14, color: '#585f67', margin: 0 }}>Real-time trail of all administrative and automated actions within the brain.</p>
            </div>
            <button
              onClick={() => downloadCSV(orgId)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', border: '1px solid #737686', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 14, color: '#0b1c30', fontFamily: 'inherit' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#eff4ff' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <Download size={16} /> Export CSV
            </button>
          </div>

          {/* Filter bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, padding: '12px 0'}}>
            <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#737686' }} />
              <input
                type="text"
                placeholder="Search actor or resource..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%', paddingLeft: 40, paddingRight: 16, height: 40, border: '1px solid #c3c6d7', borderRadius: 12, background: '#ffffff', fontSize: 14, color: '#0b1c30', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#c3c6d7'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                style={{ appearance: 'none' as const, background: '#ffffff', border: '1px solid #c3c6d7', padding: '8px 16px', borderRadius: 12, fontSize: 14, color: '#0b1c30', cursor: 'pointer', fontFamily: 'inherit', outline: 'none' }}
              >
                <option value="all">Action Type: All</option>
                {actionOptions.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <select
                value={dateFilter}
                onChange={(e) => { setDateFilter(e.target.value as DateRange); setPage(1) }}
                style={{ appearance: 'none' as const, background: '#ffffff', border: '1px solid #c3c6d7', padding: '8px 16px', borderRadius: 12, fontSize: 14, color: '#0b1c30', cursor: 'pointer', fontFamily: 'inherit', outline: 'none' }}
              >
                {DATE_RANGES.map((r) => (
                  <option key={r.value} value={r.value}>{r.value === dateFilter ? `Date Range: ${r.label}` : r.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div style={{ border: '1px solid #c3c6d7', borderRadius: 12, overflow: 'hidden', background: '#ffffff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead style={{ background: '#eff4ff', borderBottom: '1px solid #c3c6d7' }}>
                <tr>
                  {['Timestamp', 'Actor', 'Action', 'Resource', 'Details'].map((h, i, arr) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: i === arr.length - 1 ? 'right' : 'left', fontSize: 11, fontWeight: 500, color: '#585f67', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ borderBottom: '1px solid #c3c6d7' }}>
                {isLoading && Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} style={{ padding: '8px 16px' }}><Skel h={24} /></td></tr>
                ))}
                {!isLoading && filtered.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 48, textAlign: 'center', color: '#585f67' }}>No audit log entries</td></tr>
                )}
                {filtered.map((log) => {
                  const isError = log.action.includes('fail') || log.action.includes('error') || log.action.includes('spike')
                  return (
                    <tr key={log.id}
                      style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                      onClick={() => setSelected(log)}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#fafbff' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#434655', whiteSpace: 'nowrap' }}>
                        {log.createdAt ? (formatDateTime(log.createdAt) || log.createdAt) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: isError ? '#ffdad6' : '#dbe1ff', color: isError ? '#93000a' : '#00174b', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {log.actorEmail ? initials(log.actorEmail) : '?'}
                          </div>
                          <span style={{ fontSize: 14, color: '#0b1c30' }}>{log.actorEmail ?? 'System'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: isError ? '#ba1a1a' : '#004ac6', fontWeight: 500 }}>
                        {log.action}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 14, color: '#434655' }}>{log.resourceType || log.resourceId || '—'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button onClick={(e) => { e.stopPropagation(); setSelected(log) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#004ac6', fontSize: 14, fontWeight: 500, fontFamily: 'inherit' }}>View</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {/* Pagination */}
            {total > 0 && (
              <div style={{ padding: '12px 16px', background: '#f8f9ff', borderTop: '1px solid #c3c6d7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: 12, color: '#585f67', margin: 0 }}>
                  Showing <strong style={{ color: '#0b1c30' }}>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}</strong> of <strong style={{ color: '#0b1c30' }}>{total}</strong> events
                  {(search || actionFilter !== 'all') && filtered.length !== logs.length && ` (${filtered.length} matching filters on this page)`}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #c3c6d7', background: '#ffffff', color: page <= 1 ? '#c3c6d7' : '#434655', fontSize: 13, cursor: page <= 1 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                  >
                    Previous
                  </button>
                  <span style={{ fontSize: 12, color: '#585f67' }}>Page {page} of {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #c3c6d7', background: '#ffffff', color: page >= totalPages ? '#c3c6d7' : '#434655', fontSize: 13, cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {selected && <DetailPanel entry={selected} onClose={() => setSelected(null)} />}

      <style>{`
        @keyframes cb-skel { 0%,100%{opacity:.5}50%{opacity:1} }
        @keyframes cb-slide-in { from{transform:translateX(100%)}to{transform:translateX(0)} }
      `}</style>
    </div>
  )
}
