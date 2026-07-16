'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Database, MessageSquare, Link2, AlertTriangle, TrendingUp, TrendingDown, MoreHorizontal, ExternalLink } from 'lucide-react'
import { useAnalyticsOverview, useTopUnanswered } from '@/hooks/use-analytics'
import { getAuthUser } from '@/lib/auth'
import { formatDate, formatPercent } from '@/lib/utils'

const DAY_OPTIONS = [7, 30, 90] as const

function PageHeader() {
  return (
    <header style={{ height: 50, borderBottom: '1px solid #c3c6d7', background: '#f8f9ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0, position: 'sticky', top: 0, zIndex: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#004ac6' }}>Analytics</span>
        <span style={{ width: 1, height: 16, background: '#c3c6d7' }} />
        <span style={{ fontSize: 14, color: '#585f67' }}>Company&apos;s Brain</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </button>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </button>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e5eeff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#004ac6' }}>A</div>
      </div>
    </header>
  )
}

function StatCard({ label, value, icon: Icon, trend, trendUp, alert }: {
  label: string; value: string; icon: React.ElementType; trend?: string; trendUp?: boolean; alert?: boolean
}) {
  return (
    <div
      style={{ border: `1px solid ${alert ? '#fecaca' : '#e2e8f0'}`, borderRadius: 12, padding: 24, background: alert ? '#fef2f2' : '#ffffff', cursor: 'default' }}
      onMouseEnter={(e) => { if (!alert) (e.currentTarget as HTMLElement).style.borderColor = '#2563eb' }}
      onMouseLeave={(e) => { if (!alert) (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: alert ? '#b91c1c' : '#585f67' }}>{label}</span>
        <Icon size={20} color={alert ? '#dc2626' : '#004ac6'} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 24, fontWeight: 700, color: alert ? '#7f1d1d' : '#0b1c30' }}>{value}</span>
        {trend && (
          <span style={{ fontSize: 12, color: trendUp ? '#16a34a' : '#dc2626', display: 'flex', alignItems: 'center', gap: 2 }}>
            {trendUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {trend}
          </span>
        )}
      </div>
      {alert && <p style={{ fontSize: 11, color: '#dc2626', margin: '8px 0 0', opacity: 0.8 }}>Requires Immediate KB Update</p>}
    </div>
  )
}

function Skel({ h }: { h: number }) {
  return <div style={{ height: h, background: '#eff4ff', borderRadius: 8, animation: 'cb-skel 1.5s ease-in-out infinite' }} />
}

// ─── Query volume chart ───────────────────────────────────────────────────────

const CHART = { w: 600, h: 220, padLeft: 36, padRight: 10, padTop: 10, padBottom: 26 }

function niceCeil(n: number): number {
  if (n <= 5) return Math.max(n, 1)
  const mag = Math.pow(10, Math.floor(Math.log10(n)))
  return Math.ceil(n / mag) * mag
}

function QueryVolumeChart({ data }: { data: Array<{ date: string; count: number }> }) {
  const [hover, setHover] = useState<number | null>(null)

  const { w, h, padLeft, padRight, padTop, padBottom } = CHART
  const plotW = w - padLeft - padRight
  const plotH = h - padTop - padBottom

  const yMax = niceCeil(Math.max(...data.map((d) => d.count)))
  const x = (i: number) => padLeft + (data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2)
  const y = (count: number) => padTop + plotH - (count / yMax) * plotH

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.count).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${x(data.length - 1).toFixed(1)},${padTop + plotH} L${x(0).toFixed(1)},${padTop + plotH} Z`

  const yTicks = [...new Set([0, Math.round(yMax / 2), yMax])]
  const xTickCount = Math.min(6, data.length)
  const xTicks = Array.from({ length: xTickCount }, (_, i) => Math.round((i / (xTickCount - 1 || 1)) * (data.length - 1)))

  const fmtDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const relX = ((e.clientX - rect.left) / rect.width) * w
    const i = Math.round(((relX - padLeft) / plotW) * (data.length - 1))
    setHover(Math.max(0, Math.min(data.length - 1, i)))
  }

  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair' }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="Queries per day"
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={padLeft} x2={w - padRight} y1={y(t)} y2={y(t)} stroke="#f1f5f9" strokeWidth={1} />
            <text x={padLeft - 8} y={y(t) + 3.5} textAnchor="end" fontSize={11} fill="#737686">{t}</text>
          </g>
        ))}
        {xTicks.map((i) => (
          <text key={i} x={x(i)} y={h - 8} textAnchor="middle" fontSize={11} fill="#737686">
            {data[i] ? fmtDay(data[i].date) : ''}
          </text>
        ))}
        <path d={areaPath} fill="rgba(37,99,235,0.08)" />
        <path d={linePath} fill="none" stroke="#2563eb" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && data[hover] && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padTop} y2={padTop + plotH} stroke="#c3c6d7" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(data[hover].count)} r={4} fill="#2563eb" stroke="#ffffff" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hover !== null && data[hover] && (
        <div style={{
          position: 'absolute',
          left: `${(x(hover) / w) * 100}%`,
          top: `${(y(data[hover].count) / h) * 100}%`,
          transform: `translate(${hover > data.length / 2 ? 'calc(-100% - 12px)' : '12px'}, -50%)`,
          background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 8, padding: '6px 10px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)', pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          <p style={{ fontSize: 11, color: '#737686', margin: 0 }}>{fmtDay(data[hover].date)}</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#0b1c30', margin: 0 }}>
            {data[hover].count} {data[hover].count === 1 ? 'query' : 'queries'}
          </p>
        </div>
      )}
    </div>
  )
}

export default function AnalyticsPage() {
  const user = getAuthUser()
  const orgId = user?.orgId ?? ''
  const [days, setDays] = useState<7 | 30 | 90>(30)

  const { data: overview, isLoading: overviewLoading } = useAnalyticsOverview(orgId, days)
  const { data: unanswered = [], isLoading: unansweredLoading } = useTopUnanswered(orgId, days)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader />

      <div style={{ flex: 1, overflowY: 'auto', padding: 32, background: '#ffffff' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Section header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 700, color: '#0b1c30', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Intelligence Overview</h1>
              <p style={{ fontSize: 14, color: '#585f67', margin: 0 }}>Real-time performance metrics for your AI Knowledge Base.</p>
            </div>
            <div style={{ background: '#f1f5f9', borderRadius: 8, padding: 4, display: 'flex', gap: 2 }}>
              {DAY_OPTIONS.map((d) => (
                <button key={d} onClick={() => setDays(d)}
                  style={{ padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: days === d ? 600 : 400, color: days === d ? '#2563eb' : '#585f67', background: days === d ? '#ffffff' : 'transparent', boxShadow: days === d ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s', fontFamily: 'inherit' }}>
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
            {overviewLoading ? Array.from({ length: 4 }).map((_, i) => <Skel key={i} h={100} />) : (
              <>
                <StatCard label="KB Coverage" value={overview ? formatPercent(overview.kbCoverage) : '—'} icon={Database} alert={overview ? overview.kbCoverage < 70 : false} />
                <StatCard label="Query Volume" value={overview ? String(overview.queryVolume) : '—'} icon={MessageSquare} />
                <StatCard label="Citation Hit Rate" value={overview ? formatPercent(overview.citationHitRate) : '—'} icon={Link2} alert={overview ? overview.citationHitRate < 85 : false} />
                <StatCard label={`"I Don't Know" Rate`} value={overview ? formatPercent(overview.iDontKnowRate) : '—'} icon={AlertTriangle} alert={overview ? overview.iDontKnowRate > 15 : false} />
              </>
            )}
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

            {/* Query volume line chart */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, minHeight: 320, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: '#0b1c30', margin: 0 }}>Query Volume Over Time</h3>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', display: 'flex' }}><MoreHorizontal size={18} /></button>
              </div>
              {overviewLoading ? (
                <Skel h={220} />
              ) : !overview || overview.queryVolumeByDay.every((d) => d.count === 0) ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ fontSize: 14, color: '#737686', margin: 0 }}>No query data for this period.</p>
                </div>
              ) : (
                <QueryVolumeChart data={overview.queryVolumeByDay} />
              )}
            </div>

            {/* Top unanswered — progress bars */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, minHeight: 320, display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: '#0b1c30', margin: '0 0 24px' }}>Top Unanswered Queries</h3>
              {unansweredLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {Array.from({ length: 5 }).map((_, i) => <Skel key={i} h={24} />)}
                </div>
              ) : unanswered.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ fontSize: 14, color: '#737686', margin: 0 }}>No unanswered queries for this period.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {unanswered.slice(0, 6).map((q, i) => {
                    const max = Math.max(...unanswered.slice(0, 6).map((u) => u.count))
                    const pct = max > 0 ? (q.count / max) * 100 : 0
                    return (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 13, color: '#434655', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                            {q.queryText.length > 45 ? q.queryText.slice(0, 45) + '…' : q.queryText}
                          </span>
                          <span style={{ fontSize: 12, color: '#737686', flexShrink: 0 }}>{q.count}×</span>
                        </div>
                        <div style={{ width: '100%', background: '#e5eeff', height: 4, borderRadius: 2 }}>
                          <div style={{ width: `${pct}%`, background: '#2563eb', height: 4, borderRadius: 2 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Top unanswered table */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #c3c6d7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: '#0b1c30', margin: 0 }}>Top Unanswered Queries</h3>
              <button style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#004ac6', fontSize: 14, fontWeight: 500, fontFamily: 'inherit' }}>
                View all <ExternalLink size={14} />
              </button>
            </div>
            {unansweredLoading ? (
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Array.from({ length: 4 }).map((_, i) => <Skel key={i} h={32} />)}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead style={{ background: '#f8f9ff', borderBottom: '1px solid #c3c6d7' }}>
                  <tr>
                    {['Query Content', 'Frequency', 'Last Asked', 'Suggested Fix', 'Action'].map((h, i) => (
                      <th key={h} style={{ padding: '12px 24px', textAlign: i === 4 ? 'right' : 'left', fontSize: 12, fontWeight: 500, color: '#585f67' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {unanswered.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#737686', fontSize: 14 }}>No unanswered queries in this period.</td></tr>
                  ) : unanswered.map((q, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#fafbff' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <td style={{ padding: '16px 24px', color: '#0b1c30', fontWeight: 500 }}>{q.queryText}</td>
                      <td style={{ padding: '16px 24px', color: '#585f67' }}>{q.count} times</td>
                      <td style={{ padding: '16px 24px', color: '#585f67' }}>{formatDate(q.lastAsked)}</td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ background: '#eff4ff', color: '#004ac6', padding: '2px 10px', borderRadius: 9999, fontSize: 12 }}>Update Docs</span>
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <button onClick={() => toast.success('Added to training queue')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#004ac6', fontSize: 14, fontWeight: 500, fontFamily: 'inherit' }}>Train</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </div>
      </div>
      <style>{`@keyframes cb-skel { 0%,100%{opacity:.5}50%{opacity:1} }`}</style>
    </div>
  )
}
