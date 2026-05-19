// HYVE Attend refunds — the buyer-initiated refund flow (spec §17 / §31). A
// request opens atomically (attend_request_refund); then evidence is built and
// the §31 rules attach a recommendation — but per §17 every request still
// waits for a human. Approval issues a Stripe refund and records it atomically
// (attend_process_refund); denial restores the ticket to its prior state.
import { attendStripe } from '@/lib/attend/payments/stripe'
import { recommendRefund } from '@/lib/attend/refunds/recommendation'
import { buildRefundEvidence } from '@/lib/attend/refunds/evidence-builder'
import {
  getRefundRequestById,
  listRefundQueue,
  insertEvidencePacket,
  updateRefundRequest,
  type RefundRequestRow,
  type RefundQueueRow,
} from '@/lib/attend/refunds/refund-repository'
import { ValidationError, NotFoundError } from '@/lib/attend/events/service'
import { supaPost } from '@/lib/supabase'

export type { RefundQueueRow }

// Refund-request statuses that are still open for a reviewer decision.
const OPEN_STATUSES = ['REQUESTED', 'AUTO_RECOMMENDED', 'NEEDS_HUMAN_REVIEW']

interface RpcResult {
  ok?: boolean
  error?: string
  refund_request_id?: string
}

/**
 * Open a refund request for one ticket, then build evidence and attach the
 * §31 recommendation. A failure in the (best-effort) evidence step does not
 * undo the request — a reviewer can still decide it by hand.
 */
export async function requestRefund(
  ticketId: string,
  requesterId: string,
  reason: string | null,
): Promise<void> {
  const res = await supaPost('rpc/attend_request_refund', {
    p_args: { ticket_id: ticketId, requester_id: requesterId, reason },
  })
  if (!res.ok) {
    throw new Error(`attend_request_refund RPC failed: ${res.status} ${await res.text()}`)
  }
  const result = (await res.json()) as RpcResult
  if (result.ok === false) {
    throw new ValidationError(result.error ?? 'This refund request could not be opened')
  }
  const refundRequestId = result.refund_request_id
  if (!refundRequestId) throw new Error('attend_request_refund returned no id')

  // Best-effort evidence + recommendation. A failure here must not surface to
  // the buyer — the request stands and a reviewer sees it without a hint.
  try {
    const { flags, payload } = await buildRefundEvidence(ticketId)
    const recommendation = recommendRefund(flags)
    const packet = await insertEvidencePacket({ refundRequestId, payload })
    await updateRefundRequest(refundRequestId, {
      status: recommendation === 'NEEDS_HUMAN' ? 'NEEDS_HUMAN_REVIEW' : 'AUTO_RECOMMENDED',
      recommendation,
      evidence_packet_id: packet.id,
    })
  } catch (err) {
    console.error('[attend refund] evidence build failed:', (err as Error).message)
  }
}

/** The admin queue: refund requests still awaiting a reviewer decision. */
export async function getRefundQueue(): Promise<RefundQueueRow[]> {
  return listRefundQueue(OPEN_STATUSES)
}

/**
 * A reviewer decides a refund request. Approve issues a Stripe refund (keyed
 * for idempotency) then records it via attend_process_refund; deny restores
 * the ticket to the state it held before the request.
 */
export async function decideRefund(
  refundRequestId: string,
  reviewerId: string,
  decision: 'approve' | 'deny',
): Promise<void> {
  const request = await getRefundRequestById(refundRequestId)
  if (!request) throw new NotFoundError('Refund request not found')
  if (!OPEN_STATUSES.includes(request.status)) {
    throw new ValidationError('This refund request has already been resolved')
  }

  if (decision === 'deny') {
    await denyRefund(request, reviewerId)
  } else {
    await approveRefund(request, reviewerId)
  }
}

async function denyRefund(request: RefundRequestRow, reviewerId: string): Promise<void> {
  // The RPC locks the request row, so this is race-safe against a concurrent
  // approve and restores the ticket to its pre-request state atomically.
  const res = await supaPost('rpc/attend_deny_refund', {
    p_args: { refund_request_id: request.id, reviewer_id: reviewerId },
  })
  if (!res.ok) {
    throw new Error(`attend_deny_refund RPC failed: ${res.status} ${await res.text()}`)
  }
  const result = (await res.json()) as RpcResult
  if (result.ok === false) {
    throw new ValidationError(result.error ?? 'This refund request could not be denied')
  }
}

async function approveRefund(request: RefundRequestRow, reviewerId: string): Promise<void> {
  const paymentIntentId = request.attend_orders?.stripe_payment_intent_id
  const amountCents = request.amount_cents ?? 0
  if (!paymentIntentId) {
    throw new ValidationError('The original payment for this order could not be found')
  }
  if (amountCents <= 0) {
    throw new ValidationError('This refund has no amount to return')
  }

  // Stripe refund — keyed on the request id so a retry never double-refunds.
  const refund = await attendStripe().refunds.create(
    { payment_intent: paymentIntentId, amount: amountCents },
    { idempotencyKey: `attend-refund-${request.id}` },
  )

  // Record the refund atomically. attend_process_refund reads the amount from
  // the request row itself, so it is not passed here.
  const res = await supaPost('rpc/attend_process_refund', {
    p_args: {
      refund_request_id: request.id,
      reviewer_id: reviewerId,
      stripe_refund_id: refund.id,
      stripe_payment_intent_id: paymentIntentId,
    },
  })
  if (!res.ok) {
    const detail = await res.text()
    // The Stripe refund has already completed — the money has moved. The
    // request stays open, so re-running approve recovers it (Stripe and the
    // RPC are both idempotent); this log carries the refund id so the
    // divergent state is recoverable even without a retry.
    console.error(
      `[attend refund] CRITICAL: Stripe refund ${refund.id} for request ${request.id} ` +
        `succeeded but attend_process_refund failed (${res.status}). ` +
        `Re-run the approve to record it. Detail: ${detail}`,
    )
    throw new Error(`attend_process_refund RPC failed: ${res.status} ${detail}`)
  }
  // A PROCESSED replay means another reviewer already resolved this request.
  const result = (await res.json()) as { already_done?: boolean }
  if (result.already_done) {
    throw new ValidationError('This refund has already been processed')
  }
}
