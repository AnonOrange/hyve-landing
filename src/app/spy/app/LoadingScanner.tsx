'use client';

// Self-contained route-transition loader used by Next.js App Router's
// loading.tsx convention. Same radar-sweep aesthetic as MapLoadingOverlay
// but full-page (used while a new route's data is fetching server-side).
//
// The actual MapLoadingOverlay is reserved for in-page data loads where
// the chrome (header, nav) should stay rendered around the spinner.

import { useEffect, useState } from 'react';

type Blip = { id: number; angle: number; radius: number; bornAt: number };

export default function LoadingScanner({
  subtitle = 'LOADING',
  message = 'Pulling data',
  accent = '#00D4FF',
}: {
  subtitle?: string;
  message?: string;
  accent?: string;
}) {
  const [blips, setBlips] = useState<Blip[]>([]);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let nextId = 0;
    const tickElapsed = setInterval(() => setElapsed((e) => e + 1), 1000);
    const tickBlips = setInterval(() => {
      const blip: Blip = {
        id: nextId++,
        angle: Math.random() * 360,
        radius: 15 + Math.random() * 30,
        bornAt: Date.now(),
      };
      setBlips((prev) => [...prev.filter((b) => Date.now() - b.bornAt < 1500), blip]);
    }, 280);
    return () => { clearInterval(tickElapsed); clearInterval(tickBlips); };
  }, []);

  const r = parseInt(accent.slice(1, 3), 16);
  const g = parseInt(accent.slice(3, 5), 16);
  const b = parseInt(accent.slice(5, 7), 16);
  const rgba = (a: number) => `rgba(${r},${g},${b},${a})`;

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#020D14]">
      <div className="rounded-lg border bg-[#020D14] p-6 text-center" style={{ borderColor: accent, boxShadow: `0 0 32px ${rgba(0.25)}` }}>
        <div className="relative mx-auto mb-4 h-32 w-32">
          <svg viewBox="-50 -50 100 100" className="absolute inset-0 h-full w-full" style={{ overflow: 'visible' }}>
            <defs>
              <linearGradient id="lsSweep" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={accent} stopOpacity="0" />
                <stop offset="50%" stopColor={accent} stopOpacity="0.15" />
                <stop offset="100%" stopColor={accent} stopOpacity="0.7" />
              </linearGradient>
              <radialGradient id="lsRingGlow">
                <stop offset="60%" stopColor="transparent" />
                <stop offset="100%" stopColor={accent} stopOpacity="0.05" />
              </radialGradient>
            </defs>
            <circle cx="0" cy="0" r="50" fill="url(#lsRingGlow)" />
            <circle cx="0" cy="0" r="46" fill="none" stroke={rgba(0.18)} strokeWidth="0.5" />
            <circle cx="0" cy="0" r="32" fill="none" stroke={rgba(0.14)} strokeWidth="0.5">
              <animate attributeName="r" values="32;33;32" dur="3s" repeatCount="indefinite" />
            </circle>
            <circle cx="0" cy="0" r="18" fill="none" stroke={rgba(0.12)} strokeWidth="0.5">
              <animate attributeName="r" values="18;19;18" dur="2s" repeatCount="indefinite" />
            </circle>
            <line x1="-46" y1="0" x2="46" y2="0" stroke={rgba(0.1)} strokeWidth="0.4" />
            <line x1="0" y1="-46" x2="0" y2="46" stroke={rgba(0.1)} strokeWidth="0.4" />
            <g style={{ transformOrigin: '0 0', animation: 'hyveSweepLs 2.4s linear infinite' }}>
              <path d="M 0 0 L 46 0 A 46 46 0 0 1 32.5 32.5 Z" fill="url(#lsSweep)" />
              <line x1="0" y1="0" x2="46" y2="0" stroke={accent} strokeWidth="0.8" />
            </g>
            <circle cx="0" cy="0" r="1.5" fill={accent}>
              <animate attributeName="opacity" values="1;0.4;1" dur="1.2s" repeatCount="indefinite" />
            </circle>
            {blips.map((blip) => {
              const x = blip.radius * Math.cos((blip.angle * Math.PI) / 180);
              const y = blip.radius * Math.sin((blip.angle * Math.PI) / 180);
              return (
                <circle key={blip.id} cx={x} cy={y} r="1.2" fill={accent}>
                  <animate attributeName="opacity" values="1;0" dur="1.4s" fill="freeze" />
                  <animate attributeName="r" values="1.2;3;1" dur="1.4s" fill="freeze" />
                </circle>
              );
            })}
          </svg>
        </div>
        <style jsx>{`
          @keyframes hyveSweepLs {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes hyveProgressLs {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(350%); }
          }
        `}</style>
        <div className="mb-1 font-mono text-[10px] tracking-[0.4em]" style={{ color: accent }}>{subtitle}</div>
        <div className="mb-4 text-base font-bold text-white">{message}</div>
        <p className="mb-4 font-mono text-[11px] italic text-[#64748B]">
          Patience is a virtue. <span style={{ color: accent }}>{elapsed}s</span>
        </p>
        <div className="h-1 w-full overflow-hidden rounded-full bg-[#0D2235]">
          <div className="h-full rounded-full" style={{
            width: '40%',
            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
            animation: 'hyveProgressLs 1.6s ease-in-out infinite',
          }} />
        </div>
      </div>
    </div>
  );
}
