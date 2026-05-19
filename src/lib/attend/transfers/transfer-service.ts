// HYVE Attend ticket transfers: open a transfer (email or friend code),
// revoke a pending one, and claim a transfer as the recipient. The
// ownership-critical writes are the attend_create/claim/revoke_transfer RPCs.
import { Resend } from 'resend'
import { friendCode, claimToken } from '@/lib/attend/transfers/transfer-codes'
import { ValidationError } from '@/lib/attend/events/service'
import { supaPost } from '@/lib/supabase'

const TRANSFER_TTL_DAYS = 7

interface RpcResult {
  ok?: boolean
  error?: string
}

// Run a transfer RPC: a structured { ok: false } becomes a ValidationError
// (HTTP 400); a transport/HTTP failure becomes a generic Error (HTTP 500).
async function callTransferRpc(
  fn: string,
  p_args: Record<string, unknown>,
): Promise<RpcResult> {
  const res = await supaPost(`rpc/${fn}`, { p_args })
  if (!res.ok) {
    throw new Error(`${fn} RPC failed: ${res.status} ${await res.text()}`)
  }
  const result = (await res.json()) as RpcResult
  if (result.ok === false) {
    throw new ValidationError(result.error ?? 'That action could not be completed')
  }
  return result
}

export async function initiateTransfer(
  ticketId: string,
  fromProfileId: string,
  method: 'EMAIL' | 'FRIEND_CODE',
  toEmail: string | null,
  origin: string,
): Promise<{ friendCode?: string }> {
  const expiresAt = new Date(Date.now() + TRANSFER_TTL_DAYS * 86_400_000).toISOString()
  const token = method === 'EMAIL' ? claimToken() : null
  const code = method === 'FRIEND_CODE' ? friendCode() : null

  let recipientEmail: string | null = null
  if (method === 'EMAIL') {
    recipientEmail = toEmail?.trim() || null
    if (!recipientEmail) throw new ValidationError('A recipient email address is required')
    if (!process.env.RESEND_API_KEY) {
      throw new ValidationError('Email transfers are not available right now.')
    }
  }

  await callTransferRpc('attend_create_transfer', {
    ticket_id: ticketId,
    from_profile_id: fromProfileId,
    method,
    to_email: recipientEmail,
    claim_token: token,
    friend_code: code,
    expires_at: expiresAt,
  })

  // Email method: send the claim link. A send failure throws (the transfer
  // row exists, so the sender can revoke and retry from the wallet).
  if (method === 'EMAIL' && token && recipientEmail) {
    await sendClaimEmail(recipientEmail, `${origin}/attend/claim?token=${token}`)
    return {}
  }
  return { friendCode: code ?? undefined }
}

async function sendClaimEmail(to: string, claimUrl: string): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: 'HYVE Attend <onboarding@resend.dev>',
    to,
    subject: 'You have been sent a HYVE Attend ticket',
    html:
      `<p>Someone sent you a ticket on HYVE Attend.</p>` +
      `<p><a href="${claimUrl}">Claim your ticket</a></p>` +
      `<p>This link expires in ${TRANSFER_TTL_DAYS} days.</p>`,
  })
}

export async function revokeTransfer(transferId: string, actorId: string): Promise<void> {
  await callTransferRpc('attend_revoke_transfer', {
    transfer_id: transferId,
    actor_id: actorId,
  })
}

export async function claimTransfer(
  by: { claimToken?: string; friendCode?: string },
  recipientId: string,
): Promise<void> {
  await callTransferRpc('attend_claim_transfer', {
    claim_token: by.claimToken ?? null,
    friend_code: by.friendCode ?? null,
    recipient_id: recipientId,
  })
}
