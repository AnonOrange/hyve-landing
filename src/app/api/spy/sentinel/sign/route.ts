import { NextRequest, NextResponse } from 'next/server'

const SUPA_URL = process.env.SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY!

// User submits the authorization agreement. We capture name + IP + UA + timestamp
// to the sentinel_audits row — these together are the legal record that they
// authorized us to scan their listed assets.
export async function POST(req: NextRequest) {
  const { auditId, signedName } = await req.json().catch(() => ({}))
  if (!auditId || !signedName?.trim()) {
    return NextResponse.json({ error: 'auditId + signedName required' }, { status: 400 })
  }
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
  const ua = req.headers.get('user-agent') || 'unknown'

  const r = await fetch(`${SUPA_URL}/rest/v1/sentinel_audits?id=eq.${encodeURIComponent(auditId)}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      agreement_signed_at: new Date().toISOString(),
      agreement_signed_name: signedName.trim().slice(0, 100),
      agreement_signed_ip: ip,
      agreement_signed_ua: ua.slice(0, 250),
    }),
  })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'
