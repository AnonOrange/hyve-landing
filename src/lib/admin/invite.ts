// src/lib/admin/invite.ts
//
// Invite token lifecycle: generate → store → email → accept → mark used.

import { Resend } from 'resend'
import { supaGet, supaPost, supaPatch } from '@/lib/supabase'

export interface InviteRow {
  token: string
  email: string
  role: 'owner' | 'admin'
  invited_by: string
  invited_at: string
  expires_at: string
  used_at: string | null
}

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function createInvite(params: {
  email: string
  role: 'owner' | 'admin'
  invited_by: string
}): Promise<InviteRow> {
  const token = generateToken()
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const res = await supaPost('admin_invites', {
    token,
    email: params.email,
    role: params.role,
    invited_by: params.invited_by,
    expires_at,
  })
  if (!res.ok) throw new Error(`Failed to create invite: ${await res.text()}`)
  const rows = await res.json() as InviteRow[]
  return rows[0]
}

export async function lookupInvite(token: string): Promise<InviteRow | null> {
  const res = await supaGet(
    'admin_invites',
    `token=eq.${encodeURIComponent(token)}&used_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`,
  )
  if (!res.ok) return null
  const rows = await res.json() as InviteRow[]
  return rows[0] ?? null
}

export async function markInviteUsed(token: string): Promise<void> {
  await supaPatch('admin_invites', `token=eq.${encodeURIComponent(token)}`, {
    used_at: new Date().toISOString(),
  })
}

export async function sendInviteEmail(email: string, token: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  const resend = new Resend(apiKey)
  const link = `https://www.hyveapp.co/admin/accept-invite?token=${token}`

  await resend.emails.send({
    from: 'HYVE Admin <admin@hyveapp.co>',
    to: email,
    subject: "You've been invited to admin hyveapp.co",
    html: `
      <p>You've been invited to access the HYVE admin dashboard.</p>
      <p>Click below to set your password and activate your account. This link expires in 7 days.</p>
      <p><a href="${link}">${link}</a></p>
      <p>If you didn't expect this, ignore this email.</p>
    `,
  })
}
