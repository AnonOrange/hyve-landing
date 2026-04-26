'use client'

import Image from 'next/image'

// Compact branding bar shown above every map view (main, world, recon).
// 3-column grid keeps the logo perfectly centered regardless of left/right
// content widths. Logo scales from 64px on phone to 96px on desktop.
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
      className="grid flex-shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-[#0D2235] bg-[#020D14] px-4 py-3"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
    >
      {/* Left: subtitle / accent label */}
      <div className="justify-self-start">
        {subtitle && (
          <div
            className="text-[10px] font-black tracking-[0.4em] sm:text-xs"
            style={{ color: accent }}
          >
            {subtitle}
          </div>
        )}
      </div>

      {/* Center: logo */}
      <div className="justify-self-center">
        <Image
          src="/spy-logo/hyve-spy-logo.png"
          alt="Hyve Spy"
          width={1536}
          height={1024}
          priority
          className="h-16 w-auto sm:h-20 md:h-24"
        />
      </div>

      {/* Right: live counts / actions */}
      <div className="flex items-center justify-end gap-2 justify-self-end">
        {rightSlot}
      </div>
    </div>
  )
}
