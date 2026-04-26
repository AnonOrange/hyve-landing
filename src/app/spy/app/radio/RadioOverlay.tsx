'use client'

// Audio player overlay for a radio station. radio-browser.info streams are
// MP3, AAC, or HLS; HTML5 <audio> handles the first two natively. For HLS
// we fall back to hls.js (most stations aren't HLS so this rarely fires).

import { useEffect, useRef, useState } from 'react'
import type { RadioStation } from './page'

export default function RadioOverlay({
  station,
  onClose,
}: {
  station: RadioStation
  onClose: () => void
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hlsRef = useRef<any>(null)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isHls = /\.m3u8(\?|$)/i.test(station.streamUrl)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    setError(null)

    if (!isHls) {
      audio.src = station.streamUrl
      audio.play().then(() => setPlaying(true)).catch((e) => {
        setError('Autoplay blocked — press play.')
      })
      return
    }

    // HLS path
    if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      audio.src = station.streamUrl
      audio.play().then(() => setPlaying(true)).catch(() => {})
      return
    }

    let cancelled = false
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return
      if (!Hls.isSupported()) {
        audio.src = station.streamUrl
        return
      }
      const hls = new Hls()
      hls.loadSource(station.streamUrl)
      hls.attachMedia(audio)
      hls.on(Hls.Events.MANIFEST_PARSED, () =>
        audio.play().then(() => setPlaying(true)).catch(() => {}),
      )
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) setError('Stream offline.')
      })
      hlsRef.current = hls
    })
    return () => {
      cancelled = true
      try { hlsRef.current?.destroy?.() } catch {}
      hlsRef.current = null
    }
  }, [station.id, station.streamUrl, isHls])

  // Pause/resume button — many radio streams are continuous so this is
  // really play/pause not "stop". onended for a stream means it died.
  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.play().then(() => setPlaying(true)).catch(() => setError('Cannot play.'))
    } else {
      audio.pause()
      setPlaying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl border border-[#0D2235] bg-[#020D14] p-6 sm:rounded-2xl">
        <div className="flex items-start gap-3">
          {station.favicon ? (
            <img
              src={station.favicon}
              alt=""
              className="h-14 w-14 shrink-0 rounded border border-[#0D2235] bg-black object-cover"
              onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0')}
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-[#0D2235] bg-black text-xl">
              📻
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-bold text-white">{station.name}</div>
            <div className="truncate font-mono text-[11px] text-[#94A3B8]">
              {station.country}
              {station.language && ` · ${station.language}`}
            </div>
            {station.tags.length > 0 && (
              <div className="mt-1 truncate text-[10px] text-[#64748B]">
                {station.tags.slice(0, 5).join(' · ')}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded border border-[#0D2235] px-2 py-1 text-[10px] font-bold tracking-widest text-[#94A3B8] hover:border-[#22C55E] hover:text-[#22C55E]"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 flex items-center gap-4">
          <button
            onClick={toggle}
            aria-label={playing ? 'Pause' : 'Play'}
            className="flex h-14 w-14 items-center justify-center rounded-full text-2xl text-black transition"
            style={{ background: '#22C55E', boxShadow: '0 0 20px #22C55E55' }}
          >
            {playing ? '❚❚' : '▶'}
          </button>
          <div className="flex-1 font-mono text-[11px] text-[#475569]">
            {playing ? (
              <span className="text-[#22C55E]">● ON AIR</span>
            ) : (
              <span>Press play</span>
            )}
            {station.bitrate ? ` · ${station.bitrate} kbps` : ''}
            {station.codec ? ` · ${station.codec}` : ''}
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded bg-red-900/40 px-3 py-1.5 text-[11px] text-red-200">
            {error}
          </div>
        )}

        <audio ref={audioRef} preload="none" hidden />

        <div className="mt-4 flex items-center justify-between border-t border-[#0D2235] pt-3 text-[10px] text-[#64748B]">
          <span>radio-browser.info · CC-BY-SA</span>
          {station.homepage && (
            <a
              href={station.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#22C55E] hover:underline"
            >
              station site →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
