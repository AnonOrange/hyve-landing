// HYVE Attend disputes — card-dispute orchestration (spec §18). Ingestion is
// webhook-driven: a created dispute is recorded and frozen atomically
// (attend_open_dispute), then evidence is built and a contest/accept
// recommendation attached. A reviewer then submits evidence to Stripe or
// concedes; Stripe's charge.dispute.closed webhook records the final outcome.
import type Stripe from 'stripe'
import { attendStripe } from '@/lib/attend/payments/stripe'
import { recommendDisputeResponse } from '@/lib/attend/disputes/dispute-recommendation'
import { buildDisputeEvidence } from '@/lib/attend/disputes/dispute-evidence-builder'
import {
  findPaymentByIntent,
  getDisputeById,
  listDisputes,
  insertDisputeEvidencePacket,
  updateDispute,
  type DisputeQueueRow,
} from '@/lib/attend/disputes/dispute-repository'
import { ValidationError, NotFoundError } from '@/lib/attend/events/service'
import { supaPost } from '@/lib/supabase'

export type { DisputeQueueRow }

// Dispute statuses from which a reviewer may still act.
const OPEN_STATUSES = ['NEEDS_RESPONSE', 'EVIDENCE_BUILDING', 'EVIDENCE_READY', 'ESCALATED']

/**
 * Record a newly-created Stripe dispute: open it atomically (freeze the order +
 * ledger hold), then best-effort build the §18 evidence packet and attach a
 * recommendation. A dispute with no matching payment is logged and skipped —
 * it is not one of ours.
 */
export async function ingestDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
  const paymentIntentId =
    typeof dispute.payment_intent === 'string'
      ? dispute.payment_intent
      : (dispute.payment_intent?.id ?? null)
  if (!paymentIntentId) {
    console.error(`[attend dispute] ${dispute.id} has no payment_intent — skipped`)
    return
  }
  const payment = await findPaymentByIntent(paymentIntentId)
  if (!payment || !payment.order_id || !payment.event_id) {
    console.error(`[attend dispute] ${dispute.id}: no matching Attend payment — skipped`)
    return
  }

  const dueBy = dispute.evidence_details?.due_by
    ? new Date(dispute.evidence_details.due_by * 1000).toISOString()
    : null

  const res = await supaPost('rpc/attend_open_dispute', {
    p_args: {
      stripe_dispute_id: dispute.id,
      payment_id: payment.id,
      order_id: payment.order_id,
      event_id: payment.event_id,
      amount_cents: dispute.amount,
      reason: dispute.reason ?? null,
      due_by: dueBy,
    },
  })
  if (!res.ok) {
    throw new Error(`attend_open_dispute RPC failed: ${res.status} ${await res.text()}`)
  }
  const { dispute_id: disputeId, already_done: alreadyDone } = (await res.json()) as {
    dispute_id: string
    already_done?: boolean
  }
  if (alreadyDone) return

  // Best-effort evidence + recommendation — a failure here leaves the dispute
  // for a reviewer without an auto-recommendation rather than failing the
  // webhook (which the order freeze has already accomplished).
  try {
    const { flags, payload } = await buildDisputeEvidence(payment.order_id)
    const recommendation = recommendDisputeResponse(flags)
    const packet = await insertDisputeEvidencePacket({
      disputeId,
      payload: { ...payload, recommendation },
    })
    await updateDispute(disputeId, {
      status: 'EVIDENCE_READY',
      evidence_packet_id: packet.id,
    })
  } catch (err) {
    console.error('[attend dispute] evidence build failed:', (err as Error).message)
  }
}

/** Record a closed Stripe dispute: WON / LOST, releasing the ledger hold. */
export async function ingestDisputeClosed(dispute: Stripe.Dispute): Promise<void> {
  const outcome = dispute.status === 'won' ? 'WON' : 'LOST'
  const res = await supaPost('rpc/attend_close_dispute', {
    p_args: { stripe_dispute_id: dispute.id, outcome },
  })
  if (!res.ok) {
    throw new Error(`attend_close_dispute RPC failed: ${res.status} ${await res.text()}`)
  }
  // A dispute we never recorded (no matching Attend payment at creation time)
  // returns { ok: false } — there is nothing to settle, so this is not an error.
  const result = (await res.json()) as { ok?: boolean }
  if (result.ok === false) {
    console.error(`[attend dispute] close for unrecorded dispute ${dispute.id} — skipped`)
  }
}

/** The admin dispute queue — every dispute, newest first. */
export async function getDisputeQueue(): Promise<DisputeQueueRow[]> {
  return listDisputes()
}

/**
 * Submit the evidence packet to Stripe and mark the dispute SUBMITTED. The
 * packet payload is sent as Stripe's uncategorized evidence text.
 */
export async function submitDisputeEvidence(disputeId: string): Promise<void> {
  const dispute = await loadOpenDispute(disputeId)

  let evidenceText = `HYVE Attend dispute evidence for order ${dispute.order_id}.`
  if (dispute.evidence_packet_id) {
    evidenceText +=
      ` Evidence packet ${dispute.evidence_packet_id} on file: attendance, ticket,` +
      ` event, stream and policy records support that the event was delivered.`
  }

  await attendStripe().disputes.update(dispute.stripe_dispute_id, {
    evidence: { uncategorized_text: evidenceText },
    submit: true,
  })
  await updateDispute(dispute.id, { status: 'SUBMITTED' })
}

/** Concede the dispute: close it with Stripe and mark it ACCEPTED. */
export async function acceptDispute(disputeId: string): Promise<void> {
  const dispute = await loadOpenDispute(disputeId)
  await attendStripe().disputes.close(dispute.stripe_dispute_id)
  await updateDispute(dispute.id, { status: 'ACCEPTED' })
}

async function loadOpenDispute(disputeId: string) {
  const dispute = await getDisputeById(disputeId)
  if (!dispute) throw new NotFoundError('Dispute not found')
  if (!OPEN_STATUSES.includes(dispute.status)) {
    throw new ValidationError('This dispute can no longer be acted on')
  }
  return dispute
}
