'use client';

// Inline freshness indicator — fetches /cron/cameras-freshness and renders
// "Refreshed 12m ago · 4h cycle" in mono. Surfaces on the cameras + world-cams
// grids so users see the live commitment, not just marketing copy.

import { useEffect, useState } from 'react';

const API_BASE = 'https://hyve-api.vercel.app';

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const sec = Math.max(0, (Date.now() - t) / 1000);
  if (sec < 60) return `${Math.floor(sec)}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export default function FreshnessBadge({ accent = '#22C55E' }: { accent?: string }) {
  const [last, setLast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/cron/cameras-freshness`)
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setLast(j?.lastRefresh || null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="font-mono text-[9px] tracking-widest" style={{ color: accent }}>
      {last ? `REFRESHED ${timeAgo(last).toUpperCase()} · 4H CYCLE` : 'AUTO-REFRESH · 4H CYCLE'}
    </div>
  );
}
