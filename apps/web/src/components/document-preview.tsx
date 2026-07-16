'use client'

import { useQuery } from '@tanstack/react-query'
import { FileText, X, EyeOff } from 'lucide-react'
import { getDocumentContent, unwrap, ApiError } from '@/lib/api'

function useDocumentContent(orgId: string, docId: string) {
  return useQuery({
    queryKey: ['document-content', orgId, docId],
    queryFn: async () => unwrap(await getDocumentContent(orgId, docId)),
    enabled: !!orgId && !!docId,
    retry: (failureCount, error) =>
      !(error instanceof ApiError && (error.code === 'FORBIDDEN' || error.code === 'NOT_FOUND')) && failureCount < 2,
  })
}

export function DocumentPreview({ orgId, docId, onClose }: {
  orgId: string
  docId: string
  onClose: () => void
}) {
  const { data, isLoading, error } = useDocumentContent(orgId, docId)

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(11,28,48,0.3)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: 24 }}
    >
      <div style={{ background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 12, width: 'min(760px, 100%)', maxHeight: '85vh', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #c3c6d7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <FileText size={18} color="#004ac6" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: '#0b1c30', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {data?.filename ?? 'Document preview'}
            </span>
            {data && (
              <span style={{ padding: '2px 10px', background: '#eff4ff', color: '#004ac6', borderRadius: 9999, fontSize: 11, fontWeight: 600, textTransform: 'capitalize', flexShrink: 0 }}>
                {data.accessTier}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', display: 'flex', padding: 4, flexShrink: 0 }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {isLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[90, 100, 95, 60, 100, 80].map((w, i) => (
                <div key={i} style={{ height: 14, width: `${w}%`, background: '#eff4ff', borderRadius: 6, animation: 'cb-skel 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          )}
          {!isLoading && error && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 0', textAlign: 'center' }}>
              <EyeOff size={28} color="#737686" />
              <p style={{ fontSize: 14, color: '#585f67', margin: 0, maxWidth: 360 }}>
                {error instanceof ApiError && error.code === 'FORBIDDEN'
                  ? 'You don’t have access to this document’s contents.'
                  : 'Could not load this document’s preview.'}
              </p>
            </div>
          )}
          {!isLoading && data && (
            data.content.trim().length > 0 ? (
              <div style={{ fontSize: 14, color: '#0b1c30', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'inherit', wordBreak: 'break-word' }}>
                {data.content}
              </div>
            ) : (
              <p style={{ fontSize: 14, color: '#737686', margin: 0, textAlign: 'center', padding: '48px 0' }}>
                This document has no extractable text yet.
              </p>
            )
          )}
        </div>

        {/* Footer note when parts are hidden */}
        {data && data.accessibleChunks < data.totalChunks && (
          <div style={{ padding: '10px 24px', borderTop: '1px solid #c3c6d7', background: '#fffbeb', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <EyeOff size={14} color="#b45309" />
            <span style={{ fontSize: 12, color: '#92400e' }}>
              Some sections are hidden by access controls ({data.accessibleChunks} of {data.totalChunks} sections shown).
            </span>
          </div>
        )}
      </div>
      <style>{`@keyframes cb-skel { 0%,100%{opacity:.5}50%{opacity:1} }`}</style>
    </div>
  )
}
