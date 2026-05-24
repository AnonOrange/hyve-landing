'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { EventRow } from '@/lib/attend/events/repository'
import type { TicketTypeRow } from '@/lib/attend/ticketing/ticket-type-repository'
import type { StreamRow } from '@/lib/attend/streaming/stream-repository'
import { ATTEND_BETA_MODE } from '@/lib/attend/config'
import SetupProgress from './setup-progress'
import EventDetailsPanel from './event-details-panel'
import TicketTypesPanel from './ticket-types-panel'

const actionBtn =
  'self-start rounded bg-[#E8C456] px-4 py-2 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-50'

// The per-event creator dashboard: setup progress, the status-contextual next
// step, and the editable event-details + ticket-types panels.
export default function EventDashboardClient({
  event,
  ticketTypes,
  payoutsEnabled,
  stream,
  freeRegistrationsRemaining,
  venues,
}: {
  event: EventRow
  ticketTypes: TicketTypeRow[]
  payoutsEnabled: boolean
  stream: StreamRow | null
  freeRegistrationsRemaining: number
  venues: { id: string; name: string }[]
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editable = event.status === 'DRAFT'

  // PATCH a guarded lifecycle action, then reload to show the new state.
  async function patchAction(action: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/attend/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        window.location.reload()
        return
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? 'That step could not be completed')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  // POST to an endpoint that returns either { url } (Stripe Checkout / Connect)
  // for a redirect, or { ok, ... } for an in-place success that should reload
  // the dashboard so the new state is visible. The free-registration path
  // returns the second shape.
  async function redirectTo(endpoint: string, failMsg: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(endpoint, { method: 'POST' })
      const data = (await res.json().catch(() => ({}))) as {
        url?: string
        ok?: boolean
        error?: string
      }
      if (data.url) {
        window.location.href = data.url
        return
      }
      if (data.ok) {
        window.location.reload()
        return
      }
      setError(data.error ?? failMsg)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  // POST to provision the event's Mux stream, then reload.
  async function createStream() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/attend/events/${event.id}/stream`, { method: 'POST' })
      if (res.ok) {
        window.location.reload()
        return
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? 'Stream setup could not be completed')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  // Link (or clear) the event's 3D venue, then reload.
  async function setVenue(venueId: string | null) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/attend/events/${event.id}/venue`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId }),
      })
      if (res.ok) {
        window.location.reload()
        return
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? 'Could not set the venue')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  function nextStep() {
    const wrap = (heading: string, body: string, button: React.ReactNode) => (
      <section className="rounded border border-[#2a2135] bg-[#111111] px-4 py-4">
        <h2 className="text-xs font-black tracking-[0.2em] text-[#E8C456]">NEXT STEP</h2>
        <p className="mt-2 text-sm font-bold">{heading}</p>
        <p className="mt-1 text-xs text-[#9e8a55]">{body}</p>
        <div className="mt-3 flex">{button}</div>
      </section>
    )

    switch (event.status) {
      case 'DRAFT':
        return wrap(
          'Finish your draft',
          'Add at least one ticket type and confirm your event details, then start setup.',
          <button onClick={() => patchAction('start-setup')} disabled={busy} className={actionBtn}>
            {busy ? 'Working…' : 'Start setup'}
          </button>,
        )
      case 'REGISTRATION_PENDING': {
        // Three-way branch matches the API route: beta > welcome offer > paid.
        const beta = ATTEND_BETA_MODE
        const free = !beta && freeRegistrationsRemaining > 0
        const ordinal = freeRegistrationsRemaining === 2 ? '1st' : '2nd'
        const title = beta
          ? 'Register your show (free during beta)'
          : free
            ? 'Promote your show (free)'
            : 'Pay the registration fee'
        const body = beta
          ? 'HYVE Attend is in beta — everything is free right now. No $50 fee and a 0% platform fee, so you keep 100% of ticket sales (only the card processor’s fee applies). The HYVE fees start at full launch.'
          : free
            ? `Your ${ordinal} show is on the house — registration opens its promotion campaign at no charge. Platform percentages on ticket sales still apply.`
            : 'A one-time $50 fee registers your show and opens its promotion campaign.'
        const label = busy
          ? beta || free
            ? 'Registering…'
            : 'Opening…'
          : beta
            ? 'Register (free during beta)'
            : free
              ? `Promote (${ordinal} free)`
              : 'Pay $50 registration'
        const failMsg = beta
          ? 'Failed to register your show'
          : free
            ? 'Failed to register your free show'
            : 'Failed to start the registration checkout'
        return wrap(
          title,
          body,
          <button
            onClick={() => redirectTo(`/api/attend/events/${event.id}/pay-registration`, failMsg)}
            disabled={busy}
            className={actionBtn}
          >
            {label}
          </button>,
        )
      }
      case 'PROMOTION_FEE_PAID':
        return wrap(
          'Continue setup',
          'Your registration fee is paid. Continue to payout setup.',
          <button onClick={() => patchAction('advance-setup')} disabled={busy} className={actionBtn}>
            {busy ? 'Working…' : 'Advance setup'}
          </button>,
        )
      case 'PAYOUT_SETUP_REQUIRED':
        return payoutsEnabled
          ? wrap(
              'Continue setup',
              'Payouts are connected. Continue to stream setup.',
              <button
                onClick={() => patchAction('advance-setup')}
                disabled={busy}
                className={actionBtn}
              >
                {busy ? 'Working…' : 'Advance setup'}
              </button>,
            )
          : wrap(
              'Connect payouts',
              'Set up Stripe Connect so you can receive your ticket revenue.',
              <button
                onClick={() => redirectTo('/api/attend/connect/onboard', 'Failed to start onboarding')}
                disabled={busy}
                className={actionBtn}
              >
                {busy ? 'Opening…' : 'Connect payouts'}
              </button>,
            )
      case 'STREAM_SETUP_REQUIRED': {
        if (!stream) {
          return wrap(
            'Set up your live stream',
            'Create your Mux live stream to get an RTMP ingest URL and key for your broadcast software.',
            <button onClick={createStream} disabled={busy} className={actionBtn}>
              {busy ? 'Creating…' : 'Create stream'}
            </button>,
          )
        }
        const tested = stream.test_passed_at != null
        return (
          <section className="rounded border border-[#2a2135] bg-[#111111] px-4 py-4">
            <h2 className="text-xs font-black tracking-[0.2em] text-[#E8C456]">NEXT STEP</h2>
            <p className="mt-2 text-sm font-bold">
              {tested ? 'Submit for review' : 'Test your live stream'}
            </p>
            <p className="mt-1 text-xs text-[#9e8a55]">
              {tested
                ? 'Your stream test passed. Submit the event for review.'
                : 'Point your broadcast software at the ingest below and go live once, then reload this page.'}
            </p>
            <dl className="mt-3 flex flex-col gap-2">
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-[#9e8a55]">
                  RTMP ingest URL
                </dt>
                <dd className="break-all font-mono text-xs text-[#ede8d8]">{stream.rtmp_url}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-[#9e8a55]">
                  Stream key — keep secret
                </dt>
                <dd className="mt-0.5 break-all rounded border border-[#2a2135] bg-[#08070a] px-2 py-1 font-mono text-xs text-[#ede8d8]">
                  {stream.stream_key}
                </dd>
              </div>
            </dl>
            <p className="mt-3 font-mono text-[10px] tracking-widest text-[#9e8a55]">
              STREAM TEST:{' '}
              <span className={tested ? 'text-[#39FF14]' : 'text-[#9e8a55]'}>
                {tested ? 'PASSED ✓' : 'NOT YET RUN'}
              </span>
            </p>
            <div className="mt-3 flex">
              <button
                onClick={() => patchAction('submit-for-review')}
                disabled={busy || !tested}
                className={actionBtn}
              >
                {busy ? 'Working…' : 'Submit for review'}
              </button>
            </div>
          </section>
        )
      }
      case 'SUBMITTED_FOR_REVIEW':
        return wrap(
          'Submitted for review',
          'An Attend reviewer is checking your event. Once it is approved you can put tickets on sale.',
          <button disabled className={actionBtn}>
            Awaiting review
          </button>,
        )
      case 'PUBLISHED':
        return wrap(
          'Approved — ready to sell',
          'Your event has been approved. Put tickets on sale when you are ready.',
          <button onClick={() => patchAction('open-sales')} disabled={busy} className={actionBtn}>
            {busy ? 'Working…' : 'Put tickets on sale'}
          </button>,
        )
      case 'ON_SALE':
      case 'SALES_PAUSED':
        return wrap(
          'Show day',
          'When you are ready to begin, start the show-day soundcheck.',
          <button onClick={() => patchAction('start-soundcheck')} disabled={busy} className={actionBtn}>
            {busy ? 'Working…' : 'Start soundcheck'}
          </button>,
        )
      case 'SOUNDCHECK':
        return wrap(
          'Soundcheck',
          'Open the doors when you are ready to let ticket-holders into the room.',
          <button onClick={() => patchAction('open-doors')} disabled={busy} className={actionBtn}>
            {busy ? 'Working…' : 'Open the doors'}
          </button>,
        )
      case 'DOORS_OPEN':
        return wrap(
          'Doors are open',
          'Ticket-holders can enter the room. Go live in your broadcast software — the show moves to LIVE automatically once Mux detects your stream.',
          <button disabled className={actionBtn}>
            Waiting for your stream…
          </button>,
        )
      case 'LIVE':
        return wrap(
          'You are live',
          'Your show is broadcasting. End the show when the performance is over.',
          <button onClick={() => patchAction('end-show')} disabled={busy} className={actionBtn}>
            {busy ? 'Working…' : 'End the show'}
          </button>,
        )
      default:
        return null
    }
  }

  return (
    <div className="py-10">
      <Link
        href="/attend/creator"
        className="text-xs font-bold tracking-[0.2em] text-[#9e8a55] hover:text-[#E8C456]"
      >
        ← BACK TO EVENTS
      </Link>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">{event.title}</h1>
          <p className="mt-1 text-xs tracking-widest text-[#9e8a55]">{event.show_type}</p>
        </div>
        <span className="font-mono text-[10px] tracking-widest text-[#E8C456]">{event.status}</span>
      </div>

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

      <div className="mt-6 flex flex-col gap-4">
        <SetupProgress status={event.status} showType={event.show_type} />
        {nextStep()}
        <section className="rounded border border-[#2a2135] bg-[#111111] px-4 py-4">
          <h2 className="text-xs font-black tracking-[0.2em] text-[#9e8a55]">3D VENUE</h2>
          {venues.length === 0 ? (
            <p className="mt-2 text-xs text-[#9e8a55]">
              No venues yet —{' '}
              <Link href="/attend/creator/venues" className="font-bold text-[#E8C456] hover:underline">
                upload a 360° scan
              </Link>{' '}
              to let attendees watch inside your venue.
            </p>
          ) : (
            <>
              <p className="mt-2 text-xs text-[#9e8a55]">
                Attach a venue so attendees can watch this show in 3D (the live stream mounts on
                the venue&rsquo;s stage screen).
              </p>
              <select
                value={event.venue_id ?? ''}
                onChange={(e) => setVenue(e.target.value || null)}
                disabled={busy}
                className="mt-3 rounded border border-[#2a2135] bg-[#0E1E3A] px-3 py-2 text-sm text-[#ede8d8] outline-none focus:border-[#E8C456] disabled:opacity-50"
              >
                <option value="">No 3D venue</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </>
          )}
        </section>
        <EventDetailsPanel event={event} editable={editable} />
        <TicketTypesPanel eventId={event.id} ticketTypes={ticketTypes} editable={editable} />
      </div>
    </div>
  )
}
