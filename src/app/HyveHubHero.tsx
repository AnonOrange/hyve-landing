'use client'

// Hero animation for the new umbrella homepage. The big gold HYVE logo
// breathes (subtle scale + glow pulse), with rotating orbital rings, a
// drifting honeycomb shimmer behind it, and a slow rotating stroked
// hexagon at the outer ring. All CSS — no canvas, no Framer Motion, no
// GSAP, so the homepage stays statically rendered + fast.

import Image from 'next/image'

export default function HyveHubHero() {
  return (
    <section className="relative z-10 mx-auto flex min-h-[90vh] max-w-7xl flex-col items-center justify-center px-6 py-20 text-center">
      {/* Outermost slow-rotating dashed hex — 1100px, eerie green */}
      <div className="absolute pointer-events-none" style={{ width: 1100, height: 1100, animation: 'hyveSpin 80s linear infinite' }}>
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <polygon
            points="50,2 95,26 95,74 50,98 5,74 5,26"
            fill="none"
            stroke="#22FF66"
            strokeWidth="0.15"
            strokeDasharray="1 3"
            opacity="0.18"
          />
        </svg>
      </div>
      {/* Outer rotating stroked hexagon — solid */}
      <div className="absolute pointer-events-none" style={{ width: 920, height: 920, animation: 'hyveSpinReverse 60s linear infinite' }}>
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <polygon
            points="50,2 95,26 95,74 50,98 5,74 5,26"
            fill="none"
            stroke="#22FF66"
            strokeWidth="0.25"
            opacity="0.35"
          />
        </svg>
      </div>
      {/* Inner counter-rotating thinner hex */}
      <div className="absolute pointer-events-none" style={{ width: 760, height: 760, animation: 'hyveSpin 45s linear infinite' }}>
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <polygon
            points="50,2 95,26 95,74 50,98 5,74 5,26"
            fill="none"
            stroke="#4ADE80"
            strokeWidth="0.2"
            strokeDasharray="2 4"
            opacity="0.45"
          />
        </svg>
      </div>
      {/* Innermost solid hex outlining the emblem */}
      <div className="absolute pointer-events-none" style={{ width: 600, height: 600, animation: 'hyveSpinReverse 30s linear infinite' }}>
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <polygon
            points="50,2 95,26 95,74 50,98 5,74 5,26"
            fill="none"
            stroke="#22FF66"
            strokeWidth="0.15"
            opacity="0.25"
          />
        </svg>
      </div>

      {/* Layered eerie green glow — three radial gradients pulsing out of phase */}
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          width: 900,
          height: 900,
          background: 'radial-gradient(circle, rgba(34,255,102,0.35) 0%, rgba(74,222,128,0.18) 30%, transparent 65%)',
          filter: 'blur(60px)',
          animation: 'hyveGlow 4s ease-in-out infinite',
        }}
      />
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          width: 700,
          height: 700,
          background: 'radial-gradient(circle, rgba(34,255,102,0.25) 0%, transparent 60%)',
          filter: 'blur(40px)',
          animation: 'hyveGlow2 7s ease-in-out infinite',
          animationDelay: '1.5s',
        }}
      />
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          width: 500,
          height: 500,
          background: 'radial-gradient(circle, rgba(34,255,102,0.4) 0%, transparent 55%)',
          filter: 'blur(20px)',
          animation: 'hyveGlowFlicker 0.18s steps(2) infinite',
        }}
      />

      {/* Expanding shockwave rings — emanate outward */}
      {[0, 1.3, 2.6].map((delay, i) => (
        <div
          key={i}
          className="absolute pointer-events-none rounded-full border"
          style={{
            width: 480,
            height: 480,
            borderColor: '#22FF66',
            borderWidth: 1,
            opacity: 0,
            animation: 'hyveShockwave 4s ease-out infinite',
            animationDelay: `${delay}s`,
          }}
        />
      ))}

      {/*
        Hero emblem — 2x larger (was max-w 360, now 720). Combines:
          - dramatic breath (scale 1 → 1.05) on a 4s cycle
          - subtle continuous slow rotation (180s — almost imperceptible
            but adds life when staring at it)
          - flickering green drop-shadow (3 stacked shadows of different
            blur radii, layered for the "eerie haunted" feel)
          - hue-rotate flicker every few seconds for an unsettling pulse
      */}
      <div
        className="relative w-full max-w-[720px]"
        style={{
          animation: 'hyveBreathe 4s ease-in-out infinite, hyveDrift 180s linear infinite',
          filter:
            'drop-shadow(0 0 30px rgba(34,255,102,0.85)) drop-shadow(0 0 80px rgba(34,255,102,0.55)) drop-shadow(0 0 160px rgba(34,255,102,0.35))',
        }}
      >
        <Image
          src="/hyve-logo/hyve-emblem-hero.png"
          alt="HYVE"
          width={1536}
          height={1024}
          priority
          sizes="(max-width: 768px) 95vw, 720px"
          className="h-auto w-full"
          style={{ animation: 'hyveFlicker 5s steps(8) infinite' }}
        />
      </div>

      {/* Vertical scan line passing over the emblem — sci-fi sweep */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 720,
          height: 720,
          background:
            'linear-gradient(180deg, transparent 0%, transparent 47%, rgba(34,255,102,0.5) 50%, transparent 53%, transparent 100%)',
          backgroundSize: '100% 200%',
          animation: 'hyveScan 5s linear infinite',
          mixBlendMode: 'screen',
          opacity: 0.7,
        }}
      />

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

      {/* Drifting green ember particles — denser + faster than the old gold field */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 32 }).map((_, i) => (
          <span
            key={i}
            className="absolute block rounded-full"
            style={{
              width: 1 + (i % 4),
              height: 1 + (i % 4),
              left: `${(i * 53) % 100}%`,
              top: `${(i * 37) % 100}%`,
              background: i % 5 === 0 ? '#4ADE80' : '#22FF66',
              boxShadow: `0 0 ${4 + (i % 6)}px #22FF66`,
              opacity: 0.7,
              filter: 'blur(0.4px)',
              animation: `hyveEmber ${10 + (i % 5) * 3}s linear infinite`,
              animationDelay: `${i * 0.4}s`,
            }}
          />
        ))}
      </div>

      {/* Animation keyframes — co-located with the component for portability.
          Note the multi-stop hyveBreathe: a more dramatic curve than a simple
          sine, giving the emblem a held-deep-breath feel rather than a
          pendulum sway. */}
      <style jsx>{`
        @keyframes hyveBreathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes hyveDrift {
          to { transform: rotate(360deg); }
        }
        @keyframes hyveFlicker {
          0%, 100% { filter: brightness(1) hue-rotate(0deg); }
          20% { filter: brightness(1.2) hue-rotate(-8deg); }
          40% { filter: brightness(0.92) hue-rotate(4deg); }
          60% { filter: brightness(1.15) hue-rotate(-2deg); }
          80% { filter: brightness(1.05) hue-rotate(6deg); }
        }
        @keyframes hyveGlow {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.12); }
        }
        @keyframes hyveGlow2 {
          0%, 100% { opacity: 0.4; transform: scale(0.95) rotate(0deg); }
          50% { opacity: 0.85; transform: scale(1.18) rotate(20deg); }
        }
        @keyframes hyveGlowFlicker {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 0.4; }
        }
        @keyframes hyveSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes hyveSpinReverse {
          to { transform: rotate(-360deg); }
        }
        @keyframes hyveShockwave {
          0% { transform: scale(0.8); opacity: 0.7; }
          80% { opacity: 0.15; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes hyveScan {
          0% { background-position: 0 -100%; }
          100% { background-position: 0 100%; }
        }
        @keyframes hyveEmber {
          0% { transform: translate(0, 0); opacity: 0; }
          10% { opacity: 0.85; }
          90% { opacity: 0.85; }
          100% { transform: translate(60px, -180px); opacity: 0; }
        }
      `}</style>
    </section>
  )
}
