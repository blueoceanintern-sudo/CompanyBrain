'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getConnectStatus,
  startConnectOnboarding,
  getExternalPricing,
  setExternalPricing,
  startCheckout,
  startOrgUpgrade,
  openBillingPortal,
  unwrap,
} from '@/lib/api'

export function useConnectStatus(orgId: string) {
  return useQuery({
    queryKey: ['connect-status', orgId],
    queryFn: async () => unwrap(await getConnectStatus(orgId)),
    enabled: !!orgId,
  })
}

export function useStartConnectOnboarding(orgId: string) {
  return useMutation({
    mutationFn: async () => unwrap(await startConnectOnboarding(orgId)),
    onSuccess: ({ url }) => { window.location.href = url },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useExternalPricing(orgId: string) {
  return useQuery({
    queryKey: ['external-pricing', orgId],
    queryFn: async () => unwrap(await getExternalPricing(orgId)),
    enabled: !!orgId,
  })
}

export function useSetExternalPricing(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (priceCents: number) => unwrap(await setExternalPricing(orgId, priceCents)),
    onSuccess: () => {
      toast.success('External price updated')
      qc.invalidateQueries({ queryKey: ['external-pricing', orgId] })
      qc.invalidateQueries({ queryKey: ['subscription', orgId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useStartCheckout(orgId: string) {
  return useMutation({
    mutationFn: async () => unwrap(await startCheckout(orgId)),
    onSuccess: ({ url }) => { window.location.href = url },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useStartOrgUpgrade(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => unwrap(await startOrgUpgrade(orgId)),
    onSuccess: ({ url }) => { window.location.href = url },
    onError: (err: Error) => {
      if ((err as { code?: string }).code === 'ALREADY_SUBSCRIBED') {
        toast.info('Your subscription is already active — refreshing your plan status')
        qc.invalidateQueries({ queryKey: ['subscription', orgId] })
      } else {
        toast.error(err.message)
      }
    },
  })
}

export function useOpenBillingPortal(orgId: string) {
  return useMutation({
    mutationFn: async () => unwrap(await openBillingPortal(orgId)),
    onSuccess: ({ url }) => { window.location.href = url },
    onError: (err: Error) => toast.error(err.message),
  })
}
