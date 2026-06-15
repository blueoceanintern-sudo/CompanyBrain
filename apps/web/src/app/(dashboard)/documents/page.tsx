'use client'

import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Upload, Trash2, Paperclip } from 'lucide-react'
import { useDocuments, useUploadDocument, useDeleteDocument } from '@/hooks/use-documents'
import { useCompartments } from '@/hooks/use-compartments'
import { getAuthUser } from '@/lib/auth'
import { formatDate } from '@/lib/utils'

const SOURCE_TYPE_LABELS: Record<string, string> = {
  hr_policy: 'HR Policy', sop: 'SOP', faq: 'FAQ',
  case_note: 'Case Note', compliance: 'Compliance',
  product_doc: 'Product Doc', other: 'Other',
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  complete:   { bg: 'var(--color-success-subtle)',  color: 'var(--color-success)'  },
  running:    { bg: 'var(--color-warning-subtle)',  color: 'var(--color-warning)'  },
  failed:     { bg: 'var(--color-danger-subtle)',   color: 'var(--color-danger)'   },
  queued:     { bg: 'var(--color-surface)',          color: 'var(--color-text-muted)' },
}

const TIER_STYLE: Record<string, { bg: string; color: string }> = {
  internal: { bg: 'var(--color-internal-subtle)', color: 'var(--color-internal)' },
  external: { bg: 'var(--color-external-subtle)', color: 'var(--color-external)' },
}

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '1px var(--space-2)', background: bg, color, borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

const uploadSchema = z.object({
  compartmentId: z.string().min(1, 'Select a compartment'),
  accessTier: z.enum(['internal', 'external']),
  sourceType: z.enum(['hr_policy', 'sop', 'faq', 'case_note', 'compliance', 'product_doc', 'other']),
})

type UploadFormValues = z.infer<typeof uploadSchema>

function UploadDialog({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: compartments = [], isLoading: compartmentsLoading } = useCompartments(orgId)
  const upload = useUploadDocument(orgId)
  const noCompartments = !compartmentsLoading && compartments.length === 0

  const { register, handleSubmit, formState: { errors } } = useForm<UploadFormValues>({
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
    width: '100%', height: 'var(--input-h)', padding: '0 var(--space-3)',
    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
    background: 'var(--color-surface-raised)', color: 'var(--color-text)', fontSize: 'var(--text-sm)',
  }

  return (
    <div
      role="dialog"
      aria-labelledby="upload-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'oklch(0% 0 0 / 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
    >
      <div style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-8)', width: 'min(480px, 90vw)', boxShadow: 'var(--shadow-lg)' }}>
        <h2 id="upload-title" style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: '0 0 var(--space-6)' }}>Upload document</h2>

        {noCompartments ? (
          <div style={{ padding: 'var(--space-4)', background: 'var(--color-warning-subtle)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-warning)', margin: 0 }}>
              No compartments yet — create one in Settings before uploading.
            </p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', marginBottom: 'var(--space-2)' }}>File (PDF, Word, or plain text)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%', height: 'var(--input-h)', padding: '0 var(--space-3)',
                border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface-raised)',
                color: file ? 'var(--color-text)' : 'var(--color-text-muted)',
                fontSize: 'var(--text-sm)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 'var(--space-2)', textAlign: 'left',
              }}
            >
              <Paperclip size={13} aria-hidden />
              {file ? file.name : 'Choose file…'}
            </button>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', marginBottom: 'var(--space-2)' }}>Compartment</label>
            <select {...register('compartmentId')} disabled={noCompartments} style={{ ...inputStyle, opacity: noCompartments ? 0.5 : 1 }}>
              {compartments.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.compartmentId && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)', marginTop: 2 }}>{errors.compartmentId.message}</p>}
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', marginBottom: 'var(--space-2)' }}>Access tier</label>
              <select {...register('accessTier')} style={inputStyle}>
                <option value="internal">Internal</option>
                <option value="external">External</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', marginBottom: 'var(--space-2)' }}>Source type</label>
              <select {...register('sourceType')} style={inputStyle}>
                {Object.entries(SOURCE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
            <button type="button" onClick={onClose} style={{ height: 'var(--input-h)', padding: '0 var(--space-5)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', fontSize: 'var(--text-sm)', cursor: 'pointer', color: 'var(--color-text)' }}>
              Cancel
            </button>
            <button type="submit" disabled={!file || upload.isPending || noCompartments} style={{ height: 'var(--input-h)', padding: '0 var(--space-5)', border: 'none', borderRadius: 'var(--radius-md)', background: 'var(--color-brand)', color: 'var(--color-brand-fg)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', opacity: (!file || noCompartments) ? 0.5 : 1, cursor: (upload.isPending || noCompartments) ? 'not-allowed' : 'pointer' }}>
              {upload.isPending ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function DocumentsPage() {
  const user = getAuthUser()
  const orgId = user?.orgId ?? ''
  const [showUpload, setShowUpload] = useState(false)

  const { data: docs = [], isLoading } = useDocuments(orgId)
  const deleteDoc = useDeleteDocument(orgId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ height: 'var(--header-h)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--space-8)', position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 10, flexShrink: 0 }}>
        <h1 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', margin: 0 }}>Documents</h1>
        <button
          onClick={() => setShowUpload(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', height: 'var(--input-h)', padding: '0 var(--space-4)', background: 'var(--color-brand)', color: 'var(--color-brand-fg)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', cursor: 'pointer' }}
        >
          <Upload size={14} aria-hidden />
          Upload
        </button>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table aria-label="Documents" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
          <thead>
            <tr style={{ position: 'sticky', top: 0, background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
              {['Filename', 'Source type', 'Access tier', 'Status', 'Uploaded', 'Actions'].map((h) => (
                <th key={h} style={{ padding: '0 var(--space-4)', height: 'var(--row-height-default)', textAlign: 'left', fontWeight: 'var(--font-medium)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                {Array.from({ length: 6 }).map((__, j) => (
                  <td key={j} style={{ padding: '0 var(--space-4)', height: 'var(--row-height-default)' }}>
                    <Skeleton w={j === 0 ? 200 : 80} h={14} />
                  </td>
                ))}
              </tr>
            ))}

            {!isLoading && docs.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-medium)', margin: '0 0 var(--space-2)' }}>No documents yet</p>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: 0 }}>Upload a PDF or Word document to get started.</p>
              </td></tr>
            )}

            {docs.map((doc) => {
              const ss = STATUS_STYLE[doc.status] ?? STATUS_STYLE['queued']!
              const ts = TIER_STYLE[doc.accessTier] ?? TIER_STYLE['internal']!
              return (
                <tr
                  key={doc.id}
                  style={{ borderBottom: '1px solid var(--color-border)', cursor: 'default' }}
                  onMouseEnter={(e) => { ;(e.currentTarget as HTMLElement).style.background = 'var(--color-brand-subtle)' }}
                  onMouseLeave={(e) => { ;(e.currentTarget as HTMLElement).style.background = '' }}
                >
                  <td style={{ padding: '0 var(--space-4)', height: 'var(--row-height-default)', fontWeight: 'var(--font-medium)', minWidth: 200 }}>{doc.filename}</td>
                  <td style={{ padding: '0 var(--space-4)', height: 'var(--row-height-default)', width: 120 }}>{SOURCE_TYPE_LABELS[doc.sourceType] ?? doc.sourceType}</td>
                  <td style={{ padding: '0 var(--space-4)', height: 'var(--row-height-default)', width: 100 }}><Badge label={doc.accessTier} {...ts} /></td>
                  <td style={{ padding: '0 var(--space-4)', height: 'var(--row-height-default)', width: 100 }}><Badge label={doc.status} {...ss} /></td>
                  <td style={{ padding: '0 var(--space-4)', height: 'var(--row-height-default)', width: 120, color: 'var(--color-text-muted)' }}>{formatDate(doc.createdAt)}</td>
                  <td style={{ padding: '0 var(--space-4)', height: 'var(--row-height-default)', width: 80 }}>
                    <button
                      onClick={() => { if (confirm('Archive this document?')) deleteDoc.mutate(doc.id) }}
                      aria-label={`Archive ${doc.filename}`}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 0, display: 'flex', alignItems: 'center' }}
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showUpload && <UploadDialog orgId={orgId} onClose={() => setShowUpload(false)} />}
    </div>
  )
}

function Skeleton({ w, h }: { w?: number; h?: number }) {
  return <div style={{ width: w ?? '100%', height: h ?? 14, background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', animation: 'cb-skel 1.5s ease-in-out infinite' }} />
}
