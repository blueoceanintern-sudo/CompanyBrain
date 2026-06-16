'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getDocuments, uploadDocument, deleteDocument } from '@/lib/api'

export function useDocuments(orgId: string) {
  return useQuery({
    queryKey: ['documents', orgId],
    queryFn: async () => {
      const result = await getDocuments(orgId)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    enabled: !!orgId,
  })
}

export function useUploadDocument(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (formData: FormData) =>
      uploadDocument(orgId, formData).then((r) => {
        if (!r.success) throw new Error(r.error.message)
        return r.data
      }),
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
    mutationFn: (docId: string) =>
      deleteDocument(orgId, docId).then((r) => {
        if (!r.success) throw new Error(r.error.message)
        return null
      }),
    onSuccess: () => {
      toast('Document archived')
      qc.invalidateQueries({ queryKey: ['documents', orgId] })
    },
    onError: () => toast.error('Archive failed'),
  })
}
