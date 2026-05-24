'use client'

// Responsive top nav for the Attend section.
//
// Desktop (sm+): inline links, same as before.
// Mobile (< sm): the inline links would overflow the row (wide letter
// spacing + 3 labels + logo + beta pill exceed the viewport), so they
// collapse behind a hamburger toggle. The layout stays a server
// component; this is the only client island in the chrome.
import { useState } from 'react'
import Link from 'next/link'
import { ATTEND_BETA_MODE } from '@/lib/attend/config'

const NAV = [
  { href: '/attend/events', label: 'DISCOVER' },
  { href: '/attend/wallet', label: 'WALLET' },
  { href: '/attend/creator', label: 'CREATE' },
]

export default function AttendNav() {
  const [open, setOpen] = useState(false)

  return (
    <header className="relative mx-auto max-w-7xl px-6 py-4 sm:py-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/attend"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2 whitespace-nowrap"
        >
          <span className="text-sm font-black tracking-[0.2em] text-[#E8C456] sm:tracking-[0.3em]">
            HYVE ATTEND
          </span>
          {ATTEND_BETA_MODE && (
            <span className="rounded-full border border-[#E8C456] bg-[#E8C456]/10 px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.2em] text-[#E8C456]">
              Beta
            </span>
          )}
        </Link>

        {/* Desktop inline nav */}
        <nav className="hidden gap-5 text-xs font-bold tracking-[0.2em] text-[#9e8a55] sm:flex">
          {NAV.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-[#E8C456]">
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Mobile hamburger / close toggle */}
        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-[#2a2135] text-[#E8C456] transition hover:border-[#E8C456] sm:hidden"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            {open ? (
              <>
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile dropdown panel */}
      {open && (
        <nav className="mt-3 flex flex-col gap-1 border-t border-[#2a2135] pt-3 sm:hidden">
          {NAV.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rounded px-2 py-2.5 text-sm font-bold tracking-[0.2em] text-[#9e8a55] transition hover:bg-[#0E1E3A] hover:text-[#E8C456]"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}
