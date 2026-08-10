'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getDocuments, uploadDocument, deleteDocument, archiveDocument, unarchiveDocument, updateDocument } from '@/lib/api'

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
    onSuccess: (data) => {
      // The upload worked either way — but a file with no text layer is stored
      // and viewable without being searchable, which is worth saying plainly
      // rather than reporting as a success and leaving them to wonder why the
      // document never turns up in answers.
      if (data.extractedText === false) {
        toast.warning('Uploaded, but no text could be extracted', {
          description: 'It is stored and viewable, but cannot be used to answer questions. Scanned or image-only files need OCR.',
        })
      } else {
        toast.success('Document ingested successfully')
      }
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
      toast('Document permanently deleted')
      qc.invalidateQueries({ queryKey: ['documents', orgId] })
    },
    onError: () => toast.error('Delete failed'),
  })
}

export function useArchiveDocument(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (docId: string) =>
      archiveDocument(orgId, docId).then((r) => {
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

export function useMoveDocument(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ docId, compartmentId }: { docId: string; compartmentId: string }) =>
      updateDocument(orgId, docId, { compartmentId }).then((r) => {
        if (!r.success) throw new Error(r.error.message)
        return null
      }),
    onSuccess: () => {
      toast.success('Document moved')
      qc.invalidateQueries({ queryKey: ['documents', orgId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUnarchiveDocument(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (docId: string) =>
      unarchiveDocument(orgId, docId).then((r) => {
        if (!r.success) throw new Error(r.error.message)
        return null
      }),
    onSuccess: () => {
      toast('Document restored')
      qc.invalidateQueries({ queryKey: ['documents', orgId] })
    },
    onError: () => toast.error('Restore failed'),
  })
}
