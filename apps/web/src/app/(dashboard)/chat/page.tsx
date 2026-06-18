'use client'

import { useState, useRef, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Search, Send, BookOpen, FileText, Calendar,
  Paperclip, Globe, Bot, ThumbsUp, Copy, RefreshCw,
  Sparkles, Clock, Plus, CreditCard,
} from 'lucide-react'
import { toast } from 'sonner'
import { useSubmitQuery } from '@/hooks/use-queries'
import { useExternalPricing, useStartCheckout } from '@/hooks/use-payments'
import { getAuthUser } from '@/lib/auth'
import type { QueryResponse } from '@company-brain/shared'

interface HistoryEntry {
  id: string
  question: string
  response?: QueryResponse
  expanded: boolean
  pending?: true
  error?: string
}

const SUGGESTIONS = [
  { icon: BookOpen,  label: 'Company remote policy' },
  { icon: FileText,  label: 'Project Phoenix summary' },
  { icon: Calendar,  label: 'Holiday calendar 2024' },
]

// ─── External client subscribe gate ───────────────────────────────────────────

function SubscribeGate({ orgId }: { orgId: string }) {
  const { data: pricing, isLoading } = useExternalPricing(orgId)
  const checkout = useStartCheckout(orgId)

  const price = pricing?.priceCents != null
    ? `$${(pricing.priceCents / 100).toFixed(2)}/month`
    : null

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', padding: 32 }}>
      <div style={{ maxWidth: 460, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: '#e5eeff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CreditCard size={28} color="#004ac6" />
        </div>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#0b1c30', margin: '0 0 8px' }}>Subscribe to access</h2>
          <p style={{ fontSize: 15, color: '#585f67', margin: 0, lineHeight: 1.6 }}>Get full access to this organisation&apos;s knowledge base. Ask questions, find documents, and get AI-powered answers.</p>
        </div>
        {!isLoading && price && (
          <div style={{ padding: '16px 32px', background: '#eff4ff', borderRadius: 12, border: '1px solid #d3e4fe' }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: '#004ac6' }}>{price}</span>
          </div>
        )}
        <button
          onClick={() => checkout.mutate()}
          disabled={checkout.isPending || isLoading}
          style={{ padding: '14px 40px', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: checkout.isPending ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: checkout.isPending ? 0.7 : 1 }}
        >
          {checkout.isPending ? 'Redirecting to payment…' : 'Subscribe now'}
        </button>
        <p style={{ fontSize: 12, color: '#737686', margin: 0 }}>Secure payment via Stripe. Cancel anytime.</p>
      </div>
    </div>
  )
}

// ─── Header bar ───────────────────────────────────────────────────────────────

function PageHeader({ onNew }: { onNew?: () => void }) {
  return (
    <header style={{ height: 50, borderBottom: '1px solid #c3c6d7', background: '#f8f9ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0, position: 'sticky', top: 0, zIndex: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: '#004ac6' }}>Chat</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', display: 'flex', alignItems: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </button>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', display: 'flex', alignItems: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </button>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e5eeff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#004ac6' }}>A</div>
      </div>
    </header>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  input, onChange, onSubmit, disabled,
  textareaRef, recentQueries, onClearRecent,
}: {
  input: string
  onChange: (v: string) => void
  onSubmit: () => void
  disabled: boolean
  textareaRef: React.RefObject<HTMLTextAreaElement>
  recentQueries: string[]
  onClearRecent: () => void
}) {
  const user = getAuthUser()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const name = user?.email?.split('@')[0] ?? 'Alex'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#ffffff', overflow: 'hidden', position: 'relative' }}>
      {/* Centered content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px 80px' }}>
        <div style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
          {/* Heading */}
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: '#0b1c30', margin: '0 0 8px' }}>{greeting}, {name.charAt(0).toUpperCase() + name.slice(1)}</h1>
            <p style={{ fontSize: 16, color: '#434655', margin: 0 }}>Ask anything from BlueOcean&apos;s knowledge base</p>
          </div>

          {/* Search bar */}
          <div
            style={{ width: '100%', background: '#ffffff', borderRadius: 24, border: '1px solid #c3c6d7', padding: 8, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 10px 30px -10px rgba(0,0,0,0.08)' }}
          >
            <div style={{ paddingLeft: 12, color: '#737686', display: 'flex', alignItems: 'center' }}>
              <Search size={20} />
            </div>
            <input
              ref={textareaRef as unknown as React.RefObject<HTMLInputElement>}
              value={input}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit() } }}
              placeholder="Ask about policies, processes, documents…"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 16, color: '#0b1c30', padding: '12px 0', fontFamily: 'inherit' }}
            />
            <button
              onClick={onSubmit}
              disabled={!input.trim() || disabled}
              style={{ background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 16, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: (!input.trim() || disabled) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: (!input.trim() || disabled) ? 0.5 : 1, fontFamily: 'inherit', flexShrink: 0 }}
            >
              Send <Send size={14} />
            </button>
          </div>

          {/* Suggestion chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
            {SUGGESTIONS.map(({ icon: Icon, label }) => (
              <button
                key={label}
                onClick={() => onChange(label)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 9999, border: '1px solid #c3c6d7', background: '#ffffff', color: '#585f67', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#eff4ff' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#ffffff' }}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recent activity strip */}
      {recentQueries.length > 0 && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 32px 32px', background: 'linear-gradient(to top, #ffffff 60%, transparent)' }}>
          <div style={{ borderTop: '1px solid rgba(195,198,215,0.3)', paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#737686' }}>Recent Activity</span>
              <button onClick={onClearRecent} style={{ fontSize: 12, color: '#004ac6', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Clear all</button>
            </div>
            <div style={{ display: 'flex', gap: 32, overflowX: 'auto' }}>
              {recentQueries.map((item) => (
                <button
                  key={item}
                  onClick={() => onChange(item)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap', background: 'none', border: 'none', cursor: 'pointer', color: '#434655', fontSize: 14, fontFamily: 'inherit', padding: 0 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#0b1c30' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#434655' }}
                >
                  <Clock size={16} color="#737686" />
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Source pill ──────────────────────────────────────────────────────────────

function SourcePill({ filename, tier }: { filename: string; tier: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#eff4ff', padding: '6px 12px', borderRadius: 9999, border: '1px solid #d3e4fe', cursor: 'pointer' }}>
      <FileText size={12} color="#004ac6" />
      <span style={{ fontSize: 12, color: '#434655' }}>{filename}</span>
      <span style={{ width: 1, height: 12, background: '#c3c6d7' }} />
      <span style={{ fontSize: 12, color: '#737686' }}>{tier}</span>
    </div>
  )
}

// ─── Active chat ──────────────────────────────────────────────────────────────

function ActiveChat({
  history, input, onChange, onSubmit, disabled, textareaRef,
  onToggle, onRetry, onNew,
}: {
  history: HistoryEntry[]
  input: string
  onChange: (v: string) => void
  onSubmit: () => void
  disabled: boolean
  textareaRef: React.RefObject<HTMLTextAreaElement>
  onToggle: (id: string) => void
  onRetry: (id: string, q: string) => void
  onNew: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [history])

  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#ffffff', overflow: 'hidden' }}>
      {/* Scrollable messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: 800, padding: '48px 32px', display: 'flex', flexDirection: 'column', gap: 40 }}>
          {/* Date divider */}
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#737686' }}>Yesterday</span>
          </div>

          {history.map((entry) => (
            <div key={entry.id} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* User message */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ background: '#dce3ec', color: '#40484f', padding: '12px 20px', borderRadius: '16px 16px 4px 16px', maxWidth: '85%', fontSize: 14, lineHeight: 1.6 }}>
                  {entry.question}
                </div>
              </div>

              {/* Pending */}
              {entry.pending && (
                <div style={{ display: 'flex', gap: 8, padding: '16px 0' }}>
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="inline-block w-2 h-2 rounded-full" style={{ background: '#c3c6d7', animation: `cb-pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                  <style>{`@keyframes cb-pulse{0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}`}</style>
                </div>
              )}

              {/* Error */}
              {entry.error && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, background: '#ffdad6', color: '#ba1a1a', padding: '12px 16px', borderRadius: 8, fontSize: 14 }}>{entry.error}</div>
                  <button onClick={() => onRetry(entry.id, entry.question)} style={{ height: 36, padding: '0 12px', background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 8, fontSize: 14, cursor: 'pointer', color: '#585f67', fontFamily: 'inherit' }}>Retry</button>
                </div>
              )}

              {/* AI response */}
              {!entry.pending && !entry.error && entry.response && (
                <div style={{ background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 16, padding: 32, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Sparkles size={16} color="#ffffff" />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#004ac6' }}>Brain AI</span>
                  </div>

                  {/* Answer */}
                  <div style={{ fontSize: 16, color: '#0b1c30', lineHeight: 1.7 }}>
                    {(entry.response.confidence ?? 1) < 0.5 ? (
                      <p style={{ color: '#585f67', fontStyle: 'italic' }}>No answer found in the knowledge base.</p>
                    ) : (
                      entry.response.answer
                    )}
                  </div>

                  {/* Sources */}
                  {entry.response.citations && entry.response.citations.length > 0 && (
                    <div style={{ borderTop: '1px solid #c3c6d7', paddingTop: 24 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#737686', marginBottom: 12 }}>Sources</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {entry.response.citations.map((c) => (
                          <SourcePill key={c.chunkId} filename={c.filename ?? c.chunkId} tier="Internal" />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 16 }}>
                    {[
                      { icon: ThumbsUp, label: 'Helpful', onClick: () => toast.success('Marked as helpful') },
                      { icon: Copy, label: 'Copy', onClick: () => { navigator.clipboard.writeText(entry.response?.answer ?? '').then(() => toast.success('Copied to clipboard')) } },
                      { icon: RefreshCw, label: 'Regenerate', onClick: () => onRetry(entry.id, entry.question) },
                    ].map(({ icon: Icon, label, onClick }) => (
                      <button
                        key={label}
                        onClick={onClick}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#737686', fontSize: 12, fontFamily: 'inherit', padding: 0 }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#004ac6' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#737686' }}
                      >
                        <Icon size={16} /> {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Sticky input */}
      <div style={{ background: '#ffffff', borderTop: '1px solid #c3c6d7', padding: '16px 32px 32px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 800 }}>
          <div style={{ border: '1px solid #c3c6d7', borderRadius: 16, background: '#ffffff', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', transition: 'border-color 0.2s' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { onChange(e.target.value); autoResize() }}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); onSubmit() } }}
              placeholder="Ask your data anything…"
              rows={1}
              style={{ width: '100%', padding: '16px', background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: '#0b1c30', resize: 'none', minHeight: 56, maxHeight: 160, fontFamily: 'inherit', lineHeight: 1.5 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 12px' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[
                  { Icon: Paperclip, title: 'Attach file', handler: () => toast.info('File attachments coming soon') },
                  { Icon: Globe, title: 'Web search', handler: () => toast.info('Web search coming soon') },
                  { Icon: Bot, title: 'AI settings', handler: () => toast.info('AI model selection coming soon') },
                ].map(({ Icon, title, handler }) => (
                  <button key={title} title={title} onClick={handler} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', borderRadius: 8 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#eff4ff'; (e.currentTarget as HTMLElement).style.color = '#004ac6' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = '#585f67' }}
                  >
                    <Icon size={18} />
                  </button>
                ))}
              </div>
              <button
                onClick={onSubmit}
                disabled={!input.trim() || disabled}
                style={{ background: '#004ac6', color: '#ffffff', border: 'none', borderRadius: 10, padding: '8px 20px', fontSize: 14, fontWeight: 500, cursor: (!input.trim() || disabled) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: (!input.trim() || disabled) ? 0.5 : 1, fontFamily: 'inherit' }}
              >
                Send <Send size={14} />
              </button>
            </div>
          </div>
          <p style={{ fontSize: 10, textAlign: 'center', color: '#737686', marginTop: 10 }}>Brain AI can make mistakes. Please verify important information.</p>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const user = getAuthUser()
  const orgId = user?.orgId ?? ''
  const isExternalClient = user?.role === 'external_client'

  const searchParams = useSearchParams()
  const router = useRouter()

  const [hasAccess, setHasAccess] = useState(() => {
    if (!isExternalClient) return true
    if (typeof window === 'undefined') return false
    return localStorage.getItem(`cb_ext_access_${orgId}`) === '1'
  })

  useEffect(() => {
    if (!isExternalClient) return
    const checkout = searchParams.get('checkout')
    if (checkout === 'success') {
      localStorage.setItem(`cb_ext_access_${orgId}`, '1')
      setHasAccess(true)
      toast.success('Subscription active — welcome!')
      router.replace('/chat')
    } else if (checkout === 'cancel') {
      toast.info('Checkout cancelled')
      router.replace('/chat')
    }
  }, [searchParams, router, orgId, isExternalClient])

  const [input, setInput] = useState('')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [recentQueries, setRecentQueries] = useState<string[]>([])
  const submit = useSubmitQuery(orgId)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const submitQuery = (q: string, entryId?: string) => {
    const id = entryId ?? crypto.randomUUID()
    if (!entryId) {
      setHistory((prev) => [
        ...prev.map((h) => ({ ...h, expanded: false })),
        { id, question: q, pending: true as const, expanded: true },
      ])
    } else {
      setHistory((prev) => prev.map((h) => {
        if (h.id !== id) return h
        const { error: _removed, ...rest } = h
        return { ...rest, pending: true as const }
      }))
    }
    submit.mutate(q, {
      onSuccess: (data) => {
        setHistory((prev) => prev.map((h) =>
          h.id === id ? { id, question: q, response: data, expanded: true } : h
        ))
      },
      onError: (err: Error) => {
        setHistory((prev) => prev.map((h) =>
          h.id === id ? { id, question: q, error: err.message, expanded: true } : h
        ))
      },
    })
  }

  const handleSubmit = () => {
    const q = input.trim()
    if (!q || submit.isPending) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    submitQuery(q)
  }

  const isEmpty = history.length === 0

  const handleNewChat = () => {
    const questions = history.map((h) => h.question).filter(Boolean)
    setRecentQueries((prev) => {
      const merged = [...questions.filter((q) => !prev.includes(q)), ...prev]
      return merged.slice(0, 8)
    })
    setHistory([])
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader onNew={handleNewChat} />
      {isExternalClient && !hasAccess ? (
        <SubscribeGate orgId={orgId} />
      ) : isEmpty ? (
        <EmptyState
          input={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          disabled={submit.isPending}
          textareaRef={textareaRef as React.RefObject<HTMLTextAreaElement>}
          recentQueries={recentQueries}
          onClearRecent={() => setRecentQueries([])}
        />
      ) : (
        <ActiveChat
          history={history}
          input={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          disabled={submit.isPending}
          textareaRef={textareaRef}
          onToggle={(id) => setHistory((prev) => prev.map((h) => h.id === id ? { ...h, expanded: !h.expanded } : h))}
          onRetry={(id, q) => submitQuery(q, id)}
          onNew={handleNewChat}
        />
      )}

    </div>
  )
}
