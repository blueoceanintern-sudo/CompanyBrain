'use client'

import { createContext, useContext, useState, useRef, useCallback } from 'react'
import type { QueryResponse } from '@company-brain/shared'
import { generateId } from '@/lib/utils'

export interface HistoryEntry {
  id: string
  question: string
  response?: QueryResponse
  expanded: boolean
  pending?: true
  error?: string
}

export interface ChatSession {
  id: string
  title: string
  entries: HistoryEntry[]
  createdAt: string
}

interface ChatHistoryContextValue {
  history: HistoryEntry[]
  setHistory: React.Dispatch<React.SetStateAction<HistoryEntry[]>>
  recentQueries: string[]
  setRecentQueries: React.Dispatch<React.SetStateAction<string[]>>
  sessions: ChatSession[]
  saveCurrentAsSession: () => void
  loadSession: (sessionId: string) => void
  pendingSession: HistoryEntry[] | null
  clearPendingSession: () => void
}

const ChatHistoryContext = createContext<ChatHistoryContextValue | null>(null)

export function ChatHistoryProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [recentQueries, setRecentQueries] = useState<string[]>([])
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [pendingSession, setPendingSession] = useState<HistoryEntry[] | null>(null)
  const historyRef = useRef(history)
  historyRef.current = history

  const saveCurrentAsSession = useCallback(() => {
    const current = historyRef.current
    if (current.filter(e => e.response).length === 0 || !current[0]) return
    const rawTitle = current[0].question
    const title = rawTitle.length > 60 ? rawTitle.slice(0, 57) + '…' : rawTitle
    setSessions(prev => [
      { id: generateId(), title, entries: current, createdAt: new Date().toISOString() },
      ...prev.slice(0, 19),
    ])
    setHistory([])
  }, [])

  const loadSession = useCallback((sessionId: string) => {
    setSessions(prev => {
      const session = prev.find(s => s.id === sessionId)
      if (session) setPendingSession(session.entries)
      return prev
    })
  }, [])

  const clearPendingSession = useCallback(() => setPendingSession(null), [])

  return (
    <ChatHistoryContext.Provider value={{
      history, setHistory,
      recentQueries, setRecentQueries,
      sessions, saveCurrentAsSession, loadSession,
      pendingSession, clearPendingSession,
    }}>
      {children}
    </ChatHistoryContext.Provider>
  )
}

export function useChatHistory() {
  const ctx = useContext(ChatHistoryContext)
  if (!ctx) throw new Error('useChatHistory must be used within ChatHistoryProvider')
  return ctx
}
