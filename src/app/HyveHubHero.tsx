'use client'

// Hero animation for the new umbrella homepage. The big gold HYVE logo
// breathes (subtle scale + glow pulse), with rotating orbital rings, a
// drifting honeycomb shimmer behind it, and a slow rotating stroked
// hexagon at the outer ring. All CSS — no canvas, no Framer Motion, no
// GSAP, so the homepage stays statically rendered + fast.

import Image from 'next/image'

export default function HyveHubHero() {
  return (
    <section className="relative z-10 mx-auto flex min-h-[80vh] max-w-7xl flex-col items-center justify-center px-6 py-20 text-center">
      {/* Outer rotating stroked hexagon — large + slow */}
      <div className="absolute pointer-events-none" style={{ width: 720, height: 720, animation: 'hyveSpin 60s linear infinite' }}>
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <polygon
            points="50,2 95,26 95,74 50,98 5,74 5,26"
            fill="none"
            stroke="#C8A227"
            strokeWidth="0.3"
            opacity="0.25"
          />
        </svg>
      </div>
      {/* Inner counter-rotating thinner hex */}
      <div className="absolute pointer-events-none" style={{ width: 540, height: 540, animation: 'hyveSpinReverse 90s linear infinite' }}>
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <polygon
            points="50,2 95,26 95,74 50,98 5,74 5,26"
            fill="none"
            stroke="#E8C456"
            strokeWidth="0.2"
            strokeDasharray="2 4"
            opacity="0.3"
          />
        </svg>
      </div>

      {/* Pulsing radial glow */}
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          width: 600,
          height: 600,
          background: 'radial-gradient(circle, rgba(232,196,86,0.25) 0%, rgba(200,162,39,0.15) 30%, transparent 65%)',
          filter: 'blur(40px)',
          animation: 'hyveGlow 6s ease-in-out infinite',
        }}
      />

      {/*
        The logo — breathes with a subtle scale + brightness pulse.
        Clip-path: hexagon shape matching the logo's hex emblem outline.
        Container is square + object-cover so the 1536×1024 source image
        crops to its center column (where the emblem lives), then the
        clip-path trims the leftover corners to a clean hexagon. Net
        effect: just the gold HYVE hexagon floating on dark, no
        rectangular background showing through.
      */}
      <div
        className="relative aspect-square w-full max-w-[560px]"
        style={{
          animation: 'hyveBreathe 6s ease-in-out infinite',
          filter: 'drop-shadow(0 0 60px rgba(200,162,39,0.45))',
        }}
      >
        <Image
          src="/hyve-logo/hyve-main.png"
          alt="HYVE"
          fill
          priority
          sizes="(max-width: 768px) 90vw, 560px"
          className="object-cover"
          style={{
            // Pointed-top hexagon clip — points at top/bottom, flat sides.
            // 50%,0%  92%,25%  92%,75%  50%,100%  8%,75%  8%,25%
            clipPath:
              'polygon(50% 0%, 92% 25%, 92% 75%, 50% 100%, 8% 75%, 8% 25%)',
            // Slight zoom so the clip area lands precisely on the emblem,
            // not on the dark hex-grid frame around it.
            transform: 'scale(1.18)',
          }}
        />
      </div>

      {/* Tagline */}
      <div className="relative mt-10 max-w-2xl">
        <div
          className="font-mono text-[11px] tracking-[0.5em]"
          style={{
            background: 'linear-gradient(135deg, #C8A227 0%, #E8C456 50%, #C8A227 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
          }}
        >
          ONE ECOSYSTEM · EVERY APP
        </div>
        <h1 className="mt-4 text-4xl font-black leading-[1.05] tracking-tight md:text-6xl">
          <span className="text-[#ede8d8]">Built different. </span>
          <span
            style={{
              background: 'linear-gradient(110deg, #C8A227 0%, #E8C456 50%, #C8A227 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
            }}
          >
            All under one Hyve.
          </span>
        </h1>
        <p className="mt-6 text-base text-[#9e8a55] md:text-lg">
          Hyve Spy · Hyve Messenger · Hyve Sleuth · Hyve Residential · Hyve Sentinel · Hyve Alpha · Hyve Cares.
          Privacy-first. Public-record-fueled. Real tools, not data brokers.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="#apps"
            className="rounded px-6 py-3 text-sm font-black tracking-widest text-[#1a1200] transition hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, #C8A227, #E8C456)',
              boxShadow: '0 0 60px -10px rgba(200,162,39,0.5), 0 0 140px -40px rgba(232,196,86,0.6)',
            }}
          >
            EXPLORE APPS ↓
          </a>
          <a
            href="/spy"
            className="rounded border border-[#C8A227] bg-transparent px-6 py-3 text-sm font-black tracking-widest text-[#E8C456] transition hover:bg-[#C8A227]/10"
          >
            FLAGSHIP: HYVE SPY →
          </a>
        </div>
      </div>

      {/* Drifting gold particles — pure CSS, no JS */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="absolute block rounded-full bg-[#E8C456]"
            style={{
              width: 2 + (i % 3),
              height: 2 + (i % 3),
              left: `${(i * 53) % 100}%`,
              top: `${(i * 37) % 100}%`,
              opacity: 0.5,
              filter: 'blur(0.5px)',
              animation: `hyveDrift ${15 + (i % 5) * 4}s linear infinite`,
              animationDelay: `${i * 0.6}s`,
            }}
          />
        ))}
      </div>

      {/* Animation keyframes — co-located with the component for portability */}
      <style jsx>{`
        @keyframes hyveBreathe {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.025); filter: brightness(1.1); }
        }
        @keyframes hyveGlow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(1.1); }
        }
        @keyframes hyveSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes hyveSpinReverse {
          to { transform: rotate(-360deg); }
        }
        @keyframes hyveDrift {
          0% { transform: translate(0, 0); opacity: 0; }
          10% { opacity: 0.6; }
          90% { opacity: 0.6; }
          100% { transform: translate(40px, -120px); opacity: 0; }
        }
      `}</style>
    </section>
  )
}
