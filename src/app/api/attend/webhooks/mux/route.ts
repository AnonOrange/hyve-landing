import { NextRequest, NextResponse } from 'next/server'
import { streamProvider } from '@/lib/attend/streaming/provider'
import { applyMuxStreamEvent } from '@/lib/attend/streaming/streaming-service'
import {
  claimWebhookEvent,
  isWebhookProcessed,
  releaseWebhookClaim,
  markWebhookProcessed,
} from '@/lib/attend/payments/payments-repository'

export const runtime = 'nodejs'

interface MuxEvent {
  id: string
  type: string
  data: { id: string }
}

// HYVE Attend's Mux webhook — keeps attend_streams in sync with Mux Live.
// Exactly-once via the attend_webhook_events atomic claim (provider 'MUX'),
// deduped on the event-envelope id; a failed handler releases the claim so
// Mux's retry re-runs the (idempotent) handler.
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('mux-signature')

  if (!streamProvider().verifyWebhookSignature(rawBody, signature)) {
    console.error('[attend mux webhook] signature verification failed')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: MuxEvent
  try {
    event = JSON.parse(rawBody) as MuxEvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!event.id || !event.type) {
    return NextResponse.json({ error: 'Malformed event' }, { status: 400 })
  }

  // Atomically claim the event; dedup on the event-envelope id.
  let claimed: boolean
  try {
    claimed = await claimWebhookEvent('MUX', event.id, event.type, event)
  } catch (err) {
    console.error('[attend mux webhook] claim failed:', (err as Error).message)
    return NextResponse.json({ error: 'Webhook store unavailable' }, { status: 500 })
  }
  if (!claimed) {
    if (await isWebhookProcessed(event.id)) {
      return NextResponse.json({ received: true, duplicate: true })
    }
    return NextResponse.json({ error: 'Event already in progress' }, { status: 500 })
  }

  try {
    if (event.type.startsWith('video.live_stream.')) {
      await applyMuxStreamEvent(event.data.id, event.type)
    }
    await markWebhookProcessed(event.id)
    return NextResponse.json({ received: true })
  } catch (err) {
    await releaseWebhookClaim(event.id)
    console.error(`[attend mux webhook] handler error for ${event.type}:`, (err as Error).message)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }
}
