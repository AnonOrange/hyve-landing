'use client'

import { useState } from 'react'
import type { OwnedTicket } from '@/lib/attend/ticketing/ticket-repository'

const IDLE_STATES = ['ASSIGNED_TO_BUYER', 'TRANSFER_ACCEPTED']
const PENDING_STATES = ['TRANSFER_PENDING_EMAIL', 'TRANSFER_PENDING_FRIEND_CODE']

const humanize = (s: string) =>
  s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/_/g, ' ')
const stateLabel = (s: string) => (s === 'ASSIGNED_TO_BUYER' ? 'Confirmed' : humanize(s))

const inputClass =
  'rounded border border-[#2a2135] bg-[#08070a] px-3 py-2 text-sm text-[#ede8d8] outline-none focus:border-[#E8C456]'
const actionBtn =
  'rounded bg-[#E8C456] px-3 py-1.5 text-xs font-bold text-black transition hover:brightness-110 disabled:opacity-50'
const ghostBtn =
  'rounded border border-[#2a2135] px-3 py-1.5 text-xs font-bold text-[#9e8a55] transition hover:text-[#E8C456] disabled:opacity-50'

export default function WalletTicket({ ticket }: { ticket: OwnedTicket }) {
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<'EMAIL' | 'FRIEND_CODE'>('EMAIL')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const idle = IDLE_STATES.includes(ticket.state)
  const pending = PENDING_STATES.includes(ticket.state)
  const pendingTransfer = ticket.attend_ticket_transfers.find((t) => t.status === 'PENDING')

  async function startTransfer() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/attend/tickets/${ticket.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, toEmail: method === 'EMAIL' ? email : undefined }),
      })
      if (res.ok) {
        // The reloaded wallet shows the pending state (and the friend code).
        window.location.reload()
        return
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? 'Transfer could not be started')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function revoke() {
    if (!pendingTransfer) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/attend/transfers/${pendingTransfer.id}/revoke`, {
        method: 'POST',
      })
      if (res.ok) {
        window.location.reload()
        return
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? 'Revoke failed')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="rounded border border-[#2a2135] px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold">{ticket.attend_ticket_types.name}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#E8C456]">
          {stateLabel(ticket.state)}
        </span>
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      {idle && (
        <div className="mt-2">
          {!open ? (
            <button onClick={() => setOpen(true)} className={ghostBtn}>
              Transfer ticket
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setMethod('EMAIL')}
                  className={method === 'EMAIL' ? actionBtn : ghostBtn}
                >
                  By email
                </button>
                <button
                  onClick={() => setMethod('FRIEND_CODE')}
                  className={method === 'FRIEND_CODE' ? actionBtn : ghostBtn}
                >
                  By friend code
                </button>
              </div>
              {method === 'EMAIL' && (
                <input
                  type="email"
                  placeholder="recipient@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              )}
              <div className="flex gap-2">
                <button
                  onClick={startTransfer}
                  disabled={busy || (method === 'EMAIL' && email.trim().length === 0)}
                  className={actionBtn}
                >
                  {busy ? 'Working…' : 'Send transfer'}
                </button>
                <button onClick={() => setOpen(false)} disabled={busy} className={ghostBtn}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {pending && pendingTransfer && (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-xs text-[#9e8a55]">
            {pendingTransfer.method === 'FRIEND_CODE'
              ? 'Waiting to be claimed with a friend code.'
              : `Waiting for ${pendingTransfer.to_email ?? 'the recipient'} to claim.`}
          </p>
          {pendingTransfer.method === 'FRIEND_CODE' && pendingTransfer.friend_code && (
            <p className="font-mono text-sm font-black text-[#E8C456]">
              {pendingTransfer.friend_code}
            </p>
          )}
          <button onClick={revoke} disabled={busy} className={ghostBtn}>
            {busy ? 'Working…' : 'Revoke transfer'}
          </button>
        </div>
      )}
    </li>
  )
}
