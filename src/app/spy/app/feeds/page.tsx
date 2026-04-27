'use client';

// Feeds list — pulls from the Supabase-backed /api/realtime/feeds cache.
// Refreshes every 60s. The cache itself is refilled every 60s by the
// Railway worker that pings /api/cron/realtime-sync.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const FEED_COLORS: Record<string, string> = {
  police: '#00D4FF',
  fire: '#FF2D2D',
  ems: '#F59E0B',
  aviation: '#A855F7',
  marine: '#3B82F6',
  other: '#22C55E',
};

const TYPE_FILTERS = ['All', 'Police', 'Fire', 'EMS', 'Aviation', 'Other'] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];

type Feed = {
  id: string;
  name?: string;
  type?: string;
  feedType?: string;
  county?: string;
  state?: string;
  listeners?: number;
};

function feedTypeOf(f: Feed): string {
  return (f.type || f.feedType || 'other').toLowerCase();
}

export default function FeedsListPage() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<TypeFilter>('All');

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function load() {
      try {
        const r = await fetch('/api/realtime/feeds?limit=2000', { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        if (cancelled) return;
        setFeeds(j.feeds ?? []);
      } catch (e) {
        console.error('feeds load failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    intervalId = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return feeds.filter((f) => {
      if (filter !== 'All') {
        const t = feedTypeOf(f);
        const want = filter.toLowerCase();
        if (want === 'other') {
          if (['police', 'fire', 'ems', 'aviation'].includes(t)) return false;
        } else if (t !== want) return false;
      }
      if (!q) return true;
      const hay = `${f.name || ''} ${f.county || ''} ${f.state || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [feeds, query, filter]);

  return (
    <main className="min-h-screen bg-[#020D14] pb-24 text-[#E2E8F0]">
      <div
        className="sticky top-0 z-20 border-b border-[#0D2235] bg-[#020D14]/95 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-black tracking-[0.4em] text-[#00D4FF]">FEEDS</div>
            <div className="font-mono text-[10px] text-[#64748B]">
              {loading ? 'loading…' : `${visible.length} / ${feeds.length}`}
            </div>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search feeds, counties, states…"
            className="mt-2 w-full rounded border border-[#0D2235] bg-black/60 px-3 py-2 text-sm text-[#E2E8F0] placeholder-[#334155] outline-none focus:border-[#00D4FF]"
          />
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {TYPE_FILTERS.map((t) => {
              const active = filter === t;
              return (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className="shrink-0 rounded-full border px-3 py-1 text-[10px] font-bold tracking-widest transition"
                  style={{
                    borderColor: active ? '#00D4FF' : '#0D2235',
                    background: active ? 'rgba(0,212,255,0.15)' : 'rgba(0,0,0,0.4)',
                    color: active ? '#00D4FF' : '#64748B',
                  }}
                >
                  {t.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 pt-3">
        {loading && (
          <div className="py-12 text-center text-xs text-[#64748B]">Loading feeds…</div>
        )}
        {!loading && visible.length === 0 && (
          <div className="py-12 text-center text-xs text-[#64748B]">No feeds match your filters.</div>
        )}
        <ul className="space-y-2">
          {visible.slice(0, 500).map((f) => {
            const t = feedTypeOf(f);
            const color = FEED_COLORS[t] ?? FEED_COLORS.other;
            return (
              <li key={f.id}>
                <Link
                  href={`/spy/app/feed/${f.id}`}
                  className="flex items-stretch gap-3 overflow-hidden rounded-lg border border-[#0D2235] bg-black/40 transition hover:border-[#00D4FF]/40"
                >
                  <span className="w-1 shrink-0" style={{ background: color }} />
                  <div className="min-w-0 flex-1 px-3 py-2.5">
                    <div className="truncate text-sm font-bold text-[#E2E8F0]">
                      {f.name || 'Unnamed feed'}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-widest text-[#64748B]">
                      <span style={{ color }}>{t}</span>
                      {(f.county || f.state) && (
                        <span> · {[f.county, f.state].filter(Boolean).join(', ')}</span>
                      )}
                    </div>
                  </div>
                  {typeof f.listeners === 'number' && (
                    <div className="flex shrink-0 items-center px-3 font-mono text-[11px] text-[#64748B]">
                      {f.listeners.toLocaleString()} ◉
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
        {visible.length > 500 && (
          <div className="py-4 text-center text-[10px] text-[#334155]">
            Showing first 500. Refine your search.
          </div>
        )}
      </div>
    </main>
  );
}
