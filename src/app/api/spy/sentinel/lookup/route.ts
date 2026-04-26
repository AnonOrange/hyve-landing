import { NextRequest, NextResponse } from 'next/server'

const SUPA_URL = process.env.SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY!
const RESEND_KEY = process.env.RESEND_API_KEY

// Lookup any audits associated with the email + send recovery email.
// We always return the same generic success message regardless of whether the
// email has audits — prevents email enumeration.
export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}))
  const e = (email || '').toString().toLowerCase().trim()
  if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
    return NextResponse.json({ error: 'valid email required' }, { status: 400 })
  }

  const auditsRes = await fetch(
    `${SUPA_URL}/rest/v1/sentinel_audits?user_email=eq.${encodeURIComponent(e)}&order=created_at.desc&select=id,tier,scope_type,status,created_at,stripe_session_id`,
    { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } },
  )
  const audits = await auditsRes.json()

  if (audits.length > 0 && RESEND_KEY) {
    const list = audits.map((a: any) => {
      const product = a.scope_type === 'pentest' ? 'Scout Pen-Test' : 'Sentinel Camera Audit'
      const date = new Date(a.created_at).toLocaleString()
      const url = a.status === 'complete'
        ? `https://www.hyveapp.co/spy/app/sentinel/report/${a.id}`
        : `https://www.hyveapp.co/spy/app/sentinel/setup?session=${a.stripe_session_id}`
      return `<li><strong>${product}</strong> (${a.tier}) — ${date}<br><a href="${url}">${url}</a> · status: ${a.status}</li>`
    }).join('')

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Hyve Sentinel <sentinel@hyveapp.co>',
        to: e,
        subject: `Your Hyve Sentinel audits (${audits.length})`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0F172A">
            <h1 style="font-size:20px;margin:0 0 16px">Your audits</h1>
            <p style="font-size:14px;color:#475569">Here are all the audits associated with this email address:</p>
            <ul style="font-size:13px;line-height:1.8">${list}</ul>
            <p style="font-size:12px;color:#94A3B8;margin-top:32px;border-top:1px solid #E2E8F0;padding-top:16px">
              Audits are retained for 90 days from purchase. Email <a href="mailto:support@hyveapp.co">support@hyveapp.co</a> with questions.
            </p>
          </div>
        `,
      }),
    }).catch(() => null)
  }

  // Always return the same message regardless of whether audits exist
  return NextResponse.json({
    message: `If we have audits for ${e}, we've emailed the recovery URLs. Check your inbox in a few minutes.`,
  })
}

export const dynamic = 'force-dynamic'
