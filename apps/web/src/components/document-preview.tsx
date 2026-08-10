'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, X, EyeOff, Download } from 'lucide-react'
import { getDocumentContent, documentFileUrl, unwrap, ApiError } from '@/lib/api'
import { INLINE_VIEWABLE_MIME_TYPES } from '@company-brain/shared'

function useDocumentContent(orgId: string, docId: string) {
  return useQuery({
    queryKey: ['document-content', orgId, docId],
    queryFn: async () => unwrap(await getDocumentContent(orgId, docId)),
    enabled: !!orgId && !!docId,
    retry: (failureCount, error) =>
      !(error instanceof ApiError && (error.code === 'FORBIDDEN' || error.code === 'NOT_FOUND')) && failureCount < 2,
  })
}

const tabButtonStyle = (active: boolean) => ({
  padding: '6px 14px',
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 8,
  border: '1px solid ' + (active ? '#004ac6' : '#c3c6d7'),
  background: active ? '#eff4ff' : 'transparent',
  color: active ? '#004ac6' : '#585f67',
  cursor: 'pointer',
})

export function DocumentPreview({ orgId, docId, onClose }: {
  orgId: string
  docId: string
  onClose: () => void
}) {
  const { data, isLoading, error } = useDocumentContent(orgId, docId)
  const [tab, setTab] = useState<'original' | 'text'>('original')

  // Embed exactly what the API is willing to serve inline — reading the same
  // constant it uses for Content-Disposition keeps the two decisions from
  // drifting apart. Documents uploaded before original-file storage existed
  // have no original at all, so they fall back to the text tab.
  const fileUrl = documentFileUrl(orgId, docId)
  const canEmbed = !!data?.hasOriginal && INLINE_VIEWABLE_MIME_TYPES.includes(data.mimeType ?? '')
  const activeTab = data?.hasOriginal ? tab : 'text'

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(11,28,48,0.3)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: 24 }}
    >
      <div style={{ background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 12, width: 'min(900px, 100%)', maxHeight: '85vh', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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

        {/* Tabs + download */}
        {data && (
          <div style={{ padding: '12px 24px', borderBottom: '1px solid #c3c6d7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {data.hasOriginal && (
                <button onClick={() => setTab('original')} style={tabButtonStyle(activeTab === 'original')}>
                  Original
                </button>
              )}
              <button onClick={() => setTab('text')} style={tabButtonStyle(activeTab === 'text')}>
                Extracted text
              </button>
            </div>
            {data.hasOriginal && (
              <a
                href={fileUrl}
                download={data.filename}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#004ac6', textDecoration: 'none' }}
              >
                <Download size={15} />
                Download
              </a>
            )}
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: activeTab === 'original' && canEmbed ? 0 : 24, minHeight: 320 }}>
          {isLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 24 }}>
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
          {!isLoading && data && activeTab === 'original' && (
            canEmbed ? (
              <iframe
                src={fileUrl}
                title={`${data.filename} (original)`}
                style={{ width: '100%', height: '60vh', border: 'none', display: 'block' }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 0', textAlign: 'center' }}>
                <FileText size={28} color="#737686" />
                <p style={{ fontSize: 14, color: '#585f67', margin: 0, maxWidth: 380 }}>
                  This format can’t be shown in the browser. Download the original to view it with its formatting, or switch to the extracted text.
                </p>
                <a
                  href={fileUrl}
                  download={data.filename}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#004ac6', color: '#ffffff', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
                >
                  <Download size={15} />
                  Download original
                </a>
              </div>
            )
          )}
          {!isLoading && data && activeTab === 'text' && (
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
        {data && activeTab === 'text' && data.accessibleChunks < data.totalChunks && (
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
