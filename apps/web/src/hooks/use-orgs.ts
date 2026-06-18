'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { listOrgs, createOrg, unwrap } from '@/lib/api'

export function useOrgs() {
  return useQuery({
    queryKey: ['orgs'],
    queryFn: async () => unwrap(await listOrgs()),
  })
}

export function useCreateOrg() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { orgName: string; adminEmail: string; adminTemporaryPassword: string }) =>
      unwrap(await createOrg(data)),
    onSuccess: () => {
      toast.success('Organisation created')
      qc.invalidateQueries({ queryKey: ['orgs'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
