'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Search, Send, BookOpen, FileText, Calendar,
  Copy, RefreshCw,
  Sparkles, Clock, CreditCard,
} from 'lucide-react'
import { toast } from 'sonner'
import { submitQuery as apiSubmitQuery } from '@/lib/api'
import { useExternalPricing, useStartCheckout, useSubscription } from '@/hooks/use-payments'
import { getAuthUser } from '@/lib/auth'
import { useChatHistory } from '@/lib/chat-history-context'
import { DocumentPreview } from '@/components/document-preview'
import { hasPermission } from '@company-brain/shared'
import type { ConversationTurn } from '@company-brain/shared'
import type { HistoryEntry } from '@/lib/chat-history-context'

type Plane = 'internal' | 'external'

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

function PlaneToggle({ plane, onChange, externalAvailable }: {
  plane: Plane
  onChange: (p: Plane) => void
  externalAvailable: boolean
}) {
  const options: { value: Plane; label: string }[] = [
    { value: 'internal', label: 'Internal' },
    { value: 'external', label: 'External' },
  ]
  return (
    <div
      role="group"
      aria-label="Preview knowledge plane"
      title={externalAvailable ? undefined : 'External plane requires a paid plan'}
      style={{ background: '#eff4ff', borderRadius: 8, padding: 3, display: 'flex', gap: 2 }}
    >
      {options.map(({ value, label }) => {
        const disabled = value === 'external' && !externalAvailable
        const active = plane === value
        return (
          <button
            key={value}
            disabled={disabled}
            onClick={() => onChange(value)}
            style={{
              padding: '5px 12px', borderRadius: 6, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
              fontSize: 12, fontWeight: active ? 600 : 400, fontFamily: 'inherit',
              color: disabled ? '#c3c6d7' : active ? '#004ac6' : '#585f67',
              background: active ? '#ffffff' : 'transparent',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              opacity: disabled ? 0.6 : 1,
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function PageHeader({ plane, onPlaneChange, showPlaneToggle, externalAvailable }: {
  plane: Plane
  onPlaneChange: (p: Plane) => void
  showPlaneToggle: boolean
  externalAvailable: boolean
}) {
  return (
    <header style={{ height: '64px', borderBottom: '1px solid #c3c6d7', background: '#f8f9ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0, position: 'sticky', top: 0, zIndex: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: '#004ac6' }}>Chat</span>
      </div>
      {showPlaneToggle && (
        <PlaneToggle plane={plane} onChange={onPlaneChange} externalAvailable={externalAvailable} />
      )}
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px 80px' }}>
        <div style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: '#0b1c30', margin: '0 0 8px' }}>{greeting}, {name.charAt(0).toUpperCase() + name.slice(1)}</h1>
            <p style={{ fontSize: 16, color: '#434655', margin: 0 }}>Ask anything from {user?.orgName || 'your organisation'}&apos;s knowledge base</p>
          </div>
          <div style={{ width: '100%', background: '#ffffff', borderRadius: 24, border: '1px solid #c3c6d7', padding: 8, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 10px 30px -10px rgba(0,0,0,0.06)' }}>
            <div style={{ paddingLeft: 12, color: '#737686', display: 'flex', alignItems: 'center' }}>
              <Search size={20} />
            </div>
            <input
              ref={textareaRef as unknown as React.RefObject<HTMLInputElement>}
              value={input}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onSubmit() } }}
              placeholder="Ask about policies, processes, documents…"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 16, color: '#0b1c30', padding: '9px 2px', fontFamily: 'inherit' }}
            />
            <button
              onClick={onSubmit}
              disabled={!input.trim() || disabled}
              style={{ background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 16, padding: '9px 9px', fontSize: 14, fontWeight: 600, cursor: (!input.trim() || disabled) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: (!input.trim() || disabled) ? 0.5 : 1, fontFamily: 'inherit', flexShrink: 0 }}
            >
              <Send size={14} />
            </button>
          </div>
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

function SourcePill({ filename, tier, onClick }: { filename: string; tier: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Preview document"
      style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#eff4ff', padding: '6px 12px', borderRadius: 9999, border: '1px solid #d3e4fe', cursor: 'pointer', fontFamily: 'inherit' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#e5eeff'; (e.currentTarget as HTMLElement).style.borderColor = '#2563eb' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#eff4ff'; (e.currentTarget as HTMLElement).style.borderColor = '#d3e4fe' }}
    >
      <FileText size={12} color="#004ac6" />
      <span style={{ fontSize: 12, color: '#434655' }}>{filename}</span>
      <span style={{ width: 1, height: 12, background: '#c3c6d7' }} />
      <span style={{ fontSize: 12, color: '#737686' }}>{tier}</span>
    </button>
  )
}

// ─── Active chat ──────────────────────────────────────────────────────────────

function ActiveChat({
  history, input, onChange, onSubmit, disabled, textareaRef,
  onToggle, onRetry, onNew, onPreviewDoc,
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
  onPreviewDoc: (docId: string) => void
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
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: 800, padding: '48px 32px', display: 'flex', flexDirection: 'column', gap: 40 }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#737686' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          {history.map((entry) => (
            <div key={entry.id} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ background: '#dce3ec', color: '#40484f', padding: '12px 20px', borderRadius: '16px 16px 4px 16px', maxWidth: '85%', fontSize: 14, lineHeight: 1.6 }}>
                  {entry.question}
                </div>
              </div>

              {entry.pending && (
                <div style={{ display: 'flex', gap: 8, padding: '16px 0' }}>
                  {[0, 1, 2].map((i) => (
                    <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#c3c6d7', display: 'inline-block', animation: `cb-pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                  <style>{`@keyframes cb-pulse{0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}`}</style>
                </div>
              )}

              {entry.error && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, background: '#ffdad6', color: '#ba1a1a', padding: '12px 16px', borderRadius: 8, fontSize: 14 }}>{entry.error}</div>
                  <button onClick={() => onRetry(entry.id, entry.question)} style={{ height: 36, padding: '0 12px', background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 8, fontSize: 14, cursor: 'pointer', color: '#585f67', fontFamily: 'inherit' }}>Retry</button>
                </div>
              )}

              {!entry.pending && !entry.error && entry.response && (
                <div style={{ background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 16, padding: 32, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Sparkles size={16} color="#ffffff" />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#004ac6' }}>Brain AI</span>
                  </div>

                  <div style={{ fontSize: 16, color: '#0b1c30', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {/* Answer */}
                  <div style={{ fontSize: 16, color: '#0b1c30', lineHeight: 1.7 }}>
                    {entry.response.answer}
                  </div>

                  {entry.response.citations && entry.response.citations.length > 0 && (
                    <div style={{ borderTop: '1px solid #c3c6d7', paddingTop: 24 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#737686', marginBottom: 12 }}>Sources</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {entry.response.citations.map((c) => (
                          <SourcePill key={c.chunkId} filename={c.filename ?? c.chunkId} tier="Internal" onClick={() => onPreviewDoc(c.documentId)} />
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 16 }}>
                    {[
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
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: '#ffffff', borderTop: '1px solid #c3c6d7', padding: '16px 32px 32px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 800 }}>
          <div style={{ border: '1px solid #c3c6d7', borderRadius: 16, background: '#ffffff', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { onChange(e.target.value); autoResize() }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onSubmit() } }}
              placeholder="Ask your data anything…"
              rows={1}
              style={{ width: '100%', padding: '16px', background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: '#0b1c30', resize: 'none', minHeight: 56, maxHeight: 160, fontFamily: 'inherit', lineHeight: 1.5 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 16px 12px' }}>
              <button
                onClick={onSubmit}
                disabled={!input.trim() || disabled}
                style={{ background: '#004ac6', color: '#ffffff', border: 'none', borderRadius: 30, padding: '9px 9px', fontSize: 14, fontWeight: 500, cursor: (!input.trim() || disabled) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: (!input.trim() || disabled) ? 0.5 : 1, fontFamily: 'inherit' }}
              >
                <Send size={14} />
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
  const canPreviewPlanes = !!user?.role && hasPermission(user.role, 'documents:manage')

  const searchParams = useSearchParams()
  const router = useRouter()

  const [plane, setPlane] = useState<Plane>('internal')
  const { data: sub } = useSubscription(orgId)
  const externalAvailable = sub?.plan === 'paid'

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

  const { history, setHistory, recentQueries, setRecentQueries, saveCurrentAsSession, pendingSession, pendingSessionToken, clearPendingSession } = useChatHistory()
  const [input, setInput] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [previewDocId, setPreviewDocId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Restore a clicked session, otherwise start fresh. Keyed on
  // pendingSessionToken (not just mount) so clicking a *different* saved
  // session in the sidebar while already on /chat still swaps the visible
  // history — a same-route Link is a no-op in Next, so this component
  // doesn't remount for that case.
  useEffect(() => {
    if (pendingSession) {
      setHistory(pendingSession)
      clearPendingSession()
    } else {
      setHistory([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSessionToken])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      setInput(q)
      router.replace('/chat')
      textareaRef.current?.focus()
    }
  }, [searchParams, router])

  // Use a plain async function instead of useMutation to avoid reset/dedup issues
  const submitQuery = useCallback(async (q: string, entryId?: string, historySnapshot?: ConversationTurn[]) => {
    const id = entryId ?? crypto.randomUUID()

    // Set pending state
    if (!entryId) {
      setHistory((prev) => [
        ...prev.map((h) => ({ ...h, expanded: false })),
        { id, question: q, pending: true as const, expanded: true },
      ])
    } else {
      setHistory((prev) => prev.map((h) => {
        if (h.id !== id) return h
        const { error: _e, response: _r, ...rest } = h
        return { ...rest, pending: true as const }
      }))
    }

    setIsPending(true)
    try {
      const result = await apiSubmitQuery(orgId, q, plane, historySnapshot?.length ? historySnapshot : undefined)
      if (!result.success) throw new Error(result.error.message)
      setHistory((prev) => prev.map((h) =>
        h.id === id ? { id, question: q, response: result.data, expanded: true } : h
      ))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      toast.error(message)
      setHistory((prev) => prev.map((h) =>
        h.id === id ? { id, question: q, error: message, expanded: true } : h
      ))
    } finally {
      setIsPending(false)
    }
  }, [orgId, plane])

  const buildHistorySnapshot = (): ConversationTurn[] =>
    history.flatMap((h) =>
      h.response ? [
        { role: 'user' as const, content: h.question },
        { role: 'assistant' as const, content: h.response.answer },
      ] : []
    )

  const handleSubmit = () => {
    const q = input.trim()
    if (!q || isPending) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    submitQuery(q, undefined, buildHistorySnapshot())
  }

  const isEmpty = history.length === 0

  const handleNewChat = () => {
    saveCurrentAsSession()
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  // Switching planes mid-conversation would mix answers grounded in different
  // document sets into one history sent back to the model as context — start
  // a fresh thread instead.
  const handlePlaneChange = (p: Plane) => {
    if (p === plane) return
    handleNewChat()
    setPlane(p)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        plane={plane}
        onPlaneChange={handlePlaneChange}
        showPlaneToggle={canPreviewPlanes}
        externalAvailable={externalAvailable}
      />
      {isExternalClient && !hasAccess ? (
        <SubscribeGate orgId={orgId} />
      ) : isEmpty ? (
        <EmptyState
          input={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          disabled={isPending}
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
          disabled={isPending}
          textareaRef={textareaRef}
          onToggle={(id) => setHistory((prev) => prev.map((h) => h.id === id ? { ...h, expanded: !h.expanded } : h))}
          onRetry={(id, q) => {
            const priorHistory = history
              .slice(0, history.findIndex((h) => h.id === id))
              .flatMap((h) => h.response ? [
                { role: 'user' as const, content: h.question },
                { role: 'assistant' as const, content: h.response.answer },
              ] : [])
            submitQuery(q, id, priorHistory)
          }}
          onNew={handleNewChat}
          onPreviewDoc={setPreviewDocId}
        />
      )}
      {previewDocId && (
        <DocumentPreview orgId={orgId} docId={previewDocId} onClose={() => setPreviewDocId(null)} />
      )}
    </div>
  )
}
