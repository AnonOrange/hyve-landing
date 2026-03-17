'use client'

import { useEffect, useState } from 'react'

// Promo deadline: 3 months from launch (June 16, 2026)
const DEADLINE = new Date('2026-06-16T23:59:59Z')

function useCountdown(target: Date) {
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, target.getTime() - Date.now()))

  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(Math.max(0, target.getTime() - Date.now()))
    }, 1000)
    return () => clearInterval(id)
  }, [target])

  const days    = Math.floor(timeLeft / 86_400_000)
  const hours   = Math.floor((timeLeft % 86_400_000) / 3_600_000)
  const minutes = Math.floor((timeLeft % 3_600_000)  / 60_000)
  const seconds = Math.floor((timeLeft % 60_000)      / 1_000)

  return { days, hours, minutes, seconds, expired: timeLeft === 0 }
}

function Digit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-black/60 border border-gold/30 flex items-center justify-center">
        <span className="text-2xl md:text-3xl font-black gradient-gold tabular-nums">
          {String(value).padStart(2, '0')}
        </span>
      </div>
      <span className="text-[10px] text-white/40 mt-1 uppercase tracking-widest">{label}</span>
    </div>
  )
}

export default function FoundersDeal() {
  const { days, hours, minutes, seconds, expired } = useCountdown(DEADLINE)

  if (expired) return null

  return (
    <section className="relative py-16 px-6 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-gold/8 via-transparent to-neon/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-gold/10 blur-[80px]" />
      </div>

      <div className="relative max-w-4xl mx-auto">
        {/* Bordered card */}
        <div className="rounded-3xl border border-gold/40 bg-black/70 backdrop-blur-sm p-8 md:p-12 shadow-[0_0_60px_rgba(255,184,0,0.12)]">

          {/* Top badge */}
          <div className="flex justify-center mb-6">
            <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gold text-black text-xs font-black tracking-widest uppercase shadow-[0_0_20px_rgba(255,184,0,0.5)]">
              <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
              Founders Offer — Limited Time
            </span>
          </div>

          {/* Headline */}
          <h2 className="text-center text-4xl md:text-5xl font-black text-white leading-tight mb-3">
            Get <span className="gradient-gold gold-text-glow">Lifetime Pro</span> Access
          </h2>
          <p className="text-center text-white/60 text-lg max-w-2xl mx-auto mb-8">
            Subscribe to the Annual plan before the timer runs out and your Pro access
            never expires — free updates and all future features, forever.
          </p>

          {/* Countdown */}
          <div className="flex justify-center gap-3 md:gap-4 mb-10">
            <Digit value={days}    label="Days"    />
            <div className="text-3xl font-black text-gold/60 self-start mt-3">:</div>
            <Digit value={hours}   label="Hours"   />
            <div className="text-3xl font-black text-gold/60 self-start mt-3">:</div>
            <Digit value={minutes} label="Mins"    />
            <div className="text-3xl font-black text-gold/60 self-start mt-3">:</div>
            <Digit value={seconds} label="Secs"    />
          </div>

          {/* Feature list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto mb-10">
            {[
              'End-to-end encrypted calls',
              'Live encrypted location sharing',
              'All future features — free forever',
              'Encrypted media transfer',
              'No subscription renewal needed',
              'Lock in at today\'s price',
            ].map((f) => (
              <div key={f} className="flex items-center gap-3 text-sm text-white/70">
                <span className="text-gold flex-shrink-0">✦</span>
                {f}
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="flex flex-col items-center gap-3">
            <a
              href="#pricing"
              className="btn-primary px-10 py-4 rounded-2xl text-base font-black tracking-wide shadow-[0_0_30px_rgba(255,184,0,0.3)] hover:shadow-[0_0_50px_rgba(255,184,0,0.5)] transition-shadow"
            >
              Claim Lifetime Access — $59.88
            </a>
            <p className="text-xs text-white/30">
              One-time annual payment · Offer ends June 16, 2026 · Annual plan only
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
