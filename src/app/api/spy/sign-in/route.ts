import { NextRequest, NextResponse } from 'next/server'

// Same allowlist as hyve-spy-accounts/src/lib/compAccess.ts. Update both when adding.
const COMP_EMAILS = new Set([
  'vibesoftwaresolutions@gmail.com',
])

const ONE_YEAR = 60 * 60 * 24 * 365

/**
 * Same-origin password sign-in. Calls Supabase Auth directly with the anon key
 * and sets the `hyve_spy_session` cookie on `.hyveapp.co` so the PWA middleware
 * recognizes the user. We don't try to mirror the full hyve-spy-accounts JWT
 * cookie here — that lives on the accounts subdomain for cross-device sync;
 * this endpoint's only job is letting users into /spy/app from www.hyveapp.co.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')

  if (!email || !password) {
    return NextResponse.json({ error: 'email_and_password_required' }, { status: 400 })
  }

  const supaUrl = process.env.SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY
  if (!supaUrl || !anon) {
    return NextResponse.json({ error: 'auth_not_configured' }, { status: 503 })
  }

  const r = await fetch(`${supaUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
    },
    body: JSON.stringify({ email, password }),
  })

  if (!r.ok) {
    const j = await r.json().catch(() => ({}))
    return NextResponse.json(
      { error: j.error_description || j.msg || 'invalid_credentials' },
      { status: 401 },
    )
  }

  const data = await r.json()
  const userEmail: string = data?.user?.email || email

  const sessionValue = COMP_EMAILS.has(userEmail.toLowerCase())
    ? `comp:${userEmail.toLowerCase()}`
    : `auth:${data?.user?.id || ''}` // non-comp authed users still need a Stripe session for paid access

  const res = NextResponse.json({ ok: true, email: userEmail })
  res.cookies.set('hyve_spy_session', sessionValue, {
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
    path: '/',
    domain: '.hyveapp.co',
    maxAge: ONE_YEAR,
  })
  return res
}
