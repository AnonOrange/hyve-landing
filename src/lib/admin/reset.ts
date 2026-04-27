// src/lib/admin/reset.ts
//
// Forgot-password token lifecycle: generate → store → email → use → mark used.

import { Resend } from 'resend'
import { supaGet, supaPost, supaPatch } from '@/lib/supabase'

export interface ResetRow {
  token: string
  admin_id: string
  requested_at: string
  expires_at: string
  used_at: string | null
}

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function createReset(admin_id: string): Promise<string> {
  const token = generateToken()
  const expires_at = new Date(Date.now() + 60 * 60 * 1000).toISOString()  // 1 hour

  const res = await supaPost('admin_password_resets', { token, admin_id, expires_at }, 'return=minimal')
  if (!res.ok) throw new Error(`Failed to create reset token: ${await res.text()}`)
  return token
}

export async function lookupReset(token: string): Promise<ResetRow | null> {
  const res = await supaGet(
    'admin_password_resets',
    `token=eq.${encodeURIComponent(token)}&used_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`,
  )
  if (!res.ok) return null
  const rows = await res.json() as ResetRow[]
  return rows[0] ?? null
}

export async function markResetUsed(token: string): Promise<void> {
  await supaPatch('admin_password_resets', `token=eq.${encodeURIComponent(token)}`, {
    used_at: new Date().toISOString(),
  })
}

export async function sendResetEmail(email: string, token: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  const resend = new Resend(apiKey)
  const link = `https://www.hyveapp.co/admin/reset-password?token=${token}`

  await resend.emails.send({
    from: 'HYVE Admin <admin@hyveapp.co>',
    to: email,
    subject: 'Reset your HYVE admin password',
    html: `
      <p>A password reset was requested for your HYVE admin account.</p>
      <p>Click below to set a new password and PIN. This link expires in 1 hour.</p>
      <p><a href="${link}">${link}</a></p>
      <p>If you didn't request this, your account is still secure — ignore this email.</p>
    `,
  })
}
