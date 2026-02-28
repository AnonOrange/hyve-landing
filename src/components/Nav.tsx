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
        <a href="#" className="flex items-center gap-2 group">
          {/* Hexagon H mark */}
          <div className="relative w-9 h-9 flex items-center justify-center">
            <svg viewBox="0 0 36 36" className="w-9 h-9 absolute inset-0">
              <polygon
                points="18,2 33,10 33,26 18,34 3,26 3,10"
                fill="none"
                stroke="url(#navGrad)"
                strokeWidth="1.5"
              />
              <defs>
                <linearGradient id="navGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#39FF14" />
                  <stop offset="100%" stopColor="#FFB800" />
                </linearGradient>
              </defs>
            </svg>
            <span className="relative font-black text-gold text-sm leading-none">H</span>
          </div>
          <span className="font-black text-xl text-white tracking-tight group-hover:text-gold transition-colors">
            HYVE
          </span>
        </a>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-8 text-sm text-white/60 font-medium">
          <a href="#technology" className="hover:text-gold transition-colors">Technology</a>
          <a href="#download" className="hover:text-gold transition-colors">Download</a>
          <a href="#disclaimer" className="hover:text-gold transition-colors">Beta Info</a>
          <a href="#report" className="hover:text-gold transition-colors">Report a Problem</a>
        </div>

        {/* CTA */}
        <a
          href={apkUrl}
          download
          className="btn-primary px-5 py-2 rounded-xl text-sm font-bold"
        >
          Download Beta
        </a>
      </div>
    </nav>
  )
}
