'use client'

import { useState } from 'react'
import { Database, MessageSquare, Link2, AlertTriangle, TrendingUp, TrendingDown, MoreHorizontal, ExternalLink } from 'lucide-react'
import { useAnalyticsOverview, useTopUnanswered } from '@/hooks/use-analytics'
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
  label: string; value: string; icon: React.ElementType; trend?: string; trendUp?: boolean; alert?: boolean
}) {
  return (
    <div style={{ border: `1px solid ${alert ? '#fecaca' : '#e2e8f0'}`, borderRadius: 12, padding: 24, background: alert ? '#fef2f2' : '#ffffff', transition: 'border-color 0.2s', cursor: 'default' }}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

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
            {/* Segmented control */}
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
                <StatCard label="KB Coverage" value={formatPercent(overview?.kbCoverage ?? 0.942)} icon={Database} trend="2.1%" trendUp />
                <StatCard label="Query Volume" value={overview?.queryVolume ? String(overview.queryVolume) : '12.4k'} icon={MessageSquare} trend="15%" trendUp />
                <StatCard label="Citation Hit Rate" value={formatPercent(overview?.citationHitRate ?? 0.885)} icon={Link2} trend="0.4%" trendUp={false} />
                <StatCard label={`"I Don't Know" Rate`} value={formatPercent(overview?.iDontKnowRate ?? 0.042)} icon={AlertTriangle} trend="1.2%" trendUp alert />
              </>
            )}
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Line chart */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, minHeight: 320, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: '#0b1c30', margin: 0 }}>Query Volume Over Time</h3>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', display: 'flex' }}><MoreHorizontal size={18} /></button>
              </div>
              <div style={{ flex: 1, position: 'relative', backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)', backgroundSize: '20px 20px', borderRadius: 8, overflow: 'hidden' }}>
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', padding: 16 }} viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path d="M0,80 Q10,75 20,60 T40,65 T60,40 T80,30 T100,10" fill="none" stroke="#2563eb" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  {[[20,60],[40,65],[60,40],[80,30]].map(([cx, cy], i) => (
                    <circle key={i} cx={cx} cy={cy} r="1.5" fill="#2563eb" />
                  ))}
                </svg>
                <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: '0 16px' }}>
                  {['01 May','08 May','15 May','22 May','29 May'].map((d) => (
                    <span key={d} style={{ fontSize: 10, color: '#585f67' }}>{d}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Bar chart */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, minHeight: 320, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: '#0b1c30', margin: 0 }}>Unanswered Queries by Category</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb' }} />
                  <span style={{ fontSize: 11, color: '#585f67' }}>Missed</span>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: 16, paddingBottom: 32 }}>
                {[
                  { label: 'Billing',    h: '40%' },
                  { label: 'Technical',  h: '90%' },
                  { label: 'Product',    h: '25%' },
                  { label: 'Security',   h: '60%' },
                  { label: 'Policy',     h: '15%' },
                ].map(({ label, h }) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: 8 }}>
                    <div style={{ width: '100%', background: '#2563eb', height: h, borderRadius: '4px 4px 0 0', maxWidth: 40 }} />
                    <span style={{ fontSize: 10, color: '#585f67', transform: 'rotate(45deg)', transformOrigin: 'left', whiteSpace: 'nowrap', marginTop: 8 }}>{label}</span>
                  </div>
                ))}
              </div>
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
                  {/* Static preview rows + real data */}
                  {(unanswered.length > 0 ? unanswered.map((q) => ({
                    query: q.queryText,
                    freq: `${q.count} times`,
                    last: formatDate(q.lastAsked),
                    fix: 'Update Docs',
                    fixBg: '#eff4ff',
                    fixColor: '#004ac6',
                  })) : [
                    { query: '"How do I reset my SSO token if locked out?"', freq: '42 times', last: '2 hours ago', fix: 'Add Security Doc', fixBg: '#eff4ff', fixColor: '#004ac6' },
                    { query: '"What is the current policy on API rate limiting?"', freq: '38 times', last: '5 hours ago', fix: 'Update API Docs', fixBg: '#eff4ff', fixColor: '#004ac6' },
                    { query: '"Integrate with Jira Service Management?"', freq: '29 times', last: 'Yesterday', fix: 'Link External Guide', fixBg: '#eff4ff', fixColor: '#004ac6' },
                    { query: '"Pricing for Enterprise High-Availability tier?"', freq: '12 times', last: '2 days ago', fix: 'Handover Only', fixBg: '#f1f5f9', fixColor: '#585f67' },
                  ]).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#fafbff' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <td style={{ padding: '16px 24px', color: '#0b1c30', fontWeight: 500 }}>{row.query}</td>
                      <td style={{ padding: '16px 24px', color: '#585f67' }}>{row.freq}</td>
                      <td style={{ padding: '16px 24px', color: '#585f67' }}>{row.last}</td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ background: row.fixBg, color: row.fixColor, padding: '2px 10px', borderRadius: 9999, fontSize: 12 }}>{row.fix}</span>
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#004ac6', fontSize: 14, fontWeight: 500, fontFamily: 'inherit' }}>Train</button>
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
