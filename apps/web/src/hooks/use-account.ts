'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { changePassword, unwrap } from '@/lib/api'
import { clearAuth } from '@/lib/auth'

export function useChangePassword(orgId: string) {
  const router = useRouter()

  return useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) =>
      unwrap(await changePassword(orgId, data.currentPassword, data.newPassword)),
    onSuccess: async () => {
      toast.success('Password updated — sign in with your new password.')
      clearAuth()
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
      router.replace('/login')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
