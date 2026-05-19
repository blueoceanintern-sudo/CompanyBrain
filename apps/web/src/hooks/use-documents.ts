'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MOCK_DOCUMENTS } from '@/lib/mock-data'
import { getDocuments, uploadDocument, deleteDocument } from '@/lib/api'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true' || process.env.NEXT_PUBLIC_API_URL === undefined

export function useDocuments(orgId: string) {
  return useQuery({
    queryKey: ['documents', orgId],
    queryFn: async () => {
      if (USE_MOCK) return MOCK_DOCUMENTS
      const result = await getDocuments(orgId)
      if (!result.success) throw new Error(result.error.message)
      return result.data as typeof MOCK_DOCUMENTS
    },
    enabled: !!orgId,
  })
}

export function useUploadDocument(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (formData: FormData) => {
      if (USE_MOCK) {
        return new Promise<{ documentId: string; chunksCreated: number }>((resolve) =>
          setTimeout(() => resolve({ documentId: 'doc-new', chunksCreated: 12 }), 1200)
        )
      }
      return uploadDocument(orgId, formData).then((r) => {
        if (!r.success) throw new Error(r.error.message)
        return r.data
      })
    },
    onSuccess: () => {
      toast.success('Document ingested successfully')
      qc.invalidateQueries({ queryKey: ['documents', orgId] })
    },
    onError: (err: Error) => toast.error(`Ingestion failed: ${err.message}`),
  })
}

export function useDeleteDocument(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (docId: string) => {
      if (USE_MOCK) return Promise.resolve(null)
      return deleteDocument(orgId, docId).then((r) => {
        if (!r.success) throw new Error(r.error.message)
        return null
      })
    },
    onSuccess: () => {
      toast('Document archived', {
        action: { label: 'Undo', onClick: () => toast.info('Undo not yet wired to API') },
      })
      qc.invalidateQueries({ queryKey: ['documents', orgId] })
    },
    onError: () => toast.error('Delete failed'),
  })
}
