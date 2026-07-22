'use client'

import { useState, useRef, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Search, Plus, Paperclip, X, FileText, Table2, Link, File, FolderPlus, Trash2,
  Archive, ArchiveRestore, MoreHorizontal, Folder, Lock, AlertTriangle, ChevronRight,
  ChevronDown, Move, Shield, LayoutGrid, List as ListIcon,
} from 'lucide-react'
import {
  useDocuments, useUploadDocument, useDeleteDocument, useArchiveDocument,
  useUnarchiveDocument, useMoveDocument,
} from '@/hooks/use-documents'
import { useCompartments, useCreateCompartment, useDeleteCompartment } from '@/hooks/use-compartments'
import { useSubscription } from '@/hooks/use-payments'
import { useGroups, useCompartmentGrants } from '@/hooks/use-groups'
import { useUsers } from '@/hooks/use-users'
import { getAuthUser } from '@/lib/auth'
import { hasPermission } from '@company-brain/shared'
import { formatDate } from '@/lib/utils'
import { DocumentPreview } from '@/components/document-preview'
import { FolderAccessPanel } from '@/components/documents/folder-access'
import type { CompartmentSummary } from '@company-brain/shared'

const SOURCE_TYPE_LABELS: Record<string, string> = {
  hr_policy: 'HR Policy', sop: 'SOP', faq: 'FAQ',
  case_note: 'Case Note', compliance: 'Compliance',
  product_doc: 'Product Doc', other: 'Other',
}

const TIER_LABELS: Record<'internal' | 'external', string> = { internal: 'Internal Knowledge', external: 'External Knowledge' }

// ─── Header ───────────────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <header style={{ height: 64, borderBottom: '1px solid #c3c6d7', background: '#f8f9ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0, position: 'sticky', top: 0, zIndex: 40 }}>
      <span style={{ fontSize: 20, fontWeight: 700, color: '#004ac6' }}>Documents</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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

// ─── Badges ───────────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    internal: { bg: '#dbeafe', color: '#1e40af', label: 'Internal' },
    external: { bg: '#dcfce7', color: '#166534', label: 'External' },
  }
  const s = styles[tier] ?? styles['internal']!
  return (
    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700, background: s.bg, color: s.color, display: 'inline-block' }}>{s.label}</span>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ doc, compartmentName, canMove, onClose, onDelete, onArchive, onUnarchive, onMove, onPreview }: {
  doc: { id: string; filename: string; accessTier: string; status: string; sourceType: string; createdAt: string } | null
  compartmentName: string
  canMove: boolean
  onClose: () => void
  onDelete: (id: string) => void
  onArchive: (id: string) => void
  onUnarchive: (id: string) => void
  onMove: (id: string) => void
  onPreview: (id: string) => void
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
              <button onClick={() => onPreview(doc!.id)} style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid #c3c6d7', borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 700, color: '#004ac6', cursor: 'pointer', fontFamily: 'inherit' }}>Full Preview</button>
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
                { label: 'Folder', value: compartmentName },
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
        <div style={{ padding: 24, borderTop: '1px solid #c3c6d7', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            {doc.status === 'archived' ? (
              <button onClick={() => onUnarchive(doc.id)} style={{ flex: 1, padding: '10px 0', border: '1px solid #c3c6d7', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: 'transparent', color: '#0b1c30', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#eff4ff' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              ><ArchiveRestore size={14} /> Unarchive</button>
            ) : (
              <button onClick={() => onArchive(doc.id)} style={{ flex: 1, padding: '10px 0', border: '1px solid #c3c6d7', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: 'transparent', color: '#0b1c30', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#eff4ff' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              ><Archive size={14} /> Archive</button>
            )}
            {canMove && doc.status !== 'archived' && (
              <button onClick={() => onMove(doc.id)} style={{ flex: 1, padding: '10px 0', border: '1px solid #c3c6d7', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: 'transparent', color: '#0b1c30', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#eff4ff' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              ><Move size={14} /> Move</button>
            )}
          </div>
          <button
            onClick={() => onDelete(doc.id)}
            style={{ padding: '10px 0', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: '#fef2f2', color: '#dc2626', border: 'none', fontFamily: 'inherit' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#fee2e2' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#fef2f2' }}
          >Delete</button>
        </div>
      )}
    </div>
  )
}

// ─── Delete document dialog ───────────────────────────────────────────────────

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
        <p style={{ fontSize: 14, color: '#434655', margin: '0 0 12px', lineHeight: 1.5 }}>
          You are about to permanently delete <br/> <strong style={{ color: '#0b1c30', wordBreak: 'break-all' }}>{doc.filename}</strong>.
        </p>
        <p style={{ fontSize: 13, color: '#585f67', margin: '0 0 20px', lineHeight: 1.5 }}>
          {doc.status === 'failed'
            ? 'This ingestion failed, so no content is searchable. Deleting removes it permanently; you can re-upload the file afterwards.'
            : 'Archive instead to prevent it from being queried.'}
        </p>
        <form onSubmit={(e) => { e.preventDefault(); if (canDelete) onConfirm() }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#434655', marginBottom: 8 }}>
            Type <strong style={{ color: '#dc2626' }}>Delete</strong> to confirm 
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

// ─── Archive document dialog ──────────────────────────────────────────────────

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

// ─── Move document dialog ──────────────────────────────────────────────────────

function compartmentLabel(c: CompartmentSummary, all: CompartmentSummary[]) {
  const parent = all.find((p) => p.id === c.parentCompartmentId)
  return parent ? `${parent.name} / ${c.name}` : c.name
}

function MoveDocumentDialog({ doc, compartments, isPending, onCancel, onConfirm }: {
  doc: { id: string; filename: string; compartmentId: string; accessTier: string }
  compartments: CompartmentSummary[]
  isPending: boolean
  onCancel: () => void
  onConfirm: (targetCompartmentId: string) => void
}) {
  const candidates = compartments.filter((c) => c.accessTier === doc.accessTier && c.id !== doc.compartmentId)
  const [target, setTarget] = useState(candidates[0]?.id ?? '')

  return (
    <div role="dialog" onClick={(e) => e.target === e.currentTarget && !isPending && onCancel()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 16, padding: 32, width: 'min(440px, 90vw)', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Move size={18} color="#004ac6" />
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#0b1c30' }}>Move document</h2>
        </div>
        <p style={{ fontSize: 14, color: '#434655', margin: '0 0 20px', lineHeight: 1.5 }}>
          Move <strong style={{ color: '#0b1c30', wordBreak: 'break-all' }}>{doc.filename}</strong> to another {TIER_LABELS[doc.accessTier as 'internal' | 'external']} folder.
        </p>
        {candidates.length === 0 ? (
          <p style={{ fontSize: 13, color: '#585f67', margin: '0 0 20px', padding: '10px 12px', background: '#f8f9ff', borderRadius: 8 }}>
            No other {doc.accessTier} folders exist yet.
          </p>
        ) : (
          <select value={target} onChange={(e) => setTarget(e.target.value)}
            style={{ width: '100%', height: 44, padding: '0 12px', border: '1px solid #c3c6d7', borderRadius: 8, background: '#ffffff', color: '#0b1c30', fontSize: 14, fontFamily: 'inherit', marginBottom: 20 }}>
            {candidates.map((c) => <option key={c.id} value={c.id}>{compartmentLabel(c, compartments)}</option>)}
          </select>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button type="button" onClick={onCancel} disabled={isPending}
            style={{ height: 44, padding: '0 20px', border: '1px solid #c3c6d7', borderRadius: 8, background: 'transparent', fontSize: 14, cursor: 'pointer', color: '#0b1c30', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button type="button" disabled={isPending || !target} onClick={() => onConfirm(target)}
            style={{ height: 44, padding: '0 20px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#ffffff', fontSize: 14, fontWeight: 500, cursor: (isPending || !target) ? 'not-allowed' : 'pointer', opacity: (isPending || !target) ? 0.5 : 1, fontFamily: 'inherit' }}>
            {isPending ? 'Moving…' : 'Move document'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Folder actions menu (toolbar, for the currently open folder) ─────────────
// Consolidates New Subfolder / Manage / Delete behind one button instead of
// three, mirroring the same "⋯ More actions" pattern already used on folder
// cards elsewhere on this page.

function FolderActionsMenu({ isTopLevel, onNewSubfolder, onManage, onDelete }: {
  isTopLevel: boolean
  onNewSubfolder: () => void
  onManage: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '10px 14px', border: 'none', background: 'none',
    fontSize: 14, color: '#0b1c30', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
  }
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(true)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Folder actions"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: '#585f67', border: '1px solid #c3c6d7', borderRadius: 12, padding: '0 14px', height: 40, cursor: 'pointer', fontFamily: 'inherit' }}
      ><MoreHorizontal size={16} /></button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 55 }} />
          <div role="menu" style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 56, background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.12)', minWidth: 190, overflow: 'hidden', padding: '4px 0' }}>
            {isTopLevel && (
              <button style={itemStyle} onClick={() => { setOpen(false); onNewSubfolder() }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#eff4ff' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none' }}>
                <FolderPlus size={15} color="#585f67" /> New Subfolder
              </button>
            )}
            <button style={itemStyle} onClick={() => { setOpen(false); onManage() }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#eff4ff' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none' }}>
              <Shield size={15} color="#585f67" /> Manage
            </button>
            <button style={{ ...itemStyle, color: '#dc2626' }} onClick={() => { setOpen(false); onDelete() }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#fef2f2' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none' }}>
              <Trash2 size={15} /> Delete folder
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Upload dialog ────────────────────────────────────────────────────────────

const uploadSchema = z.object({
  sourceType: z.enum(['hr_policy', 'sop', 'faq', 'case_note', 'compliance', 'product_doc', 'other']),
})
type UploadFormValues = z.infer<typeof uploadSchema>

function UploadDialog({ orgId, folder, onClose }: { orgId: string; folder: CompartmentSummary; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const upload = useUploadDocument(orgId)
  const { register, handleSubmit } = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: { sourceType: 'other' },
  })

  const onSubmit = async (values: UploadFormValues) => {
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('compartmentId', folder.id)
    fd.append('sourceType', values.sourceType)
    upload.mutate(fd as unknown as FormData, { onSuccess: onClose })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 44, padding: '0 12px',
    border: '1px solid #c3c6d7', borderRadius: 8,
    background: '#ffffff', color: '#0b1c30', fontSize: 14, fontFamily: 'inherit',
  }

  return (
    <div role="dialog" onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 16, padding: 32, width: 'min(480px, 90vw)', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: '#0b1c30' }}>Upload Document</h2>
        <p style={{ fontSize: 13, color: '#585f67', margin: '0 0 24px' }}>Uploading into <strong style={{ color: '#0b1c30' }}>{folder.name}</strong> ({TIER_LABELS[folder.accessTier as 'internal' | 'external']})</p>
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
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#434655', marginBottom: 8 }}>Source type</label>
            <select {...register('sourceType')} style={inputStyle}>
              {Object.entries(SOURCE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{ height: 44, padding: '0 20px', border: '1px solid #c3c6d7', borderRadius: 8, background: 'transparent', fontSize: 14, cursor: 'pointer', color: '#0b1c30', fontFamily: 'inherit' }}>Cancel</button>
            <button type="submit" disabled={!file || upload.isPending}
              style={{ height: 44, padding: '0 20px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#ffffff', fontSize: 14, fontWeight: 500, cursor: !file ? 'not-allowed' : 'pointer', opacity: !file ? 0.5 : 1, fontFamily: 'inherit' }}>
              {upload.isPending ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Create folder dialog ──────────────────────────────────────────────────────

function CreateFolderDialog({ orgId, parent, tier, onClose }: {
  orgId: string
  parent: CompartmentSummary | null
  tier: 'internal' | 'external'
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [restricted, setRestricted] = useState(false)
  const createComp = useCreateCompartment(orgId)

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    createComp.mutate(
      { name: trimmed, restricted, ...(parent ? { parentId: parent.id } : { accessTier: tier }) },
      { onSuccess: onClose }
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 44, padding: '0 12px', border: '1px solid #c3c6d7', borderRadius: 8,
    background: '#ffffff', color: '#0b1c30', fontSize: 14, fontFamily: 'inherit',
  }

  return (
    <div role="dialog" onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 16, padding: 32, width: 'min(440px, 90vw)', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: '#0b1c30' }}>{parent ? 'New Subfolder' : 'New Folder'}</h2>
        <p style={{ fontSize: 13, color: '#585f67', margin: '0 0 20px' }}>
          {parent ? <>Only people with access to <strong style={{ color: '#0b1c30' }}>{parent.name}</strong> can view this subfolder.</> : TIER_LABELS[tier]}
        </p>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose() }}
          placeholder={parent ? 'e.g. Payroll' : 'e.g. HR Department'} style={{ ...inputStyle, marginBottom: 16 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 24 }}>
          <input type="checkbox" checked={restricted} onChange={(e) => setRestricted(e.target.checked)} style={{ accentColor: '#2563eb' }} />
          <Lock size={14} color={restricted ? '#9a3412' : '#585f67'} />
          <span style={{ fontSize: 13, color: '#0b1c30' }}>Restricted</span>
          <span style={{ fontSize: 12, color: '#585f67' }}>— limit view and query access.</span>
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button type="button" onClick={onClose} style={{ height: 44, padding: '0 20px', border: '1px solid #c3c6d7', borderRadius: 8, background: 'transparent', fontSize: 14, cursor: 'pointer', color: '#0b1c30', fontFamily: 'inherit' }}>Cancel</button>
          <button type="button" disabled={!name.trim() || createComp.isPending} onClick={submit}
            style={{ height: 44, padding: '0 20px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#ffffff', fontSize: 14, fontWeight: 500, cursor: (!name.trim() || createComp.isPending) ? 'not-allowed' : 'pointer', opacity: (!name.trim() || createComp.isPending) ? 0.5 : 1, fontFamily: 'inherit' }}>
            {createComp.isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete folder dialog ──────────────────────────────────────────────────────

function DeleteFolderDialog({ orgId, folder, compartments, onCancel, onDeleted }: {
  orgId: string
  folder: CompartmentSummary
  compartments: CompartmentSummary[]
  onCancel: () => void
  onDeleted: () => void
}) {
  const deleteComp = useDeleteCompartment(orgId)
  const [confirmText, setConfirmText] = useState('')
  const [reassignTarget, setReassignTarget] = useState('')

  const sameTierTargets = compartments.filter((c) => c.id !== folder.id && c.accessTier === folder.accessTier)
  const confirmed = confirmText.trim() === 'Delete'
  const inputStyle: React.CSSProperties = {
    width: '100%', height: 44, padding: '0 12px', border: '1px solid #c3c6d7', borderRadius: 8,
    background: '#ffffff', color: '#0b1c30', fontSize: 14, fontFamily: 'inherit',
  }

  return (
    <div role="dialog" onClick={(e) => e.target === e.currentTarget && !deleteComp.isPending && onCancel()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div style={{ background: '#ffffff', border: '1px solid #ffdad6', borderRadius: 12, padding: 32, width: 'min(440px, 100%)', boxShadow: '0 10px 30px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#ba1a1a', margin: '0 0 8px' }}>Delete &ldquo;{folder.name}&rdquo;?</h2>
          <p style={{ fontSize: 14, color: '#585f67', margin: 0, lineHeight: 1.6 }}>Choose what happens to the documents in this folder. This cannot be undone.</p>
        </div>
        <select value={reassignTarget} onChange={(e) => setReassignTarget(e.target.value)} style={inputStyle}>
          <option value="">Delete all documents in this folder</option>
          {sameTierTargets.map((c) => (
            <option key={c.id} value={c.id}>Move documents to &ldquo;{compartmentLabel(c, compartments)}&rdquo;</option>
          ))}
        </select>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#434655', marginBottom: 6 }}>
            Type <strong style={{ color: '#ba1a1a' }}>Delete</strong> to confirm 
          </label>
          <input autoFocus type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Delete" style={inputStyle} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button onClick={onCancel} style={{ height: 40, padding: '0 20px', border: '1px solid #c3c6d7', borderRadius: 8, background: 'transparent', fontSize: 14, cursor: 'pointer', color: '#0b1c30', fontFamily: 'inherit' }}>Cancel</button>
          <button
            disabled={!confirmed || deleteComp.isPending}
            onClick={() => {
              const vars = reassignTarget ? { cId: folder.id, targetCompartmentId: reassignTarget } : { cId: folder.id }
              deleteComp.mutate(vars, { onSuccess: onDeleted })
            }}
            style={{ height: 40, padding: '0 20px', border: 'none', borderRadius: 8, background: '#ba1a1a', color: '#ffffff', fontSize: 14, fontWeight: 500, cursor: (!confirmed || deleteComp.isPending) ? 'not-allowed' : 'pointer', opacity: (!confirmed || deleteComp.isPending) ? 0.5 : 1, fontFamily: 'inherit' }}
          >{deleteComp.isPending ? 'Deleting…' : 'Delete Folder'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Manage access dialog ──────────────────────────────────────────────────────

function FolderAccessDialog({ orgId, folder, parent, initialEdit, onClose, onRequestDelete }: {
  orgId: string
  folder: CompartmentSummary
  parent: CompartmentSummary | null
  initialEdit: boolean
  onClose: () => void
  onRequestDelete: () => void
}) {
  return (
    <div role="dialog" onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div style={{ background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 16, width: 'min(560px, 100%)', maxHeight: '85vh', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #c3c6d7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={18} color="#004ac6" />
            <span style={{ fontSize: 16, fontWeight: 700, color: '#0b1c30' }}>Manage — {folder.name}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', display: 'flex' }}><X size={18} /></button>
        </div>
        <div style={{ padding: 24, overflowY: 'auto' }}>
          <FolderAccessPanel orgId={orgId} compartment={folder} parent={parent} initialEdit={initialEdit} onRequestDelete={() => { onClose(); onRequestDelete() }} />
        </div>
      </div>
    </div>
  )
}

// ─── Folder card ────────────────────────────────────────────────────────────────

function FolderCard({ folder, docCount, canManage, parentRestricted = false, onOpen, onManageAccess, onDelete }: {
  folder: CompartmentSummary
  docCount: number
  canManage: boolean
  parentRestricted?: boolean
  onOpen: () => void
  onManageAccess: (initialEdit: boolean) => void
  onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const showLock = folder.restricted || parentRestricted
  const iconBtn: React.CSSProperties = { padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', borderRadius: 6, display: 'flex', flexShrink: 0 }

  return (
    <div style={{ border: '1px solid #c3c6d7', borderRadius: 12, background: '#ffffff', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          role="button"
          tabIndex={0}
          onClick={onOpen}
          onDoubleClick={onOpen}
          onKeyDown={(e) => { if (e.key === 'Enter') onOpen() }}
          title="Double-click to open"
          style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1, cursor: 'pointer' }}
        >
          <div style={{ width: 40, height: 40, borderRadius: 8, background: '#e5eeff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Folder size={18} color="#004ac6" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#0b1c30', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
              {showLock && (
                <button
                  onClick={(e) => { e.stopPropagation(); onManageAccess(false) }}
                  onDoubleClick={(e) => e.stopPropagation()}
                  title="View who has access"
                  aria-label="Restricted — view who has access"
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', flexShrink: 0 }}
                >
                  <Lock size={13} color="#9a3412" />
                </button>
              )}
            </div>
            <span style={{ fontSize: 12, color: '#585f67' }}>{docCount} document{docCount === 1 ? '' : 's'}</span>
          </div>
        </div>
        {canManage && (
          <button onClick={() => setMenuOpen(true)} aria-label="Folder actions" style={iconBtn}><MoreHorizontal size={16} /></button>
        )}
      </div>

      {folder.restricted && folder.grantCount === 0 && (
        <button
          onClick={() => canManage && onManageAccess(true)}
          title={canManage ? 'Grant access to users or groups' : undefined}
          style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 11, fontWeight: 600, borderRadius: 999, cursor: canManage ? 'pointer' : 'default', fontFamily: 'inherit' }}
        >
          <AlertTriangle size={10} /> No access granted
        </button>
      )}

      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 55 }} />
          <div style={{ position: 'absolute', right: 12, top: 44, zIndex: 56, background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.12)', minWidth: 180, overflow: 'hidden', padding: '4px 0' }}>
            <button
              onClick={() => { setMenuOpen(false); onManageAccess(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', border: 'none', background: 'none', fontSize: 14, color: '#0b1c30', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#eff4ff' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none' }}
            ><Shield size={15} color="#585f67" /> Manage</button>
            <button
              onClick={() => { setMenuOpen(false); onDelete() }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', border: 'none', background: 'none', fontSize: 14, color: '#dc2626', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#fef2f2' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none' }}
            ><Trash2 size={15} /> Delete folder</button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Lightweight document display (icon/list views) ────────────────────────────
// Both views are browse-only — no per-item badges or kebab menu. Clicking opens
// the Detail Panel, which carries Preview/Archive/Move/Delete.

const STATUS_DOT: Record<string, string> = {
  complete: '#16a34a', running: '#2563eb', queued: '#94a3b8', failed: '#dc2626', archived: '#a1a1aa',
}

function DocumentIconCard({ doc, docIcon, subLabel, onOpen }: {
  doc: { id: string; filename: string; status: string; sourceType: string }
  docIcon: (sourceType: string) => React.ReactNode
  subLabel?: string | undefined
  onOpen: () => void
}) {
  return (
    <button
      onClick={onOpen}
      title={doc.filename}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: '1px solid #c3c6d7', borderRadius: 10, background: '#ffffff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f8faff' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#ffffff' }}
    >
      {docIcon(doc.sourceType)}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#0b1c30', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.filename}</span>
        {subLabel && <span style={{ fontSize: 11, color: '#737686', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subLabel}</span>}
      </div>
      <span title={doc.status} style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_DOT[doc.status] ?? STATUS_DOT['queued'], flexShrink: 0 }} />
    </button>
  )
}

function DocumentListRow({ doc, docIcon, onOpen }: {
  doc: { id: string; filename: string; status: string; sourceType: string; createdAt: string }
  docIcon: (sourceType: string) => React.ReactNode
  onOpen: () => void
}) {
  return (
    <button
      onClick={onOpen}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', border: 'none', borderBottom: '1px solid #eff4ff', background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f8faff' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none' }}
    >
      {docIcon(doc.sourceType)}
      <span style={{ fontSize: 13, fontWeight: 500, color: '#0b1c30', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{doc.filename}</span>
      <span title={doc.status} style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_DOT[doc.status] ?? STATUS_DOT['queued'], flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: '#585f67', flexShrink: 0 }}>{formatDate(doc.createdAt)}</span>
    </button>
  )
}

function SubfolderListGroup({ folder, docs, docIcon, canManage, parentRestricted = false, expanded, onToggle, onOpenDoc, onManageAccess, onDelete }: {
  folder: CompartmentSummary
  docs: Array<{ id: string; filename: string; status: string; sourceType: string; createdAt: string }>
  docIcon: (sourceType: string) => React.ReactNode
  canManage: boolean
  parentRestricted?: boolean
  expanded: boolean
  onToggle: () => void
  onOpenDoc: (docId: string) => void
  onManageAccess: (initialEdit: boolean) => void
  onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const showLock = folder.restricted || parentRestricted
  const iconBtn: React.CSSProperties = { padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', borderRadius: 6, display: 'flex', flexShrink: 0 }

  return (
    <div style={{ border: '1px solid #c3c6d7', borderRadius: 10, background: '#ffffff', overflow: 'visible', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
        <button onClick={onToggle} aria-label={expanded ? 'Collapse' : 'Expand'} style={{ ...iconBtn, padding: 4 }}>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <Folder size={16} color="#004ac6" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#0b1c30', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
        {showLock && (
          <button
            onClick={() => onManageAccess(false)}
            title="View who has access"
            aria-label="Restricted — view who has access"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', flexShrink: 0 }}
          >
            <Lock size={13} color="#9a3412" />
          </button>
        )}
        <span style={{ fontSize: 12, color: '#585f67', flexShrink: 0 }}>{docs.length} document{docs.length === 1 ? '' : 's'}</span>
        {canManage && (
          <button onClick={() => setMenuOpen(true)} aria-label="Folder actions" style={iconBtn}><MoreHorizontal size={16} /></button>
        )}
      </div>

      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 55 }} />
          <div style={{ position: 'absolute', right: 12, top: 40, zIndex: 56, background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.12)', minWidth: 180, overflow: 'hidden', padding: '4px 0' }}>
            <button
              onClick={() => { setMenuOpen(false); onManageAccess(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', border: 'none', background: 'none', fontSize: 14, color: '#0b1c30', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#eff4ff' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none' }}
            ><Shield size={15} color="#585f67" /> Manage</button>
            <button
              onClick={() => { setMenuOpen(false); onDelete() }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', border: 'none', background: 'none', fontSize: 14, color: '#dc2626', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#fef2f2' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none' }}
            ><Trash2 size={15} /> Delete folder</button>
          </div>
        </>
      )}

      {expanded && (
        <div style={{ borderTop: '1px solid #eff4ff' }}>
          {docs.length === 0 ? (
            <p style={{ fontSize: 13, color: '#737686', margin: 0, padding: '16px 12px', textAlign: 'center' }}>No documents.</p>
          ) : (
            docs.map((doc) => <DocumentListRow key={doc.id} doc={doc} docIcon={docIcon} onOpen={() => onOpenDoc(doc.id)} />)
          )}
        </div>
      )}
    </div>
  )
}

// ─── Restricted access badge (breadcrumb) ───────────────────────────────────────
// Resolves the distinct set of users who can view this compartment: everyone
// directly granted, plus everyone in a granted group. Mirrors the "N groups, N
// users" wording already used in the Manage panel — admins are omitted from
// the count there too, since they always have implicit access regardless of
// grants and enumerating them wouldn't reflect what was actually configured.

function RestrictedAccessBadge({ orgId, compartment, onClick }: {
  orgId: string
  compartment: CompartmentSummary
  onClick: () => void
}) {
  const { data: grants } = useCompartmentGrants(orgId, compartment.id)
  const { data: groups = [] } = useGroups(orgId)
  const { data: allUsers = [] } = useUsers(orgId)

  const userCount = (() => {
    if (!grants) return null
    const grantedGroupNames = new Set(groups.filter((g) => grants.groupIds.includes(g.id)).map((g) => g.name))
    const userIds = new Set(grants.userIds)
    for (const u of allUsers) {
      if ((u.groups ?? []).some((name) => grantedGroupNames.has(name))) userIds.add(u.id)
    }
    return userIds.size
  })()

  return (
    <button
      onClick={onClick}
      title="View who has access"
      aria-label="Restricted — view who has access"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, marginLeft: 4, cursor: 'pointer', color: '#9a3412', fontFamily: 'inherit' }}
    >
      <Lock size={13} />
      {userCount !== null && <span style={{ fontSize: 12, fontWeight: 600 }}>{userCount}</span>}
    </button>
  )
}

// ─── View mode persistence ──────────────────────────────────────────────────────
// A display preference, not data — kept client-side (per browser, per user) rather
// than a DB column, so it needs no migration, API route, or server round trip.

function useDocumentsViewMode(userId: string) {
  const key = `cb:documents-view:${userId}`
  const [viewMode, setViewModeState] = useState<'icon' | 'list'>(() => {
    if (typeof window === 'undefined') return 'icon'
    return window.localStorage.getItem(key) === 'list' ? 'list' : 'icon'
  })
  const setViewMode = (mode: 'icon' | 'list') => {
    setViewModeState(mode)
    if (typeof window !== 'undefined') window.localStorage.setItem(key, mode)
  }
  return [viewMode, setViewMode] as const
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type DocItem = Awaited<ReturnType<typeof useDocuments>>['data'] extends Array<infer T> | undefined ? T : never

export default function DocumentsPage() {
  const user = getAuthUser()
  const orgId = user?.orgId ?? ''
  const canManageFolders = !!user?.role && hasPermission(user.role, 'users:manage')
  const searchParams = useSearchParams()
  const router = useRouter()

  const [showUpload, setShowUpload] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<DocItem | null>(null)
  const [docToDelete, setDocToDelete] = useState<DocItem | null>(null)
  const [docToArchive, setDocToArchive] = useState<DocItem | null>(null)
  const [docToMove, setDocToMove] = useState<DocItem | null>(null)
  const [previewDocId, setPreviewDocId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [rootSearch, setRootSearch] = useState('')

  const [openCompartmentId, setOpenCompartmentId] = useState<string | null>(null)
  const [createFolder, setCreateFolder] = useState<{ parent: CompartmentSummary | null; tier: 'internal' | 'external' } | null>(null)
  const [accessPanel, setAccessPanel] = useState<{ folderId: string; edit: boolean } | null>(null)
  const [folderToDelete, setFolderToDelete] = useState<CompartmentSummary | null>(null)
  const [viewMode, setViewMode] = useDocumentsViewMode(user?.id ?? '')
  const [expandedSubfolders, setExpandedSubfolders] = useState<Set<string>>(new Set())

  useEffect(() => { setExpandedSubfolders(new Set()) }, [openCompartmentId])

  // Sidebar "Documents" link navigates here with ?home=1 when already on this
  // page (a same-route Link is otherwise a no-op) — return to the top-level
  // folder browser and clear any open panel/search state.
  useEffect(() => {
    if (searchParams.get('home') === '1') {
      setOpenCompartmentId(null)
      setSelectedDoc(null)
      setSearch('')
      setRootSearch('')
      router.replace('/documents')
    }
  }, [searchParams, router])

  const { data: docs = [], isLoading } = useDocuments(orgId)
  const { data: compartments = [], refetch: refetchCompartments } = useCompartments(orgId)

  // The "move documents to" list in the delete dialog is only as fresh as the
  // last fetch (30s staleTime) — force a refetch right as the dialog opens so
  // it can't offer a folder another session already deleted.
  const requestDeleteFolder = (folder: CompartmentSummary) => {
    refetchCompartments()
    setFolderToDelete(folder)
  }
  const { data: sub } = useSubscription(orgId)
  const deleteDoc = useDeleteDocument(orgId)
  const archiveDoc = useArchiveDocument(orgId)
  const unarchiveDoc = useUnarchiveDocument(orgId)
  const moveDoc = useMoveDocument(orgId)

  const isPaid = sub?.plan === 'paid'
  const topLevel = compartments.filter((c) => !c.parentCompartmentId)
  const subsOf = (parentId: string) => compartments.filter((c) => c.parentCompartmentId === parentId)
  // A folder's count includes its subfolders' documents (nesting is one level
  // deep, so subfolders never have children of their own). `docs` is already
  // scoped to what the current user can see — GET /documents excludes
  // restricted (sub-)compartments the caller has no grant for — so this count
  // never reveals documents the viewer can't actually open.
  const docCount = (compartmentId: string) => {
    const includedIds = new Set([compartmentId, ...subsOf(compartmentId).map((s) => s.id)])
    return docs.filter((d) => includedIds.has(d.compartmentId)).length
  }

  const getCompartmentName = (compartmentId: string) => {
    const comp = compartments.find((c) => c.id === compartmentId)
    return comp ? compartmentLabel(comp, compartments) : '—'
  }

  const openCompartment = compartments.find((c) => c.id === openCompartmentId) ?? null
  const openParent = openCompartment?.parentCompartmentId
    ? compartments.find((c) => c.id === openCompartment.parentCompartmentId) ?? null
    : null
  const accessPanelFolder = accessPanel ? compartments.find((c) => c.id === accessPanel.folderId) ?? null : null

  const filtersActive = !!search
  const filterDocsList = (list: typeof docs) => list.filter((d) => {
    if (search && !d.filename.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const docsInOpenFolder = docs.filter((d) => d.compartmentId === openCompartmentId)
  const filteredDocs = filterDocsList(docsInOpenFolder)

  // Root-page search: org-wide, across every folder and subfolder, tagged with
  // tier + folder path since results are shown out of any folder context.
  const rootSearchResults = rootSearch.trim()
    ? docs
        .filter((d) => d.filename.toLowerCase().includes(rootSearch.trim().toLowerCase()))
        .map((doc) => ({
          doc,
          subLabel: `${doc.accessTier === 'external' ? 'External' : 'Internal'} · ${getCompartmentName(doc.compartmentId)}`,
        }))
    : []

  // While searching, icon view also surfaces matches from this folder's subfolders
  // (list view already does this via auto-expanding groups) — each tagged with
  // which subfolder it actually lives in, since it's shown out of context.
  const subfolderMatches = (compartmentId: string) =>
    search
      ? subsOf(compartmentId).flatMap((sub) =>
          filterDocsList(docs.filter((d) => d.compartmentId === sub.id)).map((doc) => ({ doc, folderName: sub.name }))
        )
      : []
  const isParentLevel = !!openCompartment && !openCompartment.parentCompartmentId

  const docIcon = (sourceType: string) => {
    if (sourceType === 'hr_policy' || sourceType === 'compliance') return <FileText size={18} color="#585f67" />
    if (sourceType === 'sop' || sourceType === 'product_doc') return <Table2 size={18} color="#585f67" />
    if (sourceType === 'faq') return <Link size={18} color="#585f67" />
    return <File size={18} color="#585f67" />
  }

  const folderGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }

  const renderTierSection = (tier: 'internal' | 'external') => {
    const folders = topLevel.filter((c) => c.accessTier === tier)
    const locked = tier === 'external' && !isPaid
    return (
      <div key={tier} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#0b1c30', margin: 0 }}>{TIER_LABELS[tier]}</h2>
          {canManageFolders && (
            locked ? (
              <span style={{ fontSize: 12, color: '#9a3412' }}>Upgrade to a paid plan to add external folders</span>
            ) : (
              <button
                onClick={() => setCreateFolder({ parent: null, tier })}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', color: '#004ac6', border: '1px solid #004ac6', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
              ><FolderPlus size={14} /> New Folder</button>
            )
          )}
        </div>
        {folders.length === 0 ? (
          <p style={{ fontSize: 13, color: '#737686', margin: 0, padding: '24px 0', textAlign: 'center', border: '1px dashed #c3c6d7', borderRadius: 12 }}>
            No {tier} folders yet.
          </p>
        ) : (
          <div style={folderGrid}>
            {folders.map((c) => (
              <FolderCard
                key={c.id}
                folder={c}
                docCount={docCount(c.id)}
                canManage={canManageFolders}
                onOpen={() => setOpenCompartmentId(c.id)}
                onManageAccess={(edit) => setAccessPanel({ folderId: c.id, edit })}
                onDelete={() => requestDeleteFolder(c)}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader />

      <div style={{ flex: 1, overflow: 'auto', padding: 32, display: 'flex', flexDirection: 'column', gap: 32, position: 'relative' }}>
        {openCompartmentId === null ? (
          <>
            <div style={{ position: 'relative'}}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#737686' }} />
              <input
                value={rootSearch}
                onChange={(e) => setRootSearch(e.target.value)}
                placeholder="Search all documents..."
                style={{ width: '100%', height: 40, paddingLeft: 34, paddingRight: 12, border: '1px solid #c3c6d7', borderRadius: 10, fontSize: 14, background: '#f8f9ff', outline: 'none', color: '#0b1c30', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
            {rootSearch.trim() ? (
              rootSearchResults.length === 0 ? (
                <p style={{ fontSize: 13, color: '#737686', margin: 0, padding: '24px 0', textAlign: 'center' }}>No documents match &ldquo;{rootSearch.trim()}&rdquo;.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                  {rootSearchResults.map(({ doc, subLabel }) => (
                    <DocumentIconCard key={doc.id} doc={doc} docIcon={docIcon} subLabel={subLabel} onOpen={() => setSelectedDoc(doc)} />
                  ))}
                </div>
              )
            ) : (
              <>
                {renderTierSection('internal')}
                {renderTierSection('external')}
              </>
            )}
          </>
        ) : !openCompartment ? (
          <p style={{ color: '#737686' }}>Folder not found.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Breadcrumb + folder toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                <button onClick={() => setOpenCompartmentId(null)} style={{ background: 'none', border: 'none', color: '#004ac6', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, padding: 0 }}>
                  {TIER_LABELS[openCompartment.accessTier as 'internal' | 'external']}
                </button>
                {openParent && (
                  <>
                    <ChevronRight size={14} color="#c3c6d7" />
                    <button onClick={() => setOpenCompartmentId(openParent.id)} style={{ background: 'none', border: 'none', color: '#004ac6', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, padding: 0 }}>
                      {openParent.name}
                    </button>
                  </>
                )}
                <ChevronRight size={14} color="#c3c6d7" />
                <span style={{ color: '#0b1c30', fontWeight: 600 }}>{openCompartment.name}</span>
                {(openCompartment.restricted || openParent?.restricted) && (
                  <RestrictedAccessBadge
                    orgId={orgId}
                    compartment={openCompartment.restricted ? openCompartment : openParent!}
                    onClick={() => setAccessPanel({ folderId: (openCompartment.restricted ? openCompartment : openParent!).id, edit: false })}
                  />
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, flexShrink: 0, alignItems: 'center' }}>
                <div style={{ position: 'relative', width: 220, flexShrink: 0 }}>
                  <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#737686' }} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by filename..."
                    style={{ width: '100%', height: 40, paddingLeft: 34, paddingRight: 12, border: '1px solid #c3c6d7', borderRadius: 10, fontSize: 14, background: '#f8f9ff', outline: 'none', color: '#0b1c30', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', border: '1px solid #c3c6d7', borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
                  <button
                    onClick={() => setViewMode('icon')}
                    title="Icon view"
                    aria-pressed={viewMode === 'icon'}
                    style={{ padding: '0 14px', border: 'none', background: viewMode === 'icon' ? '#eff4ff' : 'transparent', color: viewMode === 'icon' ? '#004ac6' : '#585f67', cursor: 'pointer', display: 'flex', alignItems: 'center', height: 40 }}
                  ><LayoutGrid size={16} /></button>
                  <button
                    onClick={() => setViewMode('list')}
                    title="List view"
                    aria-pressed={viewMode === 'list'}
                    style={{ padding: '0 14px', border: 'none', borderLeft: '1px solid #c3c6d7', background: viewMode === 'list' ? '#eff4ff' : 'transparent', color: viewMode === 'list' ? '#004ac6' : '#585f67', cursor: 'pointer', display: 'flex', alignItems: 'center', height: 40 }}
                  ><ListIcon size={16} /></button>
                </div>
                <button
                  onClick={() => setShowUpload(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 12, padding: '10px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                  ><Plus size={16} />Documents</button>
                {canManageFolders && (
                <FolderActionsMenu
                    isTopLevel={isParentLevel}
                    onNewSubfolder={() => setCreateFolder({ parent: openCompartment, tier: openCompartment.accessTier as 'internal' | 'external' })}
                    onManage={() => setAccessPanel({ folderId: openCompartment.id, edit: false })}
                    onDelete={() => requestDeleteFolder(openCompartment)}
                />
                )}
              </div>
            </div>

            {/* Subfolders (icon view only — list view shows them as expandable groups below) */}
            {viewMode === 'icon' && subsOf(openCompartment.id).length > 0 && (
              <div style={folderGrid}>
                {subsOf(openCompartment.id).map((c) => (
                  <FolderCard
                    key={c.id}
                    folder={c}
                    docCount={docCount(c.id)}
                    canManage={canManageFolders}
                    parentRestricted={openCompartment.restricted}
                    onOpen={() => setOpenCompartmentId(c.id)}
                    onManageAccess={(edit) => setAccessPanel({ folderId: c.id, edit })}
                    onDelete={() => requestDeleteFolder(c)}
                  />
                ))}
              </div>
            )}

            {/* Icon view: direct documents, plus (while searching) matches from subfolders */}
            {viewMode === 'icon' && (() => {
              const combined = [
                ...filteredDocs.map((doc) => ({ doc, folderName: undefined as string | undefined })),
                ...subfolderMatches(openCompartment.id),
              ]
              return isLoading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} style={{ height: 44, background: '#eff4ff', borderRadius: 10, animation: 'cb-skel 1.5s ease-in-out infinite' }} />
                  ))}
                </div>
              ) : combined.length === 0 ? (
                <p style={{ fontSize: 13, color: '#737686', margin: 0, padding: '24px 0', textAlign: 'center' }}>
                  {search ? `No documents match "${search}".` : 'No documents in this folder.'}
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                  {combined.map(({ doc, folderName }) => (
                    <DocumentIconCard
                      key={doc.id}
                      doc={doc}
                      docIcon={docIcon}
                      subLabel={folderName ? `in ${folderName}` : undefined}
                      onOpen={() => setSelectedDoc(doc)}
                    />
                  ))}
                </div>
              )
            })()}

            {/* List view: direct documents flat, subfolders as expandable dropdown groups */}
            {viewMode === 'list' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredDocs.length > 0 && (
                  <div style={{ border: '1px solid #c3c6d7', borderRadius: 10, background: '#ffffff', overflow: 'hidden' }}>
                    {filteredDocs.map((doc) => (
                      <DocumentListRow key={doc.id} doc={doc} docIcon={docIcon} onOpen={() => setSelectedDoc(doc)} />
                    ))}
                  </div>
                )}
                {subsOf(openCompartment.id).map((sub) => {
                  const subDocs = filterDocsList(docs.filter((d) => d.compartmentId === sub.id))
                  const expanded = filtersActive || expandedSubfolders.has(sub.id)
                  return (
                    <SubfolderListGroup
                      key={sub.id}
                      folder={sub}
                      docs={subDocs}
                      docIcon={docIcon}
                      canManage={canManageFolders}
                      parentRestricted={openCompartment.restricted}
                      expanded={expanded}
                      onToggle={() => setExpandedSubfolders((prev) => {
                        const next = new Set(prev)
                        if (next.has(sub.id)) next.delete(sub.id); else next.add(sub.id)
                        return next
                      })}
                      onOpenDoc={(docId) => { const d = docs.find((x) => x.id === docId); if (d) setSelectedDoc(d) }}
                      onManageAccess={(edit) => setAccessPanel({ folderId: sub.id, edit })}
                      onDelete={() => requestDeleteFolder(sub)}
                    />
                  )
                })}
                {filteredDocs.length === 0 && subsOf(openCompartment.id).length === 0 && (
                  <p style={{ fontSize: 13, color: '#737686', margin: 0, padding: '24px 0', textAlign: 'center' }}>No documents or subfolders in this folder.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Backdrop — click outside the detail panel to close it */}
        {selectedDoc && (
          <div onClick={() => setSelectedDoc(null)} style={{ position: 'absolute', inset: 0, zIndex: 49 }} />
        )}

        {/* Detail panel */}
        <DetailPanel
          doc={selectedDoc}
          compartmentName={selectedDoc ? getCompartmentName(selectedDoc.compartmentId) : '—'}
          canMove={!!selectedDoc && compartments.filter((c) => c.accessTier === selectedDoc.accessTier && c.id !== selectedDoc.compartmentId).length > 0}
          onClose={() => setSelectedDoc(null)}
          onDelete={() => { if (selectedDoc) setDocToDelete(selectedDoc) }}
          onArchive={() => { if (selectedDoc) setDocToArchive(selectedDoc) }}
          onUnarchive={() => { if (selectedDoc) unarchiveDoc.mutate(selectedDoc.id) }}
          onMove={() => { if (selectedDoc) setDocToMove(selectedDoc) }}
          onPreview={setPreviewDocId}
        />
      </div>

      {previewDocId && (
        <DocumentPreview orgId={orgId} docId={previewDocId} onClose={() => setPreviewDocId(null)} />
      )}

      <style>{`@keyframes cb-skel { 0%,100%{opacity:.5}50%{opacity:1} }`}</style>

      {showUpload && openCompartment && <UploadDialog orgId={orgId} folder={openCompartment} onClose={() => setShowUpload(false)} />}

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
      {docToMove && (
        <MoveDocumentDialog
          doc={docToMove}
          compartments={compartments}
          isPending={moveDoc.isPending}
          onCancel={() => setDocToMove(null)}
          onConfirm={(targetCompartmentId) =>
            moveDoc.mutate({ docId: docToMove.id, compartmentId: targetCompartmentId }, { onSuccess: () => setDocToMove(null) })
          }
        />
      )}

      {createFolder && (
        <CreateFolderDialog orgId={orgId} parent={createFolder.parent} tier={createFolder.tier} onClose={() => setCreateFolder(null)} />
      )}
      {accessPanel && accessPanelFolder && (
        <FolderAccessDialog
          orgId={orgId}
          folder={accessPanelFolder}
          parent={compartments.find((c) => c.id === accessPanelFolder.parentCompartmentId) ?? null}
          initialEdit={accessPanel.edit}
          onClose={() => setAccessPanel(null)}
          onRequestDelete={() => requestDeleteFolder(accessPanelFolder)}
        />
      )}
      {folderToDelete && (
        <DeleteFolderDialog
          orgId={orgId}
          folder={folderToDelete}
          compartments={compartments}
          onCancel={() => setFolderToDelete(null)}
          onDeleted={() => {
            if (openCompartmentId === folderToDelete.id) setOpenCompartmentId(folderToDelete.parentCompartmentId ?? null)
            setFolderToDelete(null)
          }}
        />
      )}
    </div>
  )
}
