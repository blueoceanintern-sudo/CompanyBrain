'use client'

import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getAuthUser } from '@/lib/auth'
import { exportAuditLog } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002'

interface AuditEntry {
  id: string
  userId: string | null
  action: string
  resourceType: string
  resourceId: string | null
  createdAt: string
}

function useAuditLogs(orgId: string) {
  return useQuery({
    queryKey: ['audit-logs', orgId],
    queryFn: async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
      const res = await fetch(`${API_URL}/api/v1/orgs/${orgId}/analytics/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('Failed to fetch audit log')
      const text = await res.text()
      return text.trim().split('\n').slice(1).filter(Boolean).map((line): AuditEntry => {
        const [createdAt, userId, action, resourceType, resourceId] = line.split(',')
        return {
          id: crypto.randomUUID(),
          userId: userId || null,
          action: action ?? '',
          resourceType: resourceType ?? '',
          resourceId: resourceId || null,
          createdAt: createdAt ?? '',
        }
      })
    },
    enabled: !!orgId,
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

function Skeleton({ h }: { h: number }) {
  return <div style={{ height: h, background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', animation: 'cb-skel 1.5s ease-in-out infinite' }}>
    <style>{`@keyframes cb-skel { 0%,100% { opacity:.5 } 50% { opacity:1 } }`}</style>
  </div>
}

export default function AuditPage() {
  const user = getAuthUser()
  const orgId = user?.orgId ?? ''
  const { data: logs = [], isLoading } = useAuditLogs(orgId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ height: 'var(--header-h)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--space-8)', position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 10, flexShrink: 0 }}>
        <h1 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>Audit Log</h1>
        <button
          onClick={() => downloadCSV(orgId)}
          style={{ height: 'var(--input-h)', padding: '0 var(--space-4)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', fontSize: 'var(--text-sm)', cursor: 'pointer', color: 'var(--color-text)' }}
        >
          Export CSV
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} h={32} />)}
          </div>
        ) : (
          <table aria-label="Audit log" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
                {['Timestamp', 'Actor', 'Action', 'Resource type', 'Resource ID'].map((h) => (
                  <th key={h} style={{ padding: '0 var(--space-4)', height: 'var(--row-height-compact)', textAlign: 'left', fontWeight: 'var(--font-medium)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                  <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-medium)', margin: '0 0 var(--space-2)' }}>No audit log entries</p>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: 0 }}>Admin actions will appear here.</p>
                </td></tr>
              )}
              {logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0 var(--space-4)', height: 'var(--row-height-compact)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', whiteSpace: 'nowrap', width: 180 }}>
                    {log.createdAt ? formatDateTime(log.createdAt) : '—'}
                  </td>
                  <td style={{ padding: '0 var(--space-4)', height: 'var(--row-height-compact)', color: 'var(--color-text-muted)', width: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.userId ?? '—'}
                  </td>
                  <td style={{ padding: '0 var(--space-4)', height: 'var(--row-height-compact)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', width: 180 }}>
                    {log.action}
                  </td>
                  <td style={{ padding: '0 var(--space-4)', height: 'var(--row-height-compact)', width: 140 }}>{log.resourceType}</td>
                  <td style={{ padding: '0 var(--space-4)', height: 'var(--row-height-compact)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                    {log.resourceId ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
