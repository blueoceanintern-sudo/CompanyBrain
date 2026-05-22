'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { SendHorizontal } from 'lucide-react'
import { useSubmitQuery } from '@/hooks/use-queries'
import { getAuthUser } from '@/lib/auth'
import type { QueryResponse } from '@company-brain/shared'

interface HistoryEntry {
  id: string
  question: string
  response: QueryResponse
  expanded: boolean
}

function ThreeDotPulse() {
  return (
    <div className="flex items-center gap-1.5 px-6 py-5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-2 rounded-full"
          style={{ background: 'var(--color-text-muted)', animation: `cb-pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
      <style>{`@keyframes cb-pulse{0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  )
}

function CitationLink({ index, citation }: { index: number; citation: { chunkId: string; excerpt?: string } }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <sup>
          <a href="#" onClick={(e) => e.preventDefault()} className="font-medium" style={{ color: 'var(--color-brand)', textDecoration: 'none', fontSize: '0.7em', padding: '0 1px' }}>
            [{index}]
          </a>
        </sup>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="text-xs font-medium mb-1">Source {index}</p>
        {citation.excerpt && <p className="text-xs opacity-80 line-clamp-3">{citation.excerpt.slice(0, 120)}{citation.excerpt.length > 120 ? '…' : ''}</p>}
        <p className="text-xs opacity-50 mt-1 font-mono">{citation.chunkId}</p>
      </TooltipContent>
    </Tooltip>
  )
}

function AnswerBubble({ response }: { response: QueryResponse }) {
  const { answer, confidence, citations = [] } = response
  if ((confidence ?? 0) < 0.5) {
    return <p className="italic text-sm" style={{ color: 'var(--color-text-muted)' }}>No answer found in the knowledge base.</p>
  }
  return (
    <div className="space-y-3">
      {confidence !== undefined && confidence < 0.7 && (
        <Badge style={{ background: 'var(--color-warning-subtle)', color: 'var(--color-warning)', border: 'none' }}>Low confidence</Badge>
      )}
      <div className="rounded-lg" style={{ background: 'var(--color-surface)', padding: 'var(--space-6)', color: 'var(--color-text)', lineHeight: 'var(--leading-relaxed)', fontSize: 'var(--text-base)', boxShadow: 'var(--shadow-sm)' }}>
        <TooltipProvider>
          {answer}
          {citations.map((c, i) => <CitationLink key={c.chunkId} index={i + 1} citation={c} />)}
        </TooltipProvider>
      </div>
      {citations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {citations.map((c, i) => (
            <span key={c.chunkId} className="text-xs rounded" style={{ color: 'var(--color-text-muted)', background: 'var(--color-surface)', padding: '2px var(--space-2)', fontFamily: 'var(--font-mono)' }}>
              [{i + 1}] {c.filename}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function HistoryItem({ entry, onToggle }: { entry: HistoryEntry; onToggle: () => void }) {
  return (
    <div className="border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
      <button
        onClick={onToggle}
        className="w-full text-left px-6 py-4 transition-colors hover:bg-[var(--color-surface)]"
        style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text)' }}
      >
        <span className="mr-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>{entry.expanded ? '▾' : '▸'}</span>
        {entry.question}
      </button>
      {entry.expanded && (
        <div className="px-6 pb-6"><AnswerBubble response={entry.response} /></div>
      )}
    </div>
  )
}

export default function ChatPage() {
  const user = getAuthUser()
  const orgId = user?.orgId ?? ''

  const [input, setInput] = useState('')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const submit = useSubmitQuery(orgId)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [history, submit.isPending])

  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  const handleSubmit = () => {
    const q = input.trim()
    if (!q || submit.isPending) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    submit.mutate(q, {
      onSuccess: (data) => {
        setHistory((prev) => [
          ...prev.map((h) => ({ ...h, expanded: false })),
          { id: crypto.randomUUID(), question: q, response: data, expanded: true },
        ])
      },
    })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center shrink-0 border-b sticky top-0 z-10" style={{ height: 'var(--header-h)', padding: '0 var(--space-8)', background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
        <h1 className="font-semibold" style={{ fontSize: 'var(--text-lg)' }}>Chat</h1>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto" style={{ maxWidth: 'min(800px, 100%)' }}>
          {history.length === 0 && !submit.isPending && (
            <div className="flex flex-col items-center justify-center py-24 gap-2 text-center">
              <p className="font-medium" style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text)' }}>Ask anything</p>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Query the knowledge base with a plain-language question.</p>
            </div>
          )}
          {history.map((entry) => (
            <HistoryItem key={entry.id} entry={entry} onToggle={() => setHistory((prev) => prev.map((h) => h.id === entry.id ? { ...h, expanded: !h.expanded } : h))} />
          ))}
          {submit.isPending && <ThreeDotPulse />}
        </div>
      </div>

      <div className="shrink-0 border-t sticky bottom-0" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', padding: 'var(--space-4) var(--space-8)' }}>
        <div className="mx-auto flex gap-3 items-end" style={{ maxWidth: 'min(800px, 100%)' }}>
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoResize() }}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleSubmit() } }}
            placeholder="Ask a question… (⌘ Enter to send)"
            rows={1}
            className="flex-1 resize-none overflow-hidden"
            style={{ minHeight: 'var(--input-h)', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)' }}
          />
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || submit.isPending}
            size="icon"
            style={{ height: 'var(--input-h)', width: 'var(--input-h)', borderRadius: 'var(--radius-lg)', flexShrink: 0 }}
          >
            <SendHorizontal size={16} aria-hidden />
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
