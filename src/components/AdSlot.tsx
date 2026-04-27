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
  const insRef = useRef<HTMLModElement | null>(null)
  const pushedRef = useRef(false)

  useEffect(() => {
    const m = document.cookie.match(/(?:^|; )hyve_spy_tier=([^;]+)/)
    setTier(m?.[1] || null)
  }, [])

  // Push the ad to AdSense's queue once per mount, only when:
  // - Free tier confirmed via cookie
  // - Publisher ID configured
  // - Slot ID configured (per-prop or default env)
  // - We haven't already pushed this instance (prevents double-render warnings)
  useEffect(() => {
    const slotId = slot || ADSENSE_SLOT_DEFAULT
    if (tier !== 'free' || !ADSENSE_CLIENT || !slotId || pushedRef.current) return
    if (typeof window === 'undefined') return

    try {
      // @ts-expect-error — adsbygoogle is injected by the AdSense script tag
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      pushedRef.current = true
    } catch {
      // AdSense throws if it can't render (ad-blocker, no fill, etc.).
      // Silently — caller never needs to handle this.
    }
  }, [tier, slot])

  // Render nothing for paying users or when AdSense isn't configured.
  if (tier !== 'free') return null
  const slotId = slot || ADSENSE_SLOT_DEFAULT
  if (!ADSENSE_CLIENT || !slotId) return null

  return (
    <div className={`my-3 w-full ${className}`}>
      {!hideLabel && (
        <div className="mb-1 text-center font-mono text-[9px] uppercase tracking-[0.3em] text-[#475569]">
          Sponsored
        </div>
      )}
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'block', minHeight: 90 }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slotId}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  )
}
