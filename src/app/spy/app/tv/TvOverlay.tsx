'use client'

// Fullscreen player overlay for a TvPin. Three player paths:
//   - YouTube channel embed (auto-resolves current live)
//   - YouTube specific video embed
//   - HLS via hls.js for iptv-org streams (Safari plays HLS natively;
//     Chrome/Firefox need hls.js).

import { useEffect, useRef } from 'react'
import type { TvPin } from './page'

export default function TvOverlay({ pin, onClose }: { pin: TvPin; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hlsRef = useRef<any>(null)

  // Decide which embed strategy to use
  const youtubeUrl = pin.youtubeChannelId
    ? `https://www.youtube.com/embed/live_stream?channel=${pin.youtubeChannelId}&autoplay=1`
    : pin.youtubeVideoId
      ? `https://www.youtube.com/embed/${pin.youtubeVideoId}?autoplay=1`
      : pin.iframeUrl || null

  const isHls = !!pin.hlsUrl && !youtubeUrl

  useEffect(() => {
    if (!isHls || !pin.hlsUrl || !videoRef.current) return
    const video = videoRef.current

    // Native HLS (Safari, iOS)
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = pin.hlsUrl
      video.play().catch(() => {})
      return
    }

    // hls.js for Chromium/Firefox. Lazy-loaded so it doesn't ship to other tabs.
    let cancelled = false
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return
      if (!Hls.isSupported()) {
        // Final fallback: try native (may work for fmp4 streams)
        video.src = pin.hlsUrl!
        return
      }
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true })
      hls.loadSource(pin.hlsUrl!)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}))
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          // Most iptv-org streams are reliable but some go down. Don't crash.
          console.warn('[TvOverlay] HLS fatal', data)
        }
      })
      hlsRef.current = hls
    })
    return () => {
      cancelled = true
      try { hlsRef.current?.destroy?.() } catch {}
      hlsRef.current = null
    }
  }, [isHls, pin.hlsUrl])

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col bg-black">
      <div className="flex items-center justify-between gap-3 border-b border-[#0D2235] bg-[#020D14] px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-white">
            {pin.flag ? `${pin.flag} ` : ''}{pin.name}
          </div>
          <div className="truncate font-mono text-[10px] text-[#64748B]">
            {pin.agency} {pin.description ? `· ${pin.description}` : ''}
            {pin.source === 'iptv' && ' · iptv-org'}
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded border border-[#0D2235] px-3 py-1.5 text-[10px] font-bold tracking-widest text-[#94A3B8] hover:border-[#EF4444] hover:text-[#EF4444]"
        >
          ✕ CLOSE
        </button>
      </div>

      <div className="relative flex-1 bg-black">
        {youtubeUrl ? (
          <iframe
            src={youtubeUrl}
            title={pin.name}
            className="absolute inset-0 h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : isHls ? (
          <video
            ref={videoRef}
            controls
            autoPlay
            playsInline
            className="absolute inset-0 h-full w-full bg-black"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[#475569]">
            No playable stream URL for this entry.
          </div>
        )}
      </div>
    </div>
  )
}
