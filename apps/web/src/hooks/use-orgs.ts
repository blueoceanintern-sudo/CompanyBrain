'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { listOrgs, createOrg, getOrgProfile, updateOrgProfile, unwrap } from '@/lib/api'

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

// The caller's own org profile (name/plan/id) — distinct from useOrgs above,
// which is the platform-wide list only super_admin can see.
export function useOrgProfile(orgId: string) {
  return useQuery({
    queryKey: ['org-profile', orgId],
    queryFn: async () => unwrap(await getOrgProfile(orgId)),
    enabled: !!orgId,
  })
}

export function useUpdateOrgProfile(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string }) => unwrap(await updateOrgProfile(orgId, data)),
    onSuccess: () => {
      toast.success('Organisation name updated')
      qc.invalidateQueries({ queryKey: ['org-profile', orgId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
