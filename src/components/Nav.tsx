'use client'

import { useEffect, useState } from 'react'

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const apkUrl = process.env.NEXT_PUBLIC_APK_URL || '#download'

  return (
    <nav
      className={`sticky top-[32px] z-40 w-full transition-all duration-300 ${
        scrolled
          ? 'bg-black/80 backdrop-blur-xl border-b border-white/10'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <a href="#" className="flex items-center group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hyvelloo.png"
            alt="HYVE"
            className="h-10 w-auto object-contain"
          />
        </a>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-8 text-sm text-white/60 font-medium">
          <a href="#technology" className="hover:text-gold transition-colors">Technology</a>
          <a href="#location" className="hover:text-gold transition-colors">Location</a>
          <a href="#pricing" className="hover:text-gold transition-colors">Pricing</a>
          <a href="#disclaimer" className="hover:text-gold transition-colors">Beta Info</a>
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
