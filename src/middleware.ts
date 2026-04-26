import { NextRequest, NextResponse } from 'next/server'

/**
 * Hyve Spy PWA gate.
 *
 * Any request to /spy/app/* must carry a `hyve_spy_session` cookie (the Stripe
 * checkout session id captured on /spy/welcome). If the cookie is missing the
 * user is redirected to /spy?next=/spy/app#pricing so they sign up first.
 *
 * Per-request liveness (cancelled / expired subs) is verified by
 * /api/spy/verify-session, which the PWA root page calls on mount.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  if (!pathname.startsWith('/spy/app')) return NextResponse.next()

  // PWA manifest must be publicly readable so iOS / Android can install the app
  // before the user has signed up.
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

export const config = {
  matcher: ['/spy/app/:path*'],
}
