'use client'

import { useEffect, useRef, useState } from 'react'

export type Camera = {
  id?: string
  name?: string
  label?: string
  agency?: string
  lat?: number
  lng?: number
  latitude?: number
  longitude?: number
  feedType?: string
  url?: string
  streamUrl?: string
  snapshotUrl?: string
  feedUrl?: string
}

export function youtubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

export function camUrl(cam: Camera): string {
  return cam.snapshotUrl || cam.streamUrl || cam.feedUrl || cam.url || ''
}

export function camName(cam: Camera): string {
  return cam.name || cam.label || cam.agency || 'Live Camera'
}

function ZoomablePane({ children }: { children: React.ReactNode }) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const pinchRef = useRef<{ d: number; s: number } | null>(null)
  const ptrs = useRef<Map<number, { x: number; y: number }>>(new Map())

  const clampPan = (s: number, x: number, y: number) => {
    const el = wrapRef.current
    if (!el) return { x, y }
    const max = ((s - 1) * Math.max(el.clientWidth, el.clientHeight)) / 2
    return { x: Math.max(-max, Math.min(max, x)), y: Math.max(-max, Math.min(max, y)) }
  }

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const next = Math.max(1, Math.min(8, scale * (e.deltaY < 0 ? 1.15 : 0.87)))
    const c = clampPan(next, tx, ty)
    setScale(next); setTx(c.x); setTy(c.y)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId)
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (ptrs.current.size === 2) {
      const [a, b] = Array.from(ptrs.current.values())
      pinchRef.current = { d: Math.hypot(a.x - b.x, a.y - b.y), s: scale }
      dragRef.current = null
    } else if (ptrs.current.size === 1 && scale > 1) {
      dragRef.current = { x: e.clientX, y: e.clientY, tx, ty }
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinchRef.current && ptrs.current.size === 2) {
      const [a, b] = Array.from(ptrs.current.values())
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const next = Math.max(1, Math.min(8, pinchRef.current.s * (d / pinchRef.current.d)))
      const c = clampPan(next, tx, ty)
      setScale(next); setTx(c.x); setTy(c.y)
    } else if (dragRef.current) {
      const c = clampPan(scale, dragRef.current.tx + (e.clientX - dragRef.current.x), dragRef.current.ty + (e.clientY - dragRef.current.y))
      setTx(c.x); setTy(c.y)
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId)
    if (ptrs.current.size < 2) pinchRef.current = null
    if (ptrs.current.size === 0) dragRef.current = null
  }

  const reset = () => { setScale(1); setTx(0); setTy(0) }
  const zoomIn  = () => { const n = Math.min(8, scale * 1.5); const c = clampPan(n, tx, ty); setScale(n); setTx(c.x); setTy(c.y) }
  const zoomOut = () => { const n = Math.max(1, scale / 1.5); const c = clampPan(n, tx, ty); setScale(n); setTx(c.x); setTy(c.y) }

  return (
    <div className="relative h-full w-full overflow-hidden bg-black" style={{ touchAction: 'none' }}>
      <div
        ref={wrapRef}
        className="h-full w-full"
        style={{
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          transformOrigin: 'center center',
          transition: dragRef.current || pinchRef.current ? 'none' : 'transform 120ms ease-out',
          cursor: scale > 1 ? (dragRef.current ? 'grabbing' : 'grab') : 'default',
        }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={reset}
      >
        {children}
      </div>
      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-md border border-[#0D2235] bg-black/70 p-1 backdrop-blur">
        <button onClick={zoomOut} className="rounded px-2 py-1 text-sm font-bold text-[#E2E8F0] hover:bg-white/10" aria-label="Zoom out">−</button>
        <span className="px-1 font-mono text-[10px] text-[#64748B]">{scale.toFixed(1)}×</span>
        <button onClick={zoomIn}  className="rounded px-2 py-1 text-sm font-bold text-[#E2E8F0] hover:bg-white/10" aria-label="Zoom in">+</button>
        <button onClick={reset}   className="rounded px-2 py-1 text-[10px] font-bold tracking-widest text-[#00D4FF] hover:bg-white/10">RESET</button>
      </div>
    </div>
  )
}

export function CameraOverlay({ cam, onClose }: { cam: Camera; onClose: () => void }) {
  const url = camUrl(cam)
  const name = camName(cam)
  const type = (cam.feedType || '').toLowerCase()
  const [tick, setTick] = useState(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hlsRef = useRef<any>(null)

  useEffect(() => {
    const isSnap = type === 'snapshot' || (!type && /\.(jpg|jpeg|png|gif)(\?|$)/i.test(url))
    if (!isSnap) return
    const i = setInterval(() => setTick((t) => t + 1), 2000)
    return () => clearInterval(i)
  }, [type, url])

  useEffect(() => {
    if (type !== 'hls' || !url || !videoRef.current) return
    const v = videoRef.current
    if (v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = url
      return
    }
    let cancelled = false
    ;(async () => {
      const Hls = (await import('hls.js')).default
      if (cancelled) return
      if (Hls.isSupported()) {
        const hls = new Hls()
        hlsRef.current = hls
        hls.loadSource(url)
        hls.attachMedia(v)
      }
    })()
    return () => {
      cancelled = true
      try { hlsRef.current?.destroy() } catch {}
    }
  }, [type, url])

  const ytId = type === 'youtube' || /youtube\.com|youtu\.be/.test(url) ? youtubeId(url) : null

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col bg-black/95 backdrop-blur" onClick={onClose}>
      <div className="flex items-center justify-between border-b border-[#0D2235] bg-black px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-[#E2E8F0]">{name}</div>
          <div className="truncate font-mono text-[10px] text-[#475569]">{type || 'snapshot'} · scroll/pinch to zoom · drag to pan · double-click to reset</div>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="ml-3 rounded border border-[#0D2235] px-3 py-1 text-[10px] font-bold tracking-widest text-[#64748B] hover:text-[#00D4FF]"
        >
          OPEN SOURCE ↗
        </a>
        <button onClick={onClose} className="ml-2 rounded border border-[#0D2235] px-3 py-1 text-xs text-[#64748B] hover:text-[#E2E8F0]">
          ✕ CLOSE
        </button>
      </div>
      <div className="flex-1 overflow-hidden bg-black" onClick={(e) => e.stopPropagation()}>
        {!url ? (
          <div className="flex h-full w-full items-center justify-center text-xs text-[#64748B]">No stream URL</div>
        ) : (
          <ZoomablePane>
            {ytId ? (
              <iframe
                src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&playsinline=1&rel=0`}
                className="h-full w-full"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : type === 'hls' ? (
              <video ref={videoRef} className="h-full w-full object-contain" controls autoPlay muted playsInline />
            ) : type === 'webview' ? (
              <iframe
                src={url}
                className="h-full w-full"
                sandbox="allow-scripts allow-same-origin allow-popups"
                allow="autoplay; encrypted-media"
              />
            ) : (
              <img
                src={`${url}${url.includes('?') ? '&' : '?'}_t=${tick}`}
                alt={name}
                className="h-full w-full object-contain"
                draggable={false}
                onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0.3')}
              />
            )}
          </ZoomablePane>
        )}
      </div>
    </div>
  )
}
