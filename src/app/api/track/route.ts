import { NextRequest, NextResponse } from 'next/server'
import { computeVidHash, utcDateString } from '@/lib/tracker/vid-hash'
import { classifySource, classifyProduct } from '@/lib/tracker/source'
import { supaPost } from '@/lib/supabase'

export const runtime = 'edge'

const ALLOWED_EVENTS = new Set([
  'pageview', 'pricing_view', 'checkout_open', 'download_click',
  'report_submit', 'audit_start', 'audit_complete',
])

export async function POST(req: NextRequest) {
  // Always return 204 — tracker errors must never break public pages
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body.vid !== 'string') return new NextResponse(null, { status: 204 })

    const { vid, path, referrer, utm, event } = body
    if (typeof path !== 'string') return new NextResponse(null, { status: 204 })

    // Skip admin traffic
    if (path.startsWith('/admin')) return new NextResponse(null, { status: 204 })

    const today = utcDateString()
    const vidHash = await computeVidHash(vid, today)
    const product = classifyProduct(path)
    const source = classifySource(referrer ?? null, utm)
    const country = req.headers.get('x-vercel-ip-country') ?? null
    const eventName = typeof event === 'string' && ALLOWED_EVENTS.has(event) ? event : null

    await supaPost('traffic_events', {
      vid_hash: vidHash,
      path: path.slice(0, 255),
      product,
      event: eventName,
      source,
      country,
      utm_source: utm?.source ?? null,
      utm_medium: utm?.medium ?? null,
      utm_campaign: utm?.campaign ?? null,
    }, 'return=minimal')
  } catch {
    // Swallow — analytics must not surface errors to callers
  }

  return new NextResponse(null, { status: 204 })
}
