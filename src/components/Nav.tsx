'use client'

import { useEffect, useState } from 'react'

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const apkUrl = process.env.NEXT_PUBLIC_APK_URL || 'https://github.com/AnonOrange/hyve-landing/releases/download/v1.2.0/HYVE-v1.2.0.apk'

  return (
    <nav
      className={`sticky top-[32px] z-40 w-full transition-all duration-300 ${
        scrolled
          ? 'bg-black/80 backdrop-blur-xl border-b border-white/10'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo — clicks back to the umbrella hub at /, not the messenger root */}
        <a href="/" className="flex items-center gap-2 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hyve-logo/hyve-messenger.png"
            alt="HYVE Messenger"
            className="h-10 w-auto object-contain"
          />
        </a>

        {/* Nav links — section anchors first, then ecosystem links */}
        <div className="hidden md:flex items-center gap-6 text-sm text-white/60 font-medium">
          <a href="#technology" className="hover:text-gold transition-colors">Technology</a>
          <a href="#pricing" className="hover:text-gold transition-colors">Pricing</a>
          <a href="#disclaimer" className="hover:text-gold transition-colors">Beta Info</a>
          <span className="text-white/20">·</span>
          <a href="/" className="hover:text-gold transition-colors">All Apps</a>
          <a
            href="/spy"
            className="flex items-center gap-1.5 rounded-md border border-amber-400/40 bg-amber-400/5 px-3 py-1 font-bold tracking-wide text-amber-300 hover:border-amber-400 hover:bg-amber-400/10 hover:text-amber-200 transition-all"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
            </span>
            HYVE SPY
          </a>
          <a href="https://www.hyvealpha.com" target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors">
            Alpha ↗
          </a>
          <a href="https://www.hyvecares.org" target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors">
            Cares ↗
          </a>
          <a href="https://www.hyvetribe.com" target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors">
            Tribe ↗
          </a>
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-3">
          <a
            href="/app"
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-neon/40 text-neon hover:bg-neon/10 transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            Open Web App
          </a>
          <a
            href="#pricing"
            className="btn-primary px-5 py-2 rounded-xl text-sm font-bold"
          >
            Get HYVE
          </a>
        </div>
      </div>
    </nav>
  )
}
