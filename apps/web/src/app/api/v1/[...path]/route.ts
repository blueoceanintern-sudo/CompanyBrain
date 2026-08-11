import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.API_INTERNAL_URL ?? 'http://api:3002'

async function proxy(request: NextRequest, path: string[]) {
  const url = `${BACKEND_URL}/api/v1/${path.join('/')}${request.nextUrl.search}`

  const headers = new Headers()
  const contentType = request.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)
  const cookie = request.headers.get('cookie')
  if (cookie) headers.set('cookie', cookie)

  const body =
    request.method !== 'GET' && request.method !== 'HEAD'
      ? await request.arrayBuffer()
      : undefined

  try {
    const res = await fetch(url, {
      method: request.method,
      headers,
      ...(body ? { body } : {}),
    })

    const responseHeaders = new Headers()
    // File downloads depend on more than content-type: the disposition decides
    // download-vs-inline, and the two security headers are what keep an
    // uploaded file from rendering as markup on this origin.
    for (const header of [
      'content-type',
      'content-disposition',
      'content-length',
      'content-security-policy',
      'x-content-type-options',
      'cache-control',
    ]) {
      const value = res.headers.get(header)
      if (value) responseHeaders.set(header, value)
    }
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) responseHeaders.set('set-cookie', setCookie)

    return new NextResponse(res.body, { status: res.status, headers: responseHeaders })
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'NETWORK_ERROR', message: 'Could not reach the server.' } },
      { status: 503 }
    )
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return proxy(request, path)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return proxy(request, path)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return proxy(request, path)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return proxy(request, path)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return proxy(request, path)
}
