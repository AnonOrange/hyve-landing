'use client'

import Image from 'next/image'

// Compact branding bar shown above every map view (main, world, recon).
// Sticks to the top of the route, sized so the map below still gets the
// majority of viewport. Optional rightSlot for per-map badges/counts.
export default function MapHeader({
  rightSlot,
  accent = '#00D4FF',
  subtitle,
}: {
  rightSlot?: React.ReactNode
  accent?: string
  subtitle?: string
}) {
  return (
    <div
      className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-[#0D2235] bg-[#020D14] px-4 py-2"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
    >
      <div className="flex items-center gap-3">
        <Image
          src="/spy-logo/hyve-spy-logo.png"
          alt="Hyve Spy"
          width={1536}
          height={1024}
          priority
          className="h-12 w-auto sm:h-14 md:h-16"
        />
        {subtitle && (
          <div
            className="hidden text-[10px] font-black tracking-[0.4em] sm:block"
            style={{ color: accent }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {rightSlot && <div className="flex shrink-0 items-center gap-2">{rightSlot}</div>}
    </div>
  )
}
