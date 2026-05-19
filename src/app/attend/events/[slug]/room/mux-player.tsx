'use client'

import { useEffect, useRef, useState } from 'react'
import type Hls from 'hls.js'

// The HLS player. Safari plays Mux HLS natively via <video src>; other
// browsers use hls.js (dynamically imported so it is not in every bundle).
export default function MuxPlayer({
  playbackId,
  playbackToken,
}: {
  playbackId: string
  playbackToken: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [problem, setProblem] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const url = `https://stream.mux.com/${playbackId}.m3u8?token=${playbackToken}`

    // Safari: native HLS through the <video> element (CSP media-src).
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url
      return
    }

    // Others: hls.js. Its manifest/segment fetches go through CSP connect-src
    // — if Mux is not allowlisted there, this surfaces as a fatal Hls error
    // and the caption below is shown (no crash).
    let hls: Hls | null = null
    let cancelled = false
    void import('hls.js').then(({ default: HlsCtor }) => {
      if (cancelled) return
      if (!HlsCtor.isSupported()) {
        setProblem(true)
        return
      }
      hls = new HlsCtor()
      hls.loadSource(url)
      hls.attachMedia(video)
      hls.on(HlsCtor.Events.ERROR, (_event, data) => {
        if (data.fatal) setProblem(true)
      })
    })

    return () => {
      cancelled = true
      hls?.destroy()
    }
  }, [playbackId, playbackToken])

  return (
    <div>
      <video
        ref={videoRef}
        controls
        playsInline
        className="aspect-video w-full rounded bg-black"
      />
      {problem && (
        <p className="mt-2 text-xs text-[#9e8a55]">
          Waiting for the broadcast, or the stream could not be reached — it will
          appear here once the show is live.
        </p>
      )}
    </div>
  )
}
