'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import type { VenueScan } from '@/lib/attend/venues/viewer-math'
import MuxPlayer from './mux-player'
import LivePanel from './live-panel'

// 3D venue viewer is heavy + WebGL-only — load it only when an attendee opts
// into the 3D view. The 2D MuxPlayer path below is unchanged.
const VenueViewer = dynamic(() => import('@/app/attend/_components/venue-viewer'), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-video w-full items-center justify-center rounded border border-[#2a2135] bg-black text-xs text-[#9e8a55]">
      Loading 3D venue…
    </div>
  ),
})

export default function RoomClient({
  slug,
  eventId,
  eventTitle,
  eventStatus,
  playbackId,
  playbackToken,
  venueScan,
}: {
  slug: string
  eventId: string
  eventTitle: string
  eventStatus: string
  playbackId: string | null
  playbackToken: string | null
  venueScan: VenueScan | null
}) {
  const [error, setError] = useState<string | null>(null)
  const [view3d, setView3d] = useState(false)
  const checkedIn = useRef(false)

  // Check in on entry (once — the ref guards React 18 StrictMode's double
  // effect; the RPC is idempotent server-side regardless).
  useEffect(() => {
    if (checkedIn.current) return
    checkedIn.current = true
    fetch(`/api/attend/events/${eventId}/check-in`, { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string }
          setError(data.error ?? 'Could not check you in')
        }
      })
      .catch(() => setError('Could not check you in'))
  }, [eventId])

  return (
    <div className="py-10">
      <Link
        href={`/attend/events/${slug}`}
        className="text-xs font-bold tracking-[0.2em] text-[#9e8a55] hover:text-[#E8C456]"
      >
        ← LEAVE ROOM
      </Link>

      <div className="mt-4 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-black">{eventTitle}</h1>
        <div className="flex items-center gap-3">
          {venueScan && (
            <button
              onClick={() => setView3d((v) => !v)}
              className="rounded border border-[#E8C456] px-2.5 py-1 text-[10px] font-bold tracking-widest text-[#E8C456] transition hover:bg-[#E8C456]/10"
            >
              {view3d ? '2D VIEW' : '3D VENUE'}
            </button>
          )}
          <span className="font-mono text-[10px] tracking-widest text-[#E8C456]">{eventStatus}</span>
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {view3d && venueScan ? (
            <VenueViewer
              scan={venueScan}
              videoUrl={
                playbackId && playbackToken
                  ? `https://stream.mux.com/${playbackId}.m3u8?token=${playbackToken}`
                  : undefined
              }
            />
          ) : playbackId && playbackToken ? (
            <MuxPlayer playbackId={playbackId} playbackToken={playbackToken} />
          ) : (
            // Stage-background placeholder while the stream isn't live yet,
            // so the room doesn't look like a broken flat box during the
            // pre-show window.
            <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded border border-[#2a2135] bg-[#111111]">
              <Image
                src="/attend/backgrounds/bg-11.png"
                alt=""
                width={1920}
                height={1080}
                priority
                className="absolute inset-0 h-full w-full object-cover opacity-40"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#08111e] via-[#08111e]/40 to-transparent" />
              <div className="relative flex flex-col items-center gap-2 text-center">
                <span className="font-mono text-[10px] tracking-[0.3em] text-[#E8C456]">
                  WAITING ROOM
                </span>
                <p className="text-sm font-bold text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.6)]">
                  The stream is not available yet.
                </p>
                <p className="text-xs text-white/70">
                  You&rsquo;re checked in — the player will switch on when the host goes live.
                </p>
              </div>
            </div>
          )}
        </div>
        <LivePanel eventId={eventId} />
      </div>
    </div>
  )
}
