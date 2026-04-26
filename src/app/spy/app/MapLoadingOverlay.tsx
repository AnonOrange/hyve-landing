'use client';

// Full-screen loading overlay for map pages with large datasets. Sets the
// expectation that pulling 50-200k markers is doing real work, not stuck.
//
// Used by: surveillance (164k), offenders (97k), crime (15k), world (24k).
// Each tab passes its expected record count + a color so the spinner matches
// the page's accent.

import { useEffect, useState } from 'react';

type Props = {
  visible: boolean;
  expectedCount?: number;       // approximate target — shown in the message
  layerName?: string;           // 'surveillance' / 'offender' / 'crime' / 'world'
  accent?: string;              // hex color
};

export default function MapLoadingOverlay({
  visible,
  expectedCount,
  layerName = 'records',
  accent = '#00D4FF',
}: Props) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!visible) {
      setElapsed(0);
      return;
    }
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [visible]);

  if (!visible) return null;

  const countLabel = expectedCount
    ? `~${expectedCount.toLocaleString()} ${layerName} records`
    : `${layerName} records`;

  return (
    <div className="pointer-events-none absolute inset-0 z-[1500] flex items-center justify-center bg-[#020D14]/85 backdrop-blur-sm">
      <div className="pointer-events-auto max-w-sm rounded-lg border bg-[#020D14] p-6 text-center" style={{ borderColor: accent }}>
        {/* Spinner */}
        <div className="mx-auto mb-4 h-12 w-12">
          <svg className="animate-spin" viewBox="0 0 50 50" fill="none">
            <circle cx="25" cy="25" r="20" stroke={accent} strokeOpacity="0.2" strokeWidth="4" />
            <path
              d="M 25 5 a 20 20 0 0 1 0 40"
              stroke={accent}
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </div>

        <div className="mb-1 font-mono text-[10px] tracking-[0.4em]" style={{ color: accent }}>
          LOADING
        </div>
        <div className="mb-4 text-base font-bold text-white">
          Pulling {countLabel}
        </div>

        <p className="mb-3 text-xs leading-relaxed text-[#94A3B8]">
          We&apos;re fetching hundreds of thousands of locations and live data
          points across the country in one shot, then handing them to the map
          engine to cluster.
        </p>

        <p className="mb-4 font-mono text-[11px] italic text-[#64748B]">
          Patience is a virtue. ({elapsed}s elapsed)
        </p>

        <p className="font-mono text-[9px] uppercase tracking-widest text-[#475569]">
          5–15 sec typical · longer on mobile
        </p>
      </div>
    </div>
  );
}
