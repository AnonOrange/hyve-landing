'use client'

// AdSlot — Google AdSense unit that ONLY renders for free-tier users.
//
// The component reads the `hyve_spy_tier` cookie client-side to decide
// whether to render. If the user is on basic / pro / comp / has no tier
// cookie, AdSlot returns null — paying users see zero ad chrome.
//
// Setup (one-time, by the operator):
//   1. Register at adsense.google.com, verify hyveapp.co
//   2. Once approved, copy your "ca-pub-XXXXXX" publisher ID into
//      NEXT_PUBLIC_ADSENSE_CLIENT in Vercel env
//   3. Create a "Display ad" unit in AdSense, copy its slot ID, paste
//      into NEXT_PUBLIC_ADSENSE_SLOT_DEFAULT (or pass `slot` prop per use)
//   4. Redeploy. Ads start serving the next page load for free users.
//
// Without env vars set, AdSlot still renders nothing (graceful degradation).
// Without an active hyve_spy_tier=free cookie, AdSlot still renders nothing.
// The dual gate means AdSlot is safe to drop into any layout.

import { useEffect, useRef, useState } from 'react'

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || ''
const ADSENSE_SLOT_DEFAULT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_DEFAULT || ''

type Props = {
  /** Override slot ID per placement, e.g. one slot for cards, one for footer. */
  slot?: string
  /** AdSense layout: 'auto' (default), 'in-article', 'in-feed'. */
  format?: 'auto' | 'in-article' | 'in-feed'
  /** Tailwind className for the wrapper div */
  className?: string
  /** Hides the "Sponsored" label above the ad. Default: false (FTC compliance). */
  hideLabel?: boolean
}

export default function AdSlot({ slot, format = 'auto', className = '', hideLabel = false }: Props) {
  const [tier, setTier] = useState<string | null>(null)
  const [filled, setFilled] = useState<'pending' | 'filled' | 'empty'>('pending')
  const insRef = useRef<HTMLModElement | null>(null)
  const pushedRef = useRef(false)

  useEffect(() => {
    const m = document.cookie.match(/(?:^|; )hyve_spy_tier=([^;]+)/)
    setTier(m?.[1] || null)
  }, [])

  // Push the ad to AdSense's queue once per mount + watch for the result.
  // AdSense annotates the <ins> element with data-ad-status="filled"|"unfilled"
  // once it decides whether to serve. Pre-approval (or no-fill) yields
  // "unfilled" or never sets the attribute at all — both should result in
  // the wrapper hiding so users don't see an empty Sponsored box.
  useEffect(() => {
    const slotId = slot || ADSENSE_SLOT_DEFAULT
    if (tier !== 'free' || !ADSENSE_CLIENT || !slotId || pushedRef.current) return
    if (typeof window === 'undefined') return

    try {
      // @ts-expect-error — adsbygoogle is injected by the AdSense script tag
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      pushedRef.current = true
    } catch {
      setFilled('empty')
      return
    }

    // Watch the ins element for fill/unfilled signal. Two paths:
    //  1. data-ad-status attribute changes → MutationObserver picks it up
    //  2. timeout elapses without a fill → we assume empty and hide
    const ins = insRef.current
    if (!ins) return

    const observer = new MutationObserver(() => {
      const status = ins.getAttribute('data-ad-status')
      if (status === 'unfilled') setFilled('empty')
      else if (status === 'filled') setFilled('filled')
    })
    observer.observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] })

    // Pre-approval / blocked / no-fill backstop — if AdSense never sets
    // the attribute (most common before site approval), assume empty after
    // 4s. Avoids leaving a blank "Sponsored" box forever.
    const timeout = setTimeout(() => {
      if (!ins.getAttribute('data-ad-status')) setFilled('empty')
    }, 4000)

    return () => {
      observer.disconnect()
      clearTimeout(timeout)
    }
  }, [tier, slot])

  // Three render gates — if any fails, render nothing.
  if (tier !== 'free') return null
  const slotId = slot || ADSENSE_SLOT_DEFAULT
  if (!ADSENSE_CLIENT || !slotId) return null
  // If AdSense told us it can't serve (no approval, no fill, ad blocker),
  // hide the entire wrapper — no empty Sponsored chrome.
  if (filled === 'empty') return null

  return (
    <div className={`my-3 w-full ${className}`}>
      {!hideLabel && filled === 'filled' && (
        <div className="mb-1 text-center font-mono text-[9px] uppercase tracking-[0.3em] text-[#475569]">
          Sponsored
        </div>
      )}
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'block', minHeight: filled === 'filled' ? 90 : 0 }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slotId}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  )
}
