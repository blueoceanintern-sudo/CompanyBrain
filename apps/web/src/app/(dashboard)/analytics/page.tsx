'use client'

import { useState } from 'react'
import { useAnalyticsOverview, useTopUnanswered } from '@/hooks/use-analytics'
import { getAuthUser } from '@/lib/auth'
import { MOCK_USER } from '@/lib/mock-data'
import { formatDate, formatPercent } from '@/lib/utils'

const DAY_OPTIONS = [7, 30, 90] as const

function Skeleton({ h }: { h: number }) {
  return <div style={{ height: h, background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', animation: 'cb-skel 1.5s ease-in-out infinite' }}>
    <style>{`@keyframes cb-skel { 0%,100% { opacity:.5 } 50% { opacity:1 } }`}</style>
  </div>
}

function StatCard({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div style={{ background: 'var(--color-surface-raised)', border: `1px solid ${alert ? 'var(--color-warning)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)' }}>
      <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-semibold)', color: alert ? 'var(--color-warning)' : 'var(--color-text)', margin: 0 }}>{value}</p>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: 'var(--space-2) 0 0' }}>{label}</p>
    </div>
  )
}

export default function AnalyticsPage() {
  const user = getAuthUser() ?? MOCK_USER
  const orgId = user.orgId
  const [days, setDays] = useState<7 | 30 | 90>(30)

  const { data: overview, isLoading: overviewLoading } = useAnalyticsOverview(orgId, days)
  const { data: unanswered = [], isLoading: unansweredLoading } = useTopUnanswered(orgId, days)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ height: 'var(--header-h)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--space-8)', position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 10, flexShrink: 0 }}>
        <h1 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>Analytics</h1>

        {/* Date range segmented control */}
        <div role="group" aria-label="Date range" style={{ display: 'flex', gap: 'var(--space-1)' }}>
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              aria-pressed={days === d}
              style={{ height: 28, padding: '0 var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: days === d ? 'var(--color-brand-subtle)' : 'transparent', color: days === d ? 'var(--color-brand)' : 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: days === d ? 'var(--font-medium)' : 'var(--font-normal)', cursor: 'pointer' }}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-8)' }}>
        <div style={{ width: 'min(1200px, 100%)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
            {overviewLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={100} />) : (
              <>
                <StatCard label="KB Coverage" value={formatPercent(overview?.kbCoverage ?? 0)} alert={(overview?.kbCoverage ?? 0) < 70} />
                <StatCard label="Query Volume" value={String(overview?.queryVolume ?? 0)} />
                <StatCard label="Citation Hit Rate" value={formatPercent(overview?.citationHitRate ?? 0)} alert={(overview?.citationHitRate ?? 0) < 85} />
                <StatCard label="I Don't Know Rate" value={formatPercent(overview?.iDontKnowRate ?? 0)} alert={(overview?.iDontKnowRate ?? 0) > 15} />
              </>
            )}
          </div>

          {/* Top unanswered table */}
          <div style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--color-border)' }}>
              <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', margin: 0 }}>Top unanswered queries</h2>
            </div>

            {unansweredLoading ? (
              <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={var_row_compact()} />)}
              </div>
            ) : (
              <table aria-label="Top unanswered queries" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {['Query', 'Count', 'Last asked'].map((h) => (
                      <th key={h} style={{ padding: '0 var(--space-4)', height: 'var(--row-height-compact)', textAlign: 'left', fontWeight: 'var(--font-medium)', color: 'var(--color-text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {unanswered.length === 0 && (
                    <tr><td colSpan={3} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>No unanswered queries in this period.</td></tr>
                  )}
                  {unanswered.map((q, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '0 var(--space-4)', height: 'var(--row-height-compact)' }}>{q.queryText}</td>
                      <td style={{ padding: '0 var(--space-4)', height: 'var(--row-height-compact)', width: 80 }}>{q.count}</td>
                      <td style={{ padding: '0 var(--space-4)', height: 'var(--row-height-compact)', width: 120, color: 'var(--color-text-muted)' }}>{formatDate(q.lastAsked)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

function var_row_compact() { return 32 }
