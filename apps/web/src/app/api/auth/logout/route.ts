import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.API_INTERNAL_URL ?? 'http://api:3002'
const COOKIE_NAME = 'auth_token'

export async function POST() {
  await fetch(`${BACKEND_URL}/api/v1/auth/logout`, { method: 'POST' }).catch(() => {})
  const response = NextResponse.json({ success: true, data: null })
  response.cookies.delete(COOKIE_NAME)
  return response
}
