'use client'

import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Search, Upload, Paperclip, X, FileText, Table2, Link, File, FolderPlus } from 'lucide-react'
import { useDocuments, useUploadDocument, useDeleteDocument } from '@/hooks/use-documents'
import { useCompartments, useCreateCompartment } from '@/hooks/use-compartments'
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
            onClick={() => { if (confirm('Delete this document?')) onDelete(doc.id) }}
            style={{ flex: 1, padding: '10px 0', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: '#fef2f2', color: '#dc2626', border: 'none', fontFamily: 'inherit' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#fee2e2' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#fef2f2' }}
          >Delete</button>
        </div>
      )}
    </div>
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
              {compartments.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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

// ─── Create compartment dialog ────────────────────────────────────────────────

function CreateCompartmentDialog({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const [name, setName] = useState('')
  const create = useCreateCompartment(orgId)

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 44, padding: '0 12px',
    border: '1px solid #c3c6d7', borderRadius: 8,
    background: '#ffffff', color: '#0b1c30', fontSize: 14, fontFamily: 'inherit',
  }

  return (
    <div role="dialog" onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 16, padding: 32, width: 'min(400px, 90vw)', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 24px', color: '#0b1c30' }}>New Compartment</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#434655', marginBottom: 8 }}>Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) create.mutate({ name: name.trim() }, { onSuccess: onClose })
                if (e.key === 'Escape') onClose()
              }}
              placeholder="e.g. HR Department"
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" onClick={onClose}
              style={{ height: 44, padding: '0 20px', border: '1px solid #c3c6d7', borderRadius: 8, background: 'transparent', fontSize: 14, cursor: 'pointer', color: '#0b1c30', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button
              disabled={!name.trim() || create.isPending}
              onClick={() => create.mutate({ name: name.trim() }, { onSuccess: onClose })}
              style={{ height: 44, padding: '0 20px', border: 'none', borderRadius: 8, background: '#2563eb', color: '#ffffff', fontSize: 14, fontWeight: 500, cursor: (!name.trim() || create.isPending) ? 'not-allowed' : 'pointer', opacity: !name.trim() ? 0.5 : 1, fontFamily: 'inherit' }}>
              {create.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type DocItem = Awaited<ReturnType<typeof useDocuments>>['data'] extends Array<infer T> | undefined ? T : never

export default function DocumentsPage() {
  const user = getAuthUser()
  const orgId = user?.orgId ?? ''
  const [showUpload, setShowUpload] = useState(false)
  const [showCreateCompartment, setShowCreateCompartment] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<DocItem | null>(null)
  const [search, setSearch] = useState('')
  const [sourceTypeFilter, setSourceTypeFilter] = useState('')
  const [accessTierFilter, setAccessTierFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data: docs = [], isLoading } = useDocuments(orgId)
  const { data: compartments = [] } = useCompartments(orgId)
  const deleteDoc = useDeleteDocument(orgId)

  const getCompartmentName = (compartmentId: string) =>
    compartments.find((c) => c.id === compartmentId)?.name ?? '—'

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
              onClick={() => setShowCreateCompartment(true)}
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
          </select>
        </div>

        {/* Table */}
        <div style={{ background: '#ffffff', border: '1px solid #c3c6d7', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ overflow: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f8f9ff', borderBottom: '1px solid #c3c6d7' }}>
                  {['FILENAME', 'SOURCE TYPE', 'ACCESS TIER', 'STATUS', 'UPLOADED DATE', 'ACTIONS'].map((h) => (
                    <th key={h} style={{ padding: '14px 24px', textAlign: 'left', fontSize: 11, fontWeight: 500, color: '#585f67', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #c3c6d7' }}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} style={{ padding: '16px 24px' }}>
                        <div style={{ height: 14, background: '#eff4ff', borderRadius: 4, width: j === 0 ? 200 : 80, animation: 'cb-skel 1.5s ease-in-out infinite' }} />
                      </td>
                    ))}
                  </tr>
                ))}
                {!isLoading && filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: '#737686' }}>No documents found.</td></tr>
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
                    <td style={{ padding: '16px 24px', color: '#585f67' }}>{SOURCE_TYPE_LABELS[doc.sourceType] ?? doc.sourceType}</td>
                    <td style={{ padding: '16px 24px' }}><TierBadge tier={doc.accessTier} /></td>
                    <td style={{ padding: '16px 24px' }}><StatusBadge status={doc.status} /></td>
                    <td style={{ padding: '16px 24px', color: '#585f67' }}>{formatDate(doc.createdAt)}</td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (confirm('Delete?')) deleteDoc.mutate(doc.id) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#585f67', padding: 4, display: 'flex', alignItems: 'center' }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                      </button>
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
          onDelete={(id) => { deleteDoc.mutate(id); setSelectedDoc(null) }}
        />
      </div>

      <style>{`@keyframes cb-skel { 0%,100%{opacity:.5}50%{opacity:1} }`}</style>
      {showUpload && <UploadDialog orgId={orgId} onClose={() => setShowUpload(false)} />}
      {showCreateCompartment && <CreateCompartmentDialog orgId={orgId} onClose={() => setShowCreateCompartment(false)} />}
    </div>
  )
}
