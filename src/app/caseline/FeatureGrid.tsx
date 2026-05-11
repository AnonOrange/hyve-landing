// Click-to-expand feature grid. Each card opens a full-resolution
// lightbox of the screenshot with prev/next navigation, ESC to close,
// backdrop-click to dismiss, and focus management. Built as a client
// component so the parent marketing page can stay server-rendered.

'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'

const ACCENT = '#00B4D8'

export interface Feature {
  title: string
  body: string
  /** Real product screenshot. 1480x920 captured from a live build. */
  screenshot: string
}

export default function FeatureGrid({ features }: { features: Feature[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  const open  = useCallback((i: number) => setActiveIndex(i), [])
  const close = useCallback(() => setActiveIndex(null), [])
  const prev  = useCallback(() => setActiveIndex((i) => (i === null ? null : (i - 1 + features.length) % features.length)), [features.length])
  const next  = useCallback(() => setActiveIndex((i) => (i === null ? null : (i + 1) % features.length)), [features.length])

  // Keyboard: ESC closes, ← → navigates between screenshots
  useEffect(() => {
    if (activeIndex === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape')     { e.preventDefault(); close() }
      else if (e.key === 'ArrowLeft')  { e.preventDefault(); prev() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [activeIndex, close, prev, next])

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (activeIndex === null) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeBtnRef.current?.focus()
    return () => { document.body.style.overflow = prevOverflow }
  }, [activeIndex])

  const active = activeIndex !== null ? features[activeIndex] : null

  return (
    <>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => (
          <button
            key={f.title}
            type="button"
            onClick={() => open(i)}
            className="group relative overflow-hidden rounded-xl border-2 text-left transition hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2"
            style={{ borderColor: `${ACCENT}33`, background: `${ACCENT}08` }}
            aria-label={`Open ${f.title} screenshot full-size`}
          >
            <div
              className="relative aspect-[16/10] w-full overflow-hidden border-b"
              style={{ borderColor: `${ACCENT}22`, background: '#0b0a10' }}
            >
              <Image
                src={f.screenshot}
                alt={`${f.title} — real screenshot from the CaseLine desktop app`}
                width={1480}
                height={925}
                className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
              />
              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ boxShadow: `inset 0 0 60px ${ACCENT}33` }}
              />
              {/* Hover-revealed "click to expand" hint */}
              <div className="pointer-events-none absolute bottom-2 right-2 rounded border px-2 py-1 font-mono text-[9px] font-bold tracking-[0.2em] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                   style={{ borderColor: ACCENT, background: 'rgba(0,0,0,0.7)', color: ACCENT }}>
                CLICK TO EXPAND ⤢
              </div>
            </div>
            <div className="p-5">
              <h3 className="text-base font-black text-[#ede8d8]">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#9e8a55]">{f.body}</p>
            </div>
          </button>
        ))}
      </div>

      {active !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={`${active.title} — full-size screenshot`}
          onClick={close}
        >
          {/* Backdrop — clicking it closes */}
          <div
            className="absolute inset-0"
            style={{
              background: 'rgba(8, 7, 10, 0.92)',
              backdropFilter: 'blur(8px)',
            }}
          />

          {/* Content — clicking content does NOT close (stopPropagation) */}
          <div
            className="relative z-10 flex max-h-[95vh] w-[min(96vw,1480px)] flex-col gap-4 px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-mono text-[10px] tracking-[0.4em]" style={{ color: ACCENT }}>
                  CASELINE · FEATURE {activeIndex !== null ? activeIndex + 1 : 0} OF {features.length}
                </div>
                <h2 className="mt-1 text-2xl font-black text-[#ede8d8] md:text-3xl">{active.title}</h2>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={close}
                aria-label="Close full-size screenshot"
                className="rounded border-2 px-3 py-2 font-mono text-xs font-bold tracking-[0.3em] transition hover:bg-white/5"
                style={{ borderColor: ACCENT, color: ACCENT }}
              >
                CLOSE  ✕
              </button>
            </div>

            <div
              className="relative overflow-hidden rounded-xl border-2 bg-black"
              style={{ borderColor: `${ACCENT}55`, boxShadow: `0 0 40px ${ACCENT}22` }}
            >
              <Image
                src={active.screenshot}
                alt={`${active.title} — full-size`}
                width={1480}
                height={925}
                priority
                className="h-auto w-full"
              />
            </div>

            <p className="mx-auto max-w-3xl text-center text-sm leading-relaxed text-[#9e8a55] md:text-base">
              {active.body}
            </p>

            <div className="flex items-center justify-between gap-4 pt-2">
              <button
                type="button"
                onClick={prev}
                aria-label="Previous feature"
                className="rounded border-2 px-4 py-2 font-mono text-xs font-bold tracking-[0.3em] transition hover:bg-white/5"
                style={{ borderColor: `${ACCENT}77`, color: ACCENT }}
              >
                ← PREV
              </button>
              <div className="hidden font-mono text-[10px] tracking-[0.2em] text-[#6b5e3a] sm:block">
                ESC to close · ← → to navigate
              </div>
              <button
                type="button"
                onClick={next}
                aria-label="Next feature"
                className="rounded border-2 px-4 py-2 font-mono text-xs font-bold tracking-[0.3em] transition hover:bg-white/5"
                style={{ borderColor: `${ACCENT}77`, color: ACCENT }}
              >
                NEXT →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
