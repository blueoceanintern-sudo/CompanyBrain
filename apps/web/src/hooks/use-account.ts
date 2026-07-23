'use client'

import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { changePassword, unwrap } from '@/lib/api'

export function useChangePassword(orgId: string) {
  return useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) =>
      unwrap(await changePassword(orgId, data.currentPassword, data.newPassword)),
    onSuccess: () => toast.success('Password updated'),
    onError: (err: Error) => toast.error(err.message),
  })
}
