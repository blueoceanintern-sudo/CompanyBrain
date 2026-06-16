'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Database, MessageSquare, Link2, AlertTriangle, TrendingUp, TrendingDown, MoreHorizontal, ExternalLink } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useAnalyticsOverview, useQueryTimeSeries, useTopUnanswered } from '@/hooks/use-analytics'
import { getAuthUser } from '@/lib/auth'
import { formatDate, formatPercent } from '@/lib/utils'

const DAY_OPTIONS = [7, 30, 90] as const

// ─── Header ───────────────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <header style={{ height: 50, borderBottom: '1px solid #c3c6d7', background: '#f8f9ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0, position: 'sticky', top: 0, zIndex: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#004ac6' }}>Analytics</span>
        <span style={{ width: 1, height: 16, background: '#c3c6d7' }} />
        <span style={{ fontSize: 14, color: '#585f67' }}>Company&apos;s Brain</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ padding: '4px 12px', background: '#e5eeff', color: '#434655', borderRadius: 9999, fontSize: 13 }}>Status: Internal</span>
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

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, trend, trendUp, alert }: {
  label: string
  value: string
  icon: React.ElementType
  trend?: string
  trendUp?: boolean
  alert?: boolean
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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skel({ h }: { h: number }) {
  return <div style={{ height: h, background: '#eff4ff', borderRadius: 8, animation: 'cb-skel 1.5s ease-in-out infinite' }} />
}

// ─── Custom tooltip for recharts ──────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #c3c6d7', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <p style={{ color: '#585f67', marginBottom: 4 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color, margin: 0, fontWeight: 600 }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const user = getAuthUser()
  const orgId = user?.orgId ?? ''
  const [days, setDays] = useState<7 | 30 | 90>(30)

  const { data: overview, isLoading: overviewLoading } = useAnalyticsOverview(orgId, days)
  const { data: timeSeries = [], isLoading: timeSeriesLoading } = useQueryTimeSeries(orgId, days)
  const { data: unanswered = [], isLoading: unansweredLoading } = useTopUnanswered(orgId, days)

  // Format date labels for x-axis depending on range
  const formatXAxis = (dateStr: string) => {
    const date = new Date(dateStr)
    if (days === 7) return date.toLocaleDateString('en', { weekday: 'short' })
    return date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
  }

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
            {/* Day range segmented control */}
            <div style={{ background: '#f1f5f9', borderRadius: 8, padding: 4, display: 'flex', gap: 2 }}>
              {DAY_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  style={{ padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: days === d ? 600 : 400, color: days === d ? '#2563eb' : '#585f67', background: days === d ? '#ffffff' : 'transparent', boxShadow: days === d ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s', fontFamily: 'inherit' }}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
            {overviewLoading
              ? Array.from({ length: 4 }).map((_, i) => <Skel key={i} h={100} />)
              : (
                <>
                  <StatCard
                    label="KB Coverage"
                    value={overview ? formatPercent(overview.kbCoverage) : '—'}
                    icon={Database}
                    alert={overview ? overview.kbCoverage < 70 : false}
                  />
                  <StatCard
                    label="Query Volume"
                    value={overview ? String(overview.queryVolume) : '—'}
                    icon={MessageSquare}
                  />
                  <StatCard
                    label="Citation Hit Rate"
                    value={overview ? formatPercent(overview.citationHitRate) : '—'}
                    icon={Link2}
                    alert={overview ? overview.citationHitRate < 85 : false}
                  />
                  <StatCard
                    label={`"I Don't Know" Rate`}
                    value={overview ? formatPercent(overview.iDontKnowRate) : '—'}
                    icon={AlertTriangle}
                    alert={overview ? overview.iDontKnowRate > 15 : false}
                  />
                </>
              )}
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

            {/* Line chart — query volume over time */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, minHeight: 320, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: '#0b1c30', margin: 0 }}>Query Volume Over Time</h3>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', display: 'flex' }}>
                  <MoreHorizontal size={18} />
                </button>
              </div>
              {timeSeriesLoading ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
                  <Skel h={200} />
                </div>
              ) : timeSeries.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ fontSize: 14, color: '#737686', margin: 0 }}>No query data for this period.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={timeSeries} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#737686' }}
                      tickFormatter={formatXAxis}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#737686' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="Total"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#2563eb' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="answered"
                      name="Answered"
                      stroke="#16a34a"
                      strokeWidth={2}
                      dot={false}
                      strokeDasharray="4 2"
                      activeDot={{ r: 4, fill: '#16a34a' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
              {/* Legend */}
              {!timeSeriesLoading && timeSeries.length > 0 && (
                <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                  {[{ color: '#2563eb', label: 'Total queries' }, { color: '#16a34a', label: 'Answered', dashed: true }].map(({ color, label, dashed }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 16, height: 2, background: color, borderRadius: 1, borderTop: dashed ? `2px dashed ${color}` : undefined, backgroundColor: dashed ? 'transparent' : color }} />
                      <span style={{ fontSize: 12, color: '#737686' }}>{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bar chart — top unanswered queries */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, minHeight: 320, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: '#0b1c30', margin: 0 }}>Top Unanswered Queries</h3>
              </div>
              {unansweredLoading ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
                  {Array.from({ length: 4 }).map((_, i) => <Skel key={i} h={24} />)}
                </div>
              ) : unanswered.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ fontSize: 14, color: '#737686', margin: 0 }}>No unanswered queries for this period.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={unanswered.slice(0, 6).map((q) => ({
                      name: q.queryText.length > 28 ? q.queryText.slice(0, 28) + '…' : q.queryText,
                      count: q.count,
                    }))}
                    layout="vertical"
                    margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#737686' }} tickLine={false} axisLine={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#737686' }}
                      tickLine={false}
                      axisLine={false}
                      width={120}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Count" fill="#2563eb" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
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
                    <tr>
                      <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#737686', fontSize: 14 }}>
                        No unanswered queries in this period.
                      </td>
                    </tr>
                  ) : unanswered.map((q, i) => (
                    <tr
                      key={i}
                      style={{ borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#fafbff' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <td style={{ padding: '16px 24px', color: '#0b1c30', fontWeight: 500 }}>{q.queryText}</td>
                      <td style={{ padding: '16px 24px', color: '#585f67' }}>{q.count} times</td>
                      <td style={{ padding: '16px 24px', color: '#585f67' }}>{formatDate(q.lastAsked)}</td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ background: '#eff4ff', color: '#004ac6', padding: '2px 10px', borderRadius: 9999, fontSize: 12 }}>
                          Update Docs
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <button
                          onClick={() => toast.success('Added to training queue')}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#004ac6', fontSize: 14, fontWeight: 500, fontFamily: 'inherit' }}
                        >
                          Train
                        </button>
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
