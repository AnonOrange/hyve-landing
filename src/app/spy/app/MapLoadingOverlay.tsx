'use client';

// Full-screen loading overlay for map pages with large datasets. Sets the
// expectation that pulling 50-200k markers is doing real work, not stuck.
// Visual is a tactical radar sweep — concentric rings, rotating sweep arm,
// pulsing target blips that spawn at random angles and fade out. On-brand
// for the scanner aesthetic and visually busy enough that nobody mistakes
// it for a frozen UI.

import { useEffect, useState } from 'react';

type Props = {
  visible: boolean;
  expectedCount?: number;
  layerName?: string;
  accent?: string;
};

type Blip = { id: number; angle: number; radius: number; bornAt: number };

export default function MapLoadingOverlay({
  visible,
  expectedCount,
  layerName = 'records',
  accent = '#00D4FF',
}: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [blips, setBlips] = useState<Blip[]>([]);

  useEffect(() => {
    if (!visible) {
      setElapsed(0);
      setBlips([]);
      return;
    }
    const tickElapsed = setInterval(() => setElapsed((e) => e + 1), 1000);

    // Spawn random blips as the sweep arm "detects targets"
    let nextId = 0;
    const spawnBlip = () => {
      const id = nextId++;
      const blip: Blip = {
        id,
        angle: Math.random() * 360,
        radius: 15 + Math.random() * 30,
        bornAt: Date.now(),
      };
      setBlips((prev) => [...prev.filter((b) => Date.now() - b.bornAt < 1500), blip]);
    };
    const tickBlips = setInterval(spawnBlip, 280);

    return () => {
      clearInterval(tickElapsed);
      clearInterval(tickBlips);
    };
  }, [visible]);

  if (!visible) return null;

  const countLabel = expectedCount
    ? `~${expectedCount.toLocaleString()} ${layerName} records`
    : `${layerName} records`;

  // Convert hex accent to rgb for rgba() use in shadows / blip glows
  const r = parseInt(accent.slice(1, 3), 16);
  const g = parseInt(accent.slice(3, 5), 16);
  const b = parseInt(accent.slice(5, 7), 16);
  const rgba = (a: number) => `rgba(${r},${g},${b},${a})`;

  return (
    <div className="pointer-events-none absolute inset-0 z-[1500] flex items-center justify-center bg-[#020D14]/85 backdrop-blur-sm">
      <div
        className="pointer-events-auto max-w-sm rounded-lg border bg-[#020D14] p-6 text-center"
        style={{ borderColor: accent, boxShadow: `0 0 32px ${rgba(0.25)}` }}
      >
        {/* RADAR SWEEP — the centerpiece animation */}
        <div className="relative mx-auto mb-4 h-32 w-32">
          <svg
            viewBox="-50 -50 100 100"
            className="absolute inset-0 h-full w-full"
            style={{ overflow: 'visible' }}
          >
            <defs>
              {/* Sweep arm gradient: opaque at leading edge, fading to transparent at trailing edge */}
              <linearGradient id="sweepGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={accent} stopOpacity="0" />
                <stop offset="50%" stopColor={accent} stopOpacity="0.15" />
                <stop offset="100%" stopColor={accent} stopOpacity="0.7" />
              </linearGradient>
              {/* Glow for the rings */}
              <radialGradient id="ringGlow">
                <stop offset="60%" stopColor="transparent" />
                <stop offset="100%" stopColor={accent} stopOpacity="0.05" />
              </radialGradient>
            </defs>

            {/* Background glow */}
            <circle cx="0" cy="0" r="50" fill="url(#ringGlow)" />

            {/* Concentric rings — pulse subtly */}
            <circle cx="0" cy="0" r="46" fill="none" stroke={rgba(0.18)} strokeWidth="0.5" />
            <circle cx="0" cy="0" r="32" fill="none" stroke={rgba(0.14)} strokeWidth="0.5">
              <animate attributeName="r" values="32;33;32" dur="3s" repeatCount="indefinite" />
              <animate attributeName="stroke-opacity" values="0.14;0.28;0.14" dur="3s" repeatCount="indefinite" />
            </circle>
            <circle cx="0" cy="0" r="18" fill="none" stroke={rgba(0.12)} strokeWidth="0.5">
              <animate attributeName="r" values="18;19;18" dur="2s" repeatCount="indefinite" />
              <animate attributeName="stroke-opacity" values="0.12;0.3;0.12" dur="2s" repeatCount="indefinite" />
            </circle>

            {/* Crosshairs */}
            <line x1="-46" y1="0" x2="46" y2="0" stroke={rgba(0.1)} strokeWidth="0.4" />
            <line x1="0" y1="-46" x2="0" y2="46" stroke={rgba(0.1)} strokeWidth="0.4" />

            {/* Sweep arm: a 90deg pie slice with the gradient, rotating around origin */}
            <g style={{ transformOrigin: '0 0', animation: 'hyveSweep 2.4s linear infinite' }}>
              <path d="M 0 0 L 46 0 A 46 46 0 0 1 32.5 32.5 Z" fill="url(#sweepGrad)" />
              {/* Bright leading edge */}
              <line x1="0" y1="0" x2="46" y2="0" stroke={accent} strokeWidth="0.8" />
            </g>

            {/* Center dot */}
            <circle cx="0" cy="0" r="1.5" fill={accent}>
              <animate attributeName="opacity" values="1;0.4;1" dur="1.2s" repeatCount="indefinite" />
            </circle>

            {/* Random target "blips" — fade in then out as sweep "detects" them */}
            {blips.map((blip) => {
              const x = blip.radius * Math.cos((blip.angle * Math.PI) / 180);
              const y = blip.radius * Math.sin((blip.angle * Math.PI) / 180);
              return (
                <g key={blip.id}>
                  <circle cx={x} cy={y} r="1.2" fill={accent}>
                    <animate attributeName="opacity" values="1;0" dur="1.4s" fill="freeze" />
                    <animate attributeName="r" values="1.2;3;1" dur="1.4s" fill="freeze" />
                  </circle>
                </g>
              );
            })}
          </svg>
        </div>

        <style jsx>{`
          @keyframes hyveSweep {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>

        <div className="mb-1 font-mono text-[10px] tracking-[0.4em]" style={{ color: accent }}>
          SCANNING
        </div>
        <div className="mb-4 text-base font-bold text-white">
          Pulling {countLabel}
        </div>

        <p className="mb-3 text-xs leading-relaxed text-[#94A3B8]">
          Fetching hundreds of thousands of locations and live data points
          across the country in a single pass, then handing them to the map
          engine to cluster.
        </p>

        <p className="mb-4 font-mono text-[11px] italic text-[#64748B]">
          Patience is a virtue. <span style={{ color: accent }}>{elapsed}s</span> elapsed.
        </p>

        {/* Animated progress bar — indeterminate, sweeps left-to-right continuously */}
        <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-[#0D2235]">
          <div
            className="h-full rounded-full"
            style={{
              width: '40%',
              background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
              animation: 'hyveProgress 1.6s ease-in-out infinite',
            }}
          />
        </div>
        <style jsx>{`
          @keyframes hyveProgress {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(350%); }
          }
        `}</style>

        <p className="font-mono text-[9px] uppercase tracking-widest text-[#475569]">
          5–15 sec typical · longer on mobile
        </p>
      </div>
    </div>
  );
}
