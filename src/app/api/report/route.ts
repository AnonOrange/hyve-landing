import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

// The address all beta reports are delivered to
const RECIPIENT = 'vibesoftwaresolutions@gmail.com'

export async function POST(req: NextRequest) {
  try {
    // Lazily initialize so missing key doesn't crash at build time
    if (!process.env.RESEND_API_KEY) {
      console.error('[/api/report] RESEND_API_KEY not set')
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
    }
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { name, email, category, message } = await req.json()

    // Basic validation
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const emailHtml = `
      <div style="font-family: Inter, sans-serif; background: #0D0D0D; color: #fff; padding: 32px; border-radius: 12px; max-width: 600px;">
        <div style="border-bottom: 1px solid rgba(255,184,0,0.2); padding-bottom: 16px; margin-bottom: 24px;">
          <h2 style="margin:0; color: #FFB800; font-size: 20px;">
            ⬡ HYVE Beta Report
          </h2>
          <p style="margin: 6px 0 0; color: rgba(255,255,255,0.4); font-size: 13px;">
            ${new Date().toUTCString()}
          </p>
        </div>

        <table style="width:100%; border-collapse:collapse; font-size:14px; margin-bottom:24px;">
          <tr>
            <td style="padding: 8px 12px; color: rgba(255,255,255,0.4); width: 120px;">Category</td>
            <td style="padding: 8px 12px; color: #FFB800; font-weight: 600;">${escHtml(category)}</td>
          </tr>
          <tr style="background: rgba(255,255,255,0.03);">
            <td style="padding: 8px 12px; color: rgba(255,255,255,0.4);">Name</td>
            <td style="padding: 8px 12px; color: #fff;">${escHtml(name)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; color: rgba(255,255,255,0.4);">Email</td>
            <td style="padding: 8px 12px; color: #fff;">
              <a href="mailto:${escHtml(email)}" style="color:#FFB800;">${escHtml(email)}</a>
            </td>
          </tr>
        </table>

        <div style="background: rgba(255,255,255,0.04); border-radius: 8px; border: 1px solid rgba(255,184,0,0.1); padding: 16px; font-size: 14px; color: rgba(255,255,255,0.8); line-height: 1.7; white-space: pre-wrap;">
${escHtml(message)}
        </div>

        <p style="margin-top: 24px; font-size: 11px; color: rgba(255,255,255,0.2);">
          Sent via HYVE Beta feedback form — hyveapp.co
        </p>
      </div>
    `

    await resend.emails.send({
      // NOTE: Once you verify hyveapp.co on Resend, change this to: 'HYVE Beta <no-reply@hyveapp.co>'
      from: 'HYVE Beta Reports <onboarding@resend.dev>',
      to: RECIPIENT,
      reply_to: email,
      subject: `[HYVE Beta] ${category} — from ${name}`,
      html: emailHtml,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[/api/report]', err)
    return NextResponse.json({ error: 'Failed to send report' }, { status: 500 })
  }
}

/** Minimal HTML escaping to prevent injection in email body */
function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
