import { NextRequest, NextResponse } from 'next/server'
import { lookupSession } from '@/lib/admin/session'

// Brand-alias domain that should masquerade as the /attend section of the
// umbrella. Lives at the top of middleware so it short-circuits before any
// /spy or /admin work.
const ATTEND_ALIAS_HOSTS = new Set(['hyveattend.com', 'www.hyveattend.com'])

// Public admin pages that don't require a session
const ADMIN_PUBLIC = new Set([
  '/admin/login',
  '/admin/forgot-password',
  '/admin/reset-password',
  '/admin/accept-invite',
])

// ── Per-tier route allowlists for /spy/app/* ────────────────────────────────
// FREE tier: scanner + cameras only — same scope as the AdSense-supported
// signup. Other features show an upgrade gate at /spy/app/upgrade.
const FREE_ALLOWED_PREFIXES = [
  '/spy/app/cameras',     // US camera grid
  '/spy/app/world-cams',  // worldwide cameras
  '/spy/app/feeds',       // scanner feed list
  '/spy/app/feed/',       // /feed/[id] detail
  '/spy/app/account',     // account/settings (so they can manage)
  '/spy/app/sentinel',    // one-shot audits — paid separately
  '/spy/app/upgrade',     // the upgrade screen itself
]
const FREE_ALLOWED_EXACT = new Set([
  '/spy/app',             // map landing
  '/spy/app/',
  '/spy/app/manifest.json',
  '/spy/app/sw.js',
  '/spy/app/settings',    // settings webview
])

// PRO-ONLY routes: even basic users hit the upgrade gate here.
const PRO_ONLY_PREFIXES = [
  '/spy/app/sleuth',
  '/spy/app/residential',
  '/spy/app/intel',
  '/spy/app/surveillance',
  '/spy/app/offenders',
  '/spy/app/world',       // Pro-only worldwide map (NOT world-cams which is open)
]

function readTier(req: NextRequest): 'pro' | 'basic' | 'free' | null {
  const t = req.cookies.get('hyve_spy_tier')?.value
  if (t === 'pro' || t === 'basic' || t === 'free') return t
  return null
}

function isAllowedForFree(pathname: string): boolean {
  if (FREE_ALLOWED_EXACT.has(pathname)) return true
  for (const prefix of FREE_ALLOWED_PREFIXES) {
    if (pathname.startsWith(prefix)) return true
  }
  return false
}

function isProOnly(pathname: string): boolean {
  for (const prefix of PRO_ONLY_PREFIXES) {
    if (pathname.startsWith(prefix)) return true
  }
  return false
}

function redirectToUpgrade(req: NextRequest, requiredTier: 'basic' | 'pro'): NextResponse {
  const url = req.nextUrl.clone()
  url.pathname = '/spy/app/upgrade'
  url.search = `?tier=${requiredTier}&from=${encodeURIComponent(req.nextUrl.pathname)}`
  return NextResponse.redirect(url, 302)
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  // ── hyveattend.com host masking ───────────────────────────────────────────
  // When a request comes in on hyveattend.com (or www.), rewrite the path
  // into /attend/* so the browser URL stays at hyveattend.com but the
  // content served is the Attend section of the umbrella. Skip paths that
  // already start with /attend, /_next, or /api so we don't re-rewrite or
  // touch framework + API routes.
  const host = (req.headers.get('host') ?? '').toLowerCase().split(':')[0]
  if (ATTEND_ALIAS_HOSTS.has(host)) {
    const skip =
      pathname.startsWith('/attend') ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api/')
    if (!skip) {
      const url = req.nextUrl.clone()
      url.pathname = pathname === '/' ? '/attend' : `/attend${pathname}`
      return NextResponse.rewrite(url)
    }
    return NextResponse.next()
  }

  // ── Spy PWA gate (/spy/app/*) ─────────────────────────────────────────────
  if (pathname.startsWith('/spy/app')) {
    if (pathname === '/spy/app/manifest.json') return NextResponse.next()
    if (pathname === '/spy/app/sw.js') return NextResponse.next()

    // Step 1: must have a session at all
    const hasSession = req.cookies.has('hyve_spy_session')
    if (!hasSession) {
      const next = encodeURIComponent(pathname + (search || ''))
      const url = req.nextUrl.clone()
      url.pathname = '/spy'
      url.search = `?next=${next}`
      url.hash = 'pricing'
      return NextResponse.redirect(url, 302)
    }

    // Step 2: tier-based feature gate. Reads hyve_spy_tier cookie set by
    // /api/spy/verify-session. The upgrade page itself is always reachable
    // (it's in FREE_ALLOWED_PREFIXES).
    const tier = readTier(req)

    // Pro-only routes — basic + free both blocked, only pro/comp pass.
    if (isProOnly(pathname) && tier !== 'pro') {
      return redirectToUpgrade(req, 'pro')
    }

    // Free tier is restricted to scanner + cameras + account + sentinel.
    // Everything else requires basic or higher.
    if (tier === 'free' && !isAllowedForFree(pathname)) {
      return redirectToUpgrade(req, 'basic')
    }

    return NextResponse.next()
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
  // The first two matchers serve the spy + admin gates. The third is
  // broad — it has to be, because we need the middleware to see requests
  // to / on hyveattend.com so we can rewrite them. The function itself
  // short-circuits on non-matching hosts so the umbrella domain pays
  // essentially zero cost.
  matcher: [
    '/spy/app/:path*',
    '/admin/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
