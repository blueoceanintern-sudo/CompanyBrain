import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.API_INTERNAL_URL ?? 'http://api:3002'
const COOKIE_NAME = 'auth_token'

export async function POST(request: Request) {
  const cookieHeader = request.headers.get('cookie') ?? ''

  try {
    await fetch(`${BACKEND_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    })
  } catch {
    // Even if the backend call fails, still clear the local cookie below.
  }

  const response = NextResponse.json({ success: true, data: null })
  response.cookies.delete(COOKIE_NAME)
  return response
}
