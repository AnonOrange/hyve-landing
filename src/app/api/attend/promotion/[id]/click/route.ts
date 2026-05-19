import { NextRequest, NextResponse } from 'next/server'
import { recordClick } from '@/lib/attend/promotion/promotion-service'

export const runtime = 'nodejs'

// GET /api/attend/promotion/[id]/click?to=<event-slug> — records a click on the
// campaign, then redirects to that event. `to` is constrained to an event slug
// so the redirect target can only ever be an internal /attend/events path.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const to = req.nextUrl.searchParams.get('to') ?? ''
  const slug = /^[a-z0-9-]{1,200}$/.test(to) ? to : null

  await recordClick(params.id)

  const dest = slug ? `/attend/events/${slug}` : '/attend'
  return NextResponse.redirect(new URL(dest, req.nextUrl.origin))
}
