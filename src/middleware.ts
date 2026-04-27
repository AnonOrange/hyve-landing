import { NextRequest, NextResponse } from 'next/server'
import { lookupSession } from '@/lib/admin/session'

// Public admin pages that don't require a session
const ADMIN_PUBLIC = new Set([
  '/admin/login',
  '/admin/forgot-password',
  '/admin/reset-password',
  '/admin/accept-invite',
])

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  // ── Spy PWA gate (/spy/app/*) ─────────────────────────────────────────────
  if (pathname.startsWith('/spy/app')) {
    if (pathname === '/spy/app/manifest.json') return NextResponse.next()
    if (pathname === '/spy/app/sw.js') return NextResponse.next()

    const hasSession = req.cookies.has('hyve_spy_session')
    if (hasSession) return NextResponse.next()

    const next = encodeURIComponent(pathname + (search || ''))
    const url = req.nextUrl.clone()
    url.pathname = '/spy'
    url.search = `?next=${next}`
    url.hash = 'pricing'
    return NextResponse.redirect(url, 302)
  }

  // ── Admin dashboard gate (/admin/*) ───────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (ADMIN_PUBLIC.has(pathname)) return NextResponse.next()

    const sessionId = req.cookies.get('__Host-admin_session')?.value
    if (!sessionId) return redirectToLogin(req)

    const session = await lookupSession(sessionId).catch(() => null)
    if (!session) return redirectToLogin(req)

    // Slide the TTL on every authenticated request
    // (full refresh happens async in the route; middleware just validates)
    return NextResponse.next()
  }

  return NextResponse.next()
}

function redirectToLogin(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone()
  url.pathname = '/admin/login'
  url.search = ''
  return NextResponse.redirect(url, 302)
}

export const config = {
  matcher: ['/spy/app/:path*', '/admin/:path*'],
}
