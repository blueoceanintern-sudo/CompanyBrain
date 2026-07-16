'use client'

import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Search, Upload, Paperclip, X, FileText, Table2, Link, File, FolderPlus, Trash2, Archive, ArchiveRestore, MoreHorizontal } from 'lucide-react'
import { useDocuments, useUploadDocument, useDeleteDocument, useArchiveDocument, useUnarchiveDocument } from '@/hooks/use-documents'
import { useRouter } from 'next/navigation'
import { useCompartments } from '@/hooks/use-compartments'
import { getAuthUser } from '@/lib/auth'
import { formatDate } from '@/lib/utils'
import type { CompartmentSummary } from '@company-brain/shared'

const SOURCE_TYPE_LABELS: Record<string, string> = {
  hr_policy: 'HR Policy', sop: 'SOP', faq: 'FAQ',
  case_note: 'Case Note', compliance: 'Compliance',
  product_doc: 'Product Doc', other: 'Other',
}

// ─── Header ───────────────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <header style={{ height: 64, borderBottom: '1px solid #c3c6d7', background: '#f8f9ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0, position: 'sticky', top: 0, zIndex: 40 }}>
      <span style={{ fontSize: 20, fontWeight: 700, color: '#004ac6' }}>Documents</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 14, color: '#585f67' }}>Status: <strong style={{ color: '#004ac6' }}>Internal</strong></span>
        <div style={{ width: 1, height: 24, background: '#c3c6d7' }} />
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

// ─── Access tier badge ────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    internal:     { bg: '#dbeafe', color: '#1e40af', label: 'Internal' },
    confidential: { bg: '#ffedd5', color: '#9a3412', label: 'Confidential' },
    public:       { bg: '#f1f5f9', color: '#475569', label: 'Public' },
    restricted:   { bg: '#fee2e2', color: '#991b1b', label: 'Restricted' },
    external:     { bg: '#dbeafe', color: '#1e40af', label: 'External' },
  }
  const s = styles[tier] ?? styles['internal']!
  return (
    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700, background: s.bg, color: s.color, display: 'inline-block' }}>{s.label}</span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; dot: string }> = {
    complete:   { bg: '#dcfce7', color: '#166534', dot: '#16a34a' },
    running:    { bg: '#dbeafe', color: '#1e40af', dot: '#2563eb' },
    queued:     { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' },
    failed:     { bg: '#fee2e2', color: '#991b1b', dot: '#dc2626' },
    archived:   { bg: '#f4f4f5', color: '#52525b', dot: '#a1a1aa' },
  }
  const s = styles[status] ?? styles['queued']!
  const label = status === 'complete' ? 'Ingested' : status === 'running' ? 'Processing' : status.charAt(0).toUpperCase() + status.slice(1)
  return (
    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700, background: s.bg, color: s.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
      {label}
    </span>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ doc, compartmentName, onClose, onDelete }: {
  doc: { id: string; filename: string; accessTier: string; status: string; sourceType: string; createdAt: string } | null
  compartmentName: string
  onClose: () => void
  onDelete: (id: string) => void
}) {
  return (
    <div style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: 420, background: '#ffffff', borderLeft: '1px solid #c3c6d7', boxShadow: '-10px 0 30px -5px rgba(0,0,0,0.05)', transform: doc ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s ease', display: 'flex', flexDirection: 'column', zIndex: 50 }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #c3c6d7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileText size={18} color="#004ac6" />
          <span style={{ fontSize: 18, fontWeight: 700, color: '#0b1c30' }}>Document Detail</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', borderRadius: '50%', padding: 6, display: 'flex', alignItems: 'center' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#eff4ff' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none' }}
        >
          <X size={18} />
        </button>
      </div>

      {doc && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* Preview */}
          <div style={{ aspectRatio: '4/3', width: '100%', background: '#eff4ff', borderRadius: 12, border: '1px solid #c3c6d7', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
            <FileText size={48} color="#c3c6d7" />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <button style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid #c3c6d7', borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 700, color: '#004ac6', cursor: 'pointer' }}>Full Preview</button>
            </div>
          </div>

          {/* Primary Info */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#585f67', marginBottom: 8 }}>Primary Info</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Filename', value: doc.filename },
                { label: 'Size', value: '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: '#e5eeff', padding: 12, borderRadius: 8, border: '1px solid #c3c6d7' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#585f67', margin: '0 0 4px' }}>{label}</p>
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#0b1c30', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Classification */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#585f67', marginBottom: 8 }}>Classification</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { label: 'Access Tier', value: <TierBadge tier={doc.accessTier} /> },
                { label: 'Compartment', value: compartmentName },
                { label: 'Encryption', value: 'AES-256' },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #c3c6d7' }}>
                  <span style={{ fontSize: 14, color: '#434655' }}>{label}</span>
                  {typeof value === 'string' ? <span style={{ fontSize: 14, fontWeight: 700, color: '#0b1c30' }}>{value}</span> : value}
                </div>
              ))}
            </div>
          </div>

          {/* Ingestion history */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#585f67', marginBottom: 12 }}>Ingestion History</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { dot: '#22c55e', label: 'Successfully Ingested', time: formatDate(doc.createdAt) + ' · 09:45 AM' },
                { dot: '#3b82f6', label: 'Vectorized & Indexed', time: formatDate(doc.createdAt) + ' · 09:46 AM' },
              ].map(({ dot, label, time }) => (
                <div key={label} style={{ display: 'flex', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: dot, marginTop: 4 }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#0b1c30', margin: '0 0 2px' }}>{label}</p>
                    <p style={{ fontSize: 12, color: '#585f67', margin: 0 }}>{time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      {doc && (
        <div style={{ padding: 24, borderTop: '1px solid #c3c6d7', display: 'flex', gap: 12 }}>
          <button style={{ flex: 1, padding: '10px 0', border: '1px solid #c3c6d7', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: 'transparent', color: '#0b1c30', fontFamily: 'inherit' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#eff4ff' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >Audit Trail</button>
          <button
            onClick={() => onDelete(doc.id)}
            style={{ flex: 1, padding: '10px 0', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: '#fef2f2', color: '#dc2626', border: 'none', fontFamily: 'inherit' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#fee2e2' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#fef2f2' }}
          >Delete</button>
        </div>
      )}
    </div>
  )
}

// ─── Delete confirmation dialog ───────────────────────────────────────────────

function DeleteDocumentDialog({ doc, isPending, onCancel, onConfirm }: {
  doc: { filename: string; status: string }
  isPending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const [confirmText, setConfirmText] = useState('')
  const canDelete = confirmText.trim() === 'Delete' && !isPending

  return (
    <div role="dialog" onClick={(e) => e.target === e.currentTarget && !isPending && onCancel()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 16, padding: 32, width: 'min(440px, 90vw)', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Trash2 size={18} color="#dc2626" />
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#0b1c30' }}>Delete document</h2>
        </div>
        <p style={{ fontSize: 14, color: '#434655', margin: '0 0 8px', lineHeight: 1.5 }}>
          You are about to permanently delete <strong style={{ color: '#0b1c30', wordBreak: 'break-all' }}>{doc.filename}</strong>.
        </p>
        <p style={{ fontSize: 13, color: '#585f67', margin: '0 0 20px', lineHeight: 1.5 }}>
          {doc.status === 'failed'
            ? 'This ingestion failed, so no content is searchable. Deleting removes it permanently; you can re-upload the file afterwards.'
            : 'The document and all its content will be permanently removed from the knowledge base. This cannot be undone — use Archive instead if you may need it back.'}
        </p>
        <form onSubmit={(e) => { e.preventDefault(); if (canDelete) onConfirm() }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#434655', marginBottom: 8 }}>
            Type <strong style={{ color: '#dc2626' }}>Delete</strong> to confirm (case-sensitive)
          </label>
          <input
            autoFocus
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Delete"
            disabled={isPending}
            style={{ width: '100%', height: 44, padding: '0 12px', border: '1px solid #c3c6d7', borderRadius: 8, background: '#ffffff', color: '#0b1c30', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
            <button type="button" onClick={onCancel} disabled={isPending}
              style={{ height: 44, padding: '0 20px', border: '1px solid #c3c6d7', borderRadius: 8, background: 'transparent', fontSize: 14, cursor: 'pointer', color: '#0b1c30', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button type="submit" disabled={!canDelete}
              style={{ height: 44, padding: '0 20px', border: 'none', borderRadius: 8, background: '#dc2626', color: '#ffffff', fontSize: 14, fontWeight: 500, cursor: canDelete ? 'pointer' : 'not-allowed', opacity: canDelete ? 1 : 0.5, fontFamily: 'inherit' }}>
              {isPending ? 'Deleting…' : 'Delete document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Archive confirmation dialog ──────────────────────────────────────────────

function ArchiveDocumentDialog({ doc, isPending, onCancel, onConfirm }: {
  doc: { filename: string }
  isPending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div role="dialog" onClick={(e) => e.target === e.currentTarget && !isPending && onCancel()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 16, padding: 32, width: 'min(440px, 90vw)', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Archive size={18} color="#004ac6" />
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#0b1c30' }}>Archive document</h2>
        </div>
        <p style={{ fontSize: 14, color: '#434655', margin: '0 0 20px', lineHeight: 1.5 }}>
          <strong style={{ color: '#0b1c30', wordBreak: 'break-all' }}>{doc.filename}</strong> will be removed
          from search and chat answers. You can unarchive it at any time to restore it.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button type="button" onClick={onCancel} disabled={isPending}
            style={{ height: 44, padding: '0 20px', border: '1px solid #c3c6d7', borderRadius: 8, background: 'transparent', fontSize: 14, cursor: 'pointer', color: '#0b1c30', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={isPending}
            style={{ height: 44, padding: '0 20px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#ffffff', fontSize: 14, fontWeight: 500, cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.5 : 1, fontFamily: 'inherit' }}>
            {isPending ? 'Archiving…' : 'Archive document'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Row actions menu (…) ─────────────────────────────────────────────────────

function RowActionsMenu({ isArchived, onArchive, onUnarchive, onDelete, onClose }: {
  isArchived: boolean
  onArchive: () => void
  onUnarchive: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '10px 14px', border: 'none', background: 'none',
    fontSize: 14, color: '#0b1c30', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
  }
  return (
    <>
      {/* Transparent overlay: clicking anywhere else closes the menu */}
      <div onClick={(e) => { e.stopPropagation(); onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 55 }} />
      <div style={{ position: 'absolute', right: 16, top: '70%', zIndex: 56, background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.12)', minWidth: 170, overflow: 'hidden', padding: '4px 0' }}>
        {isArchived ? (
          <button style={itemStyle} onClick={(e) => { e.stopPropagation(); onUnarchive() }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#eff4ff' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none' }}>
            <ArchiveRestore size={15} color="#004ac6" /> Unarchive
          </button>
        ) : (
          <button style={itemStyle} onClick={(e) => { e.stopPropagation(); onArchive() }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#eff4ff' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none' }}>
            <Archive size={15} color="#585f67" /> Archive
          </button>
        )}
        <button style={{ ...itemStyle, color: '#dc2626' }} onClick={(e) => { e.stopPropagation(); onDelete() }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#fef2f2' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none' }}>
          <Trash2 size={15} /> Delete
        </button>
      </div>
    </>
  )
}

// ─── Upload dialog ────────────────────────────────────────────────────────────

const uploadSchema = z.object({
  compartmentId: z.string().min(1, 'Select a compartment'),
  accessTier: z.enum(['internal', 'external']),
  sourceType: z.enum(['hr_policy', 'sop', 'faq', 'case_note', 'compliance', 'product_doc', 'other']),
})
type UploadFormValues = z.infer<typeof uploadSchema>

function UploadDialog({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const { data: compartments = [], isLoading: compartmentsLoading } = useCompartments(orgId)

  return (
    <div role="dialog" onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 16, padding: 32, width: 'min(480px, 90vw)', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 24px', color: '#0b1c30' }}>Upload Document</h2>
        {compartmentsLoading
          ? <p style={{ fontSize: 14, color: '#585f67', margin: 0 }}>Loading compartments…</p>
          : <UploadForm orgId={orgId} compartments={compartments} onClose={onClose} />}
      </div>
    </div>
  )
}

function UploadForm({ orgId, compartments, onClose }: { orgId: string; compartments: CompartmentSummary[]; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const upload = useUploadDocument(orgId)
  const noCompartments = compartments.length === 0

  // Compartments are loaded by the time this form mounts, so defaults can read them directly.
  const { register, handleSubmit } = useForm<UploadFormValues>({
   resolver: zodResolver(uploadSchema),
   defaultValues: { accessTier: 'internal', sourceType: 'other', compartmentId: compartments[0]?.id ?? '' },
  })

  const onSubmit = async (values: UploadFormValues) => {
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('compartmentId', values.compartmentId)
    fd.append('accessTier', values.accessTier)
    fd.append('sourceType', values.sourceType)
    upload.mutate(fd as unknown as FormData, { onSuccess: onClose })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 44, padding: '0 12px',
    border: '1px solid #c3c6d7', borderRadius: 8,
    background: '#ffffff', color: '#0b1c30', fontSize: 14, fontFamily: 'inherit',
  }

  return (
    <>
      {noCompartments && (
        <div style={{ padding: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: '#92400e', margin: 0 }}>No compartments yet — use the &ldquo;New Compartment&rdquo; button to create one first.</p>
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#434655', marginBottom: 8 }}>File (PDF, Word, or plain text)</label>
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
            <button type="button" onClick={() => fileInputRef.current?.click()}
              style={{ ...inputStyle, border: '1px dashed #c3c6d7', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: file ? '#0b1c30' : '#737686' }}>
              <Paperclip size={14} />{file ? file.name : 'Choose file…'}
            </button>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#434655', marginBottom: 8 }}>Compartment</label>
            <select {...register('compartmentId')} disabled={noCompartments} style={{ ...inputStyle, opacity: noCompartments ? 0.5 : 1 }}>
              {compartments
                .filter((c) => !c.parentCompartmentId)
                .flatMap((c) => [c, ...compartments.filter((s) => s.parentCompartmentId === c.id)])
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.parentCompartmentId ? `— ${c.name}` : c.name}</option>
                ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#434655', marginBottom: 8 }}>Access tier</label>
              <select {...register('accessTier')} style={inputStyle}><option value="internal">Internal</option><option value="external">External</option></select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#434655', marginBottom: 8 }}>Source type</label>
              <select {...register('sourceType')} style={inputStyle}>
                {Object.entries(SOURCE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{ height: 44, padding: '0 20px', border: '1px solid #c3c6d7', borderRadius: 8, background: 'transparent', fontSize: 14, cursor: 'pointer', color: '#0b1c30', fontFamily: 'inherit' }}>Cancel</button>
            <button type="submit" disabled={!file || upload.isPending || noCompartments}
              style={{ height: 44, padding: '0 20px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#ffffff', fontSize: 14, fontWeight: 500, cursor: (!file || noCompartments) ? 'not-allowed' : 'pointer', opacity: (!file || noCompartments) ? 0.5 : 1, fontFamily: 'inherit' }}>
              {upload.isPending ? 'Uploading…' : 'Upload'}
            </button>
          </div>
      </form>
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type DocItem = Awaited<ReturnType<typeof useDocuments>>['data'] extends Array<infer T> | undefined ? T : never

export default function DocumentsPage() {
  const user = getAuthUser()
  const orgId = user?.orgId ?? ''
  const router = useRouter()
  const [showUpload, setShowUpload] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<DocItem | null>(null)
  const [docToDelete, setDocToDelete] = useState<DocItem | null>(null)
  const [docToArchive, setDocToArchive] = useState<DocItem | null>(null)
  const [menuDocId, setMenuDocId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sourceTypeFilter, setSourceTypeFilter] = useState('')
  const [accessTierFilter, setAccessTierFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data: docs = [], isLoading } = useDocuments(orgId)
  const { data: compartments = [] } = useCompartments(orgId)
  const deleteDoc = useDeleteDocument(orgId)
  const archiveDoc = useArchiveDocument(orgId)
  const unarchiveDoc = useUnarchiveDocument(orgId)

  // Sub-compartments show their full path, e.g. "HR / Payroll"
  const getCompartmentName = (compartmentId: string) => {
    const comp = compartments.find((c) => c.id === compartmentId)
    if (!comp) return '—'
    const parent = compartments.find((c) => c.id === comp.parentCompartmentId)
    return parent ? `${parent.name} / ${comp.name}` : comp.name
  }

  const filtered = docs.filter((d) => {
    if (search && !d.filename.toLowerCase().includes(search.toLowerCase())) return false
    if (sourceTypeFilter && d.sourceType !== sourceTypeFilter) return false
    if (accessTierFilter && d.accessTier !== accessTierFilter) return false
    if (statusFilter && d.status !== statusFilter) return false
    return true
  })

  const docIcon = (sourceType: string) => {
    if (sourceType === 'hr_policy' || sourceType === 'compliance') return <FileText size={18} color="#585f67" />
    if (sourceType === 'sop' || sourceType === 'product_doc') return <Table2 size={18} color="#585f67" />
    if (sourceType === 'faq') return <Link size={18} color="#585f67" />
    return <File size={18} color="#585f67" />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader />

      <div style={{ flex: 1, overflow: 'auto', padding: 32, display: 'flex', flexDirection: 'column', gap: 24, position: 'relative' }}>
        {/* Page heading */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0b1c30', margin: '0 0 4px' }}>Knowledge Base</h1>
            <p style={{ fontSize: 14, color: '#585f67', margin: 0 }}>Manage and audit your organization&apos;s ingested documents.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <button
              onClick={() => router.push('/settings?tab=compartments&create=1')}
              title="Opens compartment creation in Settings"
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', color: '#004ac6', border: '1px solid #004ac6', borderRadius: 12, padding: '10px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <FolderPlus size={16} /> New Compartment
            </button>
            <button
              onClick={() => setShowUpload(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 12, padding: '10px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <Upload size={16} /> Upload Document
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#ffffff' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#737686' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by filename or content..."
              style={{ width: '100%', height: 40, paddingLeft: 36, paddingRight: 12, border: '1px solid #c3c6d7', borderRadius: 8, fontSize: 14, background: '#f8f9ff', outline: 'none', color: '#0b1c30', fontFamily: 'inherit' }}
            />
          </div>
          <select value={sourceTypeFilter} onChange={(e) => setSourceTypeFilter(e.target.value)} style={{ height: 40, padding: '0 12px', border: '1px solid #c3c6d7', borderRadius: 8, fontSize: 14, color: '#434655', background: '#f8f9ff', cursor: 'pointer', fontFamily: 'inherit' }}>
            <option value="">Source Type</option>
            {Object.entries(SOURCE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={accessTierFilter} onChange={(e) => setAccessTierFilter(e.target.value)} style={{ height: 40, padding: '0 12px', border: '1px solid #c3c6d7', borderRadius: 8, fontSize: 14, color: '#434655', background: '#f8f9ff', cursor: 'pointer', fontFamily: 'inherit' }}>
            <option value="">Access Tier</option>
            <option value="internal">Internal</option>
            <option value="external">External</option>
            <option value="confidential">Confidential</option>
            <option value="public">Public</option>
            <option value="restricted">Restricted</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ height: 40, padding: '0 12px', border: '1px solid #c3c6d7', borderRadius: 8, fontSize: 14, color: '#434655', background: '#f8f9ff', cursor: 'pointer', fontFamily: 'inherit' }}>
            <option value="">Status</option>
            <option value="complete">Ingested</option>
            <option value="running">Processing</option>
            <option value="queued">Queued</option>
            <option value="failed">Failed</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Table */}
        <div style={{ background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ overflow: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f8f9ff', borderBottom: '1px solid #c3c6d7' }}>
                  {['FILENAME', 'COMPARTMENT', 'SOURCE TYPE', 'ACCESS TIER', 'STATUS', 'UPLOADED DATE', 'ACTIONS'].map((h) => (
                    <th key={h} style={{ padding: '14px 24px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: '#585f67', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #c3c6d7' }}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} style={{ padding: '16px 24px' }}>
                        <div style={{ height: 14, background: '#eff4ff', borderRadius: 4, width: j === 0 ? 200 : 80, animation: 'cb-skel 1.5s ease-in-out infinite' }} />
                      </td>
                    ))}
                  </tr>
                ))}
                {!isLoading && filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center', color: '#737686' }}>No documents found.</td></tr>
                )}
                {filtered.map((doc) => (
                  <tr
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc === selectedDoc ? null : doc)}
                    style={{ borderBottom: '1px solid #c3c6d7', cursor: 'pointer', background: selectedDoc?.id === doc.id ? '#eff6ff' : 'transparent', transition: 'background 0.15s' }}
                    onMouseEnter={(e) => { if (selectedDoc?.id !== doc.id) (e.currentTarget as HTMLElement).style.background = '#f8faff' }}
                    onMouseLeave={(e) => { if (selectedDoc?.id !== doc.id) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {docIcon(doc.sourceType)}
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 500, color: '#0b1c30', margin: 0 }}>{doc.filename}</p>
                          <p style={{ fontSize: 12, color: '#585f67', margin: 0 }}>PDF Document</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{ display: 'inline-block', padding: '2px 10px', background: '#e5eeff', color: '#004ac6', borderRadius: 9999, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {getCompartmentName(doc.compartmentId)}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', color: '#585f67' }}>{SOURCE_TYPE_LABELS[doc.sourceType] ?? doc.sourceType}</td>
                    <td style={{ padding: '16px 24px' }}><TierBadge tier={doc.accessTier} /></td>
                    <td style={{ padding: '16px 24px' }}><StatusBadge status={doc.status} /></td>
                    <td style={{ padding: '16px 24px', color: '#585f67' }}>{formatDate(doc.createdAt)}</td>
                    <td style={{ padding: '16px 24px', textAlign: 'right', position: 'relative' }}>
                      <button
                        title="Document actions"
                        onClick={(e) => { e.stopPropagation(); setMenuDocId(menuDocId === doc.id ? null : doc.id) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', padding: 4, display: 'flex', alignItems: 'center' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#0b1c30' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#585f67' }}
                      >
                        <MoreHorizontal size={18} />
                      </button>
                      {menuDocId === doc.id && (
                        <RowActionsMenu
                          isArchived={doc.status === 'archived'}
                          onArchive={() => { setMenuDocId(null); setDocToArchive(doc) }}
                          onUnarchive={() => { setMenuDocId(null); unarchiveDoc.mutate(doc.id) }}
                          onDelete={() => { setMenuDocId(null); setDocToDelete(doc) }}
                          onClose={() => setMenuDocId(null)}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div style={{ padding: '14px 24px', background: '#f8f9ff', borderTop: '1px solid #c3c6d7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 12, color: '#585f67', margin: 0 }}>Showing <strong style={{ color: '#0b1c30' }}>1–{filtered.length}</strong> of <strong style={{ color: '#0b1c30' }}>{filtered.length}</strong> documents</p>
            <div style={{ display: 'flex', gap: 4 }}>
              {['‹', '1', '2', '3', '›'].map((p, i) => (
                <button key={i} style={{ width: 32, height: 32, borderRadius: 4, border: '1px solid #c3c6d7', background: p === '1' ? '#2563eb' : 'transparent', color: p === '1' ? '#ffffff' : '#434655', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{p}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Detail panel */}
        <DetailPanel
          doc={selectedDoc}
          compartmentName={selectedDoc ? getCompartmentName((selectedDoc as { compartmentId?: string }).compartmentId ?? '') : '—'}
          onClose={() => setSelectedDoc(null)}
          onDelete={() => { if (selectedDoc) setDocToDelete(selectedDoc) }}
        />
      </div>

      <style>{`@keyframes cb-skel { 0%,100%{opacity:.5}50%{opacity:1} }`}</style>
      {showUpload && <UploadDialog orgId={orgId} onClose={() => setShowUpload(false)} />}
      {docToDelete && (
        <DeleteDocumentDialog
          doc={docToDelete}
          isPending={deleteDoc.isPending}
          onCancel={() => setDocToDelete(null)}
          onConfirm={() =>
            deleteDoc.mutate(docToDelete.id, {
              onSuccess: () => {
                setDocToDelete(null)
                if (selectedDoc?.id === docToDelete.id) setSelectedDoc(null)
              },
            })
          }
        />
      )}
      {docToArchive && (
        <ArchiveDocumentDialog
          doc={docToArchive}
          isPending={archiveDoc.isPending}
          onCancel={() => setDocToArchive(null)}
          onConfirm={() =>
            archiveDoc.mutate(docToArchive.id, {
              onSuccess: () => {
                setDocToArchive(null)
                if (selectedDoc?.id === docToArchive.id) setSelectedDoc(null)
              },
            })
          }
        />
      )}
    </div>
  )
}
