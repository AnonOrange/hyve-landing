import { NextRequest, NextResponse } from 'next/server'

// Free-tier signup — no Stripe checkout, ad-supported access.
//
// Creates a Supabase Auth user (so the email/password flow on the regular
// sign-in route works for them later if they upgrade), then sets the
// `hyve_spy_session` cookie with a `free:<userId>` prefix.
//
// verify-session reads that prefix and reports tier='free' / active=true,
// which the spy app uses to:
//   1. Let the user past the middleware gate
//   2. Render <AdSlot /> components throughout the app (they only render
//      when hyve_spy_tier === 'free')
//   3. Hide Pro features (Sleuth, Residential, Intel hub, Globe) behind
//      upgrade prompts — same enforcement basic users see for Pro features
//
// Mobile app is unaffected: only web hyveapp.co exposes this endpoint via
// the /spy sign-up form. Mobile users still must subscribe to use the app.

const ONE_YEAR = 60 * 60 * 24 * 365

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'password_too_short', hint: 'min 8 characters' }, { status: 400 })
  }

  const supaUrl = process.env.SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY
  if (!supaUrl || !anon) {
    return NextResponse.json({ error: 'auth_not_configured' }, { status: 503 })
  }

  // Step 1: create the user via Supabase Auth signup. This is the same
  // path the regular sign-in route uses to authenticate, so a free user
  // who later upgrades through Stripe just changes their session cookie
  // value — the underlying account stays the same.
  const signupRes = await fetch(`${supaUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
    },
    body: JSON.stringify({
      email,
      password,
      data: { tier: 'free' }, // user_metadata, useful for analytics later
    }),
  })

  if (!signupRes.ok) {
    const j = await signupRes.json().catch(() => ({}))
    // Common errors: already_registered (user exists), weak_password
    return NextResponse.json(
      { error: j.error_code || j.msg || 'signup_failed', detail: j.error_description || null },
      { status: 400 },
    )
  }

  const data = await signupRes.json()
  const userId: string = data?.user?.id || data?.id || ''
  if (!userId) {
    return NextResponse.json({ error: 'no_user_id_returned' }, { status: 502 })
  }

  // Step 2: set the session cookie with the `free:` prefix. verify-session
  // recognizes this as an active free-tier session.
  const sessionValue = `free:${userId}`
  const res = NextResponse.json({ ok: true, email, tier: 'free' })
  res.cookies.set('hyve_spy_session', sessionValue, {
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
    path: '/',
    domain: '.hyveapp.co',
    maxAge: ONE_YEAR,
  })
  // Also pre-set the tier cookie so the AdSlot components and Pro feature
  // gates know the user's tier on first paint, before verify-session runs.
  res.cookies.set('hyve_spy_tier', 'free', {
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
    path: '/',
    domain: '.hyveapp.co',
    maxAge: ONE_YEAR,
  })
  return res
}

export const dynamic = 'force-dynamic'
