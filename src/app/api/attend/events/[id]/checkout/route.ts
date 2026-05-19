import { NextRequest, NextResponse } from 'next/server'
import { requireAttendUser } from '@/lib/attend/identity/roles'
import { startCheckout } from '@/lib/attend/payments/checkout-service'
import type { Selection } from '@/lib/attend/payments/checkout-pricing'
import { NotFoundError, ValidationError } from '@/lib/attend/events/service'

export const runtime = 'nodejs'

// Shape-validate the untrusted cart at the boundary; priceSelections (inside
// startCheckout) does the semantic checks (ranges, tier existence, on-sale).
function parseItems(raw: unknown): Selection[] | null {
  if (!Array.isArray(raw)) return null
  const items: Selection[] = []
  for (const it of raw) {
    if (!it || typeof it !== 'object') return null
    const o = it as Record<string, unknown>
    if (typeof o.ticketTypeId !== 'string' || typeof o.quantity !== 'number') return null
    items.push({ ticketTypeId: o.ticketTypeId, quantity: o.quantity })
  }
  return items
}

// POST /api/attend/events/[id]/checkout — open a Stripe Checkout session for
// the selected tickets. Body: { items: { ticketTypeId, quantity }[] }.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAttendUser()
  if (!user) {
    return NextResponse.json({ error: 'Please sign in to buy tickets' }, { status: 401 })
  }

  let body: { items?: unknown }
  try {
    body = (await req.json()) as { items?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const items = parseItems(body.items)
  if (!items) {
    return NextResponse.json({ error: 'A valid ticket selection is required' }, { status: 400 })
  }

  try {
    const result = await startCheckout(user.id, params.id, items, req.nextUrl.origin)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    console.error('[attend checkout]:', (err as Error).message)
    return NextResponse.json({ error: 'Checkout could not be started' }, { status: 500 })
  }
}
