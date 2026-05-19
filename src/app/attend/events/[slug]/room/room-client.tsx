'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import MuxPlayer from './mux-player'

export default function RoomClient({
  slug,
  eventId,
  eventTitle,
  eventStatus,
  playbackId,
  playbackToken,
}: {
  slug: string
  eventId: string
  eventTitle: string
  eventStatus: string
  playbackId: string | null
  playbackToken: string | null
}) {
  const [error, setError] = useState<string | null>(null)
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
        <span className="font-mono text-[10px] tracking-widest text-[#E8C456]">{eventStatus}</span>
      </div>

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

      <div className="mt-6">
        {playbackId && playbackToken ? (
          <MuxPlayer playbackId={playbackId} playbackToken={playbackToken} />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center rounded border border-[#2a2135] bg-[#111111]">
            <p className="text-sm text-[#9e8a55]">The stream is not available yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
