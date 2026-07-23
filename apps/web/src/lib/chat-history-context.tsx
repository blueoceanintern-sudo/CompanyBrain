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
  pendingSessionToken: number
  clearPendingSession: () => void
}

const ChatHistoryContext = createContext<ChatHistoryContextValue | null>(null)

export function ChatHistoryProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [recentQueries, setRecentQueries] = useState<string[]>([])
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [pendingSession, setPendingSession] = useState<HistoryEntry[] | null>(null)
  // Bumped on every loadSession call (even reloading the same id) so the chat
  // page can react via useEffect even when the route doesn't change — a
  // pendingSession *value* alone doesn't change if you click the same
  // session twice in a row, and reference equality isn't guaranteed either.
  const [pendingSessionToken, setPendingSessionToken] = useState(0)
  const historyRef = useRef(history)
  historyRef.current = history
  const sessionsRef = useRef(sessions)
  sessionsRef.current = sessions
  // The session the current `history` was loaded from, if any — lets
  // saveCurrentAsSession update that session in place instead of always
  // minting a new one (which produced duplicate sidebar entries).
  const currentSessionIdRef = useRef<string | null>(null)

  const saveCurrentAsSession = useCallback(() => {
    const current = historyRef.current
    const loadedId = currentSessionIdRef.current
    currentSessionIdRef.current = null
    if (current.filter(e => e.response).length === 0 || !current[0]) return
    const rawTitle = current[0].question
    const title = rawTitle.length > 60 ? rawTitle.slice(0, 57) + '…' : rawTitle
    setSessions(prev => {
      const existingIdx = loadedId ? prev.findIndex(s => s.id === loadedId) : -1
      if (existingIdx !== -1) {
        const updated = [...prev]
        updated[existingIdx] = { ...updated[existingIdx]!, entries: current }
        return updated
      }
      return [
        { id: generateId(), title, entries: current, createdAt: new Date().toISOString() },
        ...prev.slice(0, 19),
      ]
    })
    setHistory([])
  }, [])

  const loadSession = useCallback((sessionId: string) => {
    if (sessionId === currentSessionIdRef.current) return
    // Persist whatever's currently open (a live conversation, or a
    // different loaded session with new messages) before switching away —
    // otherwise it's silently discarded when the new session overwrites it.
    saveCurrentAsSession()
    const session = sessionsRef.current.find(s => s.id === sessionId)
    if (!session) return
    currentSessionIdRef.current = sessionId
    setPendingSession(session.entries)
    setPendingSessionToken(t => t + 1)
  }, [saveCurrentAsSession])

  const clearPendingSession = useCallback(() => setPendingSession(null), [])

  return (
    <ChatHistoryContext.Provider value={{
      history, setHistory,
      recentQueries, setRecentQueries,
      sessions, saveCurrentAsSession, loadSession,
      pendingSession, pendingSessionToken, clearPendingSession,
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
