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
