import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.API_INTERNAL_URL ?? 'http://api:3002'
const COOKIE_NAME = 'auth_token'
const COOKIE_MAX_AGE = 8 * 60 * 60

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid request body' } },
      { status: 400 }
    )
  }

  let apiRes: Response
  try {
    apiRes = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'NETWORK_ERROR', message: 'Could not reach the server.' } },
      { status: 503 }
    )
  }

  let data: unknown
  try {
    data = await apiRes.json()
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'UPSTREAM_ERROR', message: 'Unexpected response from server.' } },
      { status: 502 }
    )
  }
  const response = NextResponse.json(data, { status: apiRes.status })

  if (data && typeof data === 'object' && 'success' in data && (data as { success: boolean }).success) {
    // Extract JWT from the API's Set-Cookie and re-set it on the web domain
    // so Next.js middleware can read it on localhost:3000
    const cookieHeader = apiRes.headers.get('set-cookie') ?? ''
    const match = cookieHeader.match(/auth_token=([^;]+)/)
    if (match?.[1]) {
      response.cookies.set(COOKIE_NAME, match[1], {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: COOKIE_MAX_AGE,
        secure: process.env.NODE_ENV === 'production',
      })
    }
  }

  return response
}
