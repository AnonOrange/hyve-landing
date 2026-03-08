'use client'

import { useEffect, useRef } from 'react'

export default function HeroSection() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    // Reveal animation on mount
    const items = el.querySelectorAll<HTMLElement>('.reveal')
    items.forEach((item, i) => {
      setTimeout(() => item.classList.add('visible'), 100 + i * 120)
    })
  }, [])

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex flex-col items-center justify-center hex-bg overflow-hidden px-6 py-24"
    >
      {/* Full-page logo background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/HYVEComIcon.png"
          alt=""
          className="w-[700px] h-[700px] md:w-[900px] md:h-[900px] object-contain opacity-[0.04]"
          aria-hidden="true"
        />
      </div>

      {/* Radial glow on top of logo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[500px] h-[500px] rounded-full bg-gold/6 blur-[100px]" />
      </div>

      {/* Decorative orbit rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <div className="orbit w-[420px] h-[420px] rounded-full border border-gold/10" />
        <div className="orbit-reverse w-[580px] h-[580px] rounded-full border border-gold/6 absolute" />
        <div className="orbit w-[740px] h-[740px] rounded-full border border-gold/4 absolute" />
      </div>

      {/* Center hexagon icon */}
      <div className="relative mb-8 reveal">
        <div className="flex items-center justify-center w-28 h-28 gold-glow rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/HYVEComIcon.png"
            alt="HYVE"
            className="w-28 h-28 object-contain"
          />
        </div>
      </div>

      {/* Badge */}
      <div className="reveal mb-5">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-neon/30 bg-neon/5 text-neon text-xs font-semibold tracking-wider uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-neon animate-pulse-slow" />
          Beta Now Available — Android &amp; Web
        </span>
      </div>

      {/* Headline */}
      <h1 className="reveal text-center font-black text-5xl md:text-7xl leading-tight max-w-4xl mb-6">
        Privacy Isn&apos;t a Feature.{' '}
        <span className="gradient-gold gold-text-glow block md:inline">
          It&apos;s the Architecture.
        </span>
      </h1>

      {/* Subheadline */}
      <p className="reveal text-center text-white/60 text-lg md:text-xl max-w-2xl leading-relaxed mb-10">
        HYVE combines five breakthrough cryptographic protocols to make your messages
        mathematically impossible to intercept — even by us. No backdoors. No exceptions.
      </p>

      {/* CTAs */}
      <div className="reveal flex flex-col sm:flex-row gap-4">
        <a
          href="#download"
          className="btn-primary px-8 py-4 rounded-2xl text-base font-bold flex items-center gap-2 justify-center"
        >
          <AndroidIcon />
          Download Free
        </a>
        <a
          href="/app"
          className="px-8 py-4 rounded-2xl text-base font-bold flex items-center gap-2 justify-center border-2 border-neon/50 text-neon hover:bg-neon/10 hover:border-neon transition-all"
        >
          <MonitorIcon />
          Try Web App — Free
        </a>
        <a
          href="#technology"
          className="btn-outline px-8 py-4 rounded-2xl text-base font-medium text-center"
        >
          How It Works →
        </a>
      </div>

      {/* Stat strip */}
      <div className="reveal mt-16 grid grid-cols-3 gap-8 text-center">
        {[
          { label: 'Encryption Layers', value: '5' },
          { label: 'Packet Size (uniform)', value: '512B' },
          { label: 'Key Fragments (Shamir)', value: '5-of-3' },
        ].map((s) => (
          <div key={s.label}>
            <div className="text-3xl font-black gradient-gold">{s.value}</div>
            <div className="text-xs text-white/40 mt-1 tracking-wide">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function AndroidIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.523 15.341A.5.5 0 0 1 17 15.5H7a.5.5 0 0 1-.523-.159L4.5 13V8.5A5.5 5.5 0 0 1 10 3h4a5.5 5.5 0 0 1 5.5 5.5V13l-1.977 2.341zM8.5 18a1 1 0 0 0 1 1h5a1 1 0 0 0 0-2h-5a1 1 0 0 0-1 1zM7 11.5a1 1 0 1 0 2 0 1 1 0 0 0-2 0zm8 0a1 1 0 1 0 2 0 1 1 0 0 0-2 0z" />
    </svg>
  )
}

function MonitorIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  )
}
