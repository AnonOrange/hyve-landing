'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API_BASE = 'https://hyve-api.vercel.app';
const STORAGE_KEY = 'hyve_spy_watchlist';

const FEED_COLORS: Record<string, string> = {
  police: '#00D4FF',
  fire: '#FF2D2D',
  ems: '#F59E0B',
  aviation: '#A855F7',
  marine: '#3B82F6',
  other: '#22C55E',
};

type Feed = {
  id: string;
  name?: string;
  type?: string;
  feedType?: string;
  county?: string;
  state?: string;
  listeners?: number;
};

function readWatchlist(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.filter((x) => typeof x === 'string');
    return [];
  } catch {
    return [];
  }
}

function writeWatchlist(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {}
}

export default function WatchlistPage() {
  const [ids, setIds] = useState<string[]>([]);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setIds(readWatchlist());
  }, []);

  useEffect(() => {
    if (ids.length === 0) {
      setFeeds([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/feeds/trending?limit=5000`);
        const j = await r.json();
        const arr: Feed[] = Array.isArray(j) ? j : (j?.feeds ?? j?.data ?? []);
        const set = new Set(ids);
        if (!cancelled) setFeeds(arr.filter((f) => set.has(f.id)));
      } catch (e) {
        console.error('watchlist fetch failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ids]);

  const remove = (id: string) => {
    const next = ids.filter((x) => x !== id);
    setIds(next);
    writeWatchlist(next);
  };

  return (
    <main className="min-h-screen bg-[#020D14] pb-24 text-[#E2E8F0]">
      <div
        className="sticky top-0 z-20 border-b border-[#0D2235] bg-[#020D14]/95 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="text-[10px] font-black tracking-[0.4em] text-[#00D4FF]">WATCHLIST</div>
          <div className="font-mono text-[10px] text-[#64748B]">
            {loading ? 'loading…' : `${feeds.length} watched`}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 pt-4">
        {!loading && ids.length === 0 && (
          <div className="rounded-lg border border-[#0D2235] bg-black/40 p-8 text-center">
            <div className="mb-2 text-3xl">★</div>
            <div className="mb-1 text-sm font-bold text-[#E2E8F0]">
              No feeds in your watchlist
            </div>
            <div className="text-xs text-[#64748B]">
              Tap the star on any feed detail to add it.
            </div>
            <Link
              href="/spy/app/feeds"
              className="mt-4 inline-block rounded border border-[#00D4FF] bg-[#00D4FF]/10 px-4 py-2 text-[10px] font-black tracking-widest text-[#00D4FF]"
            >
              BROWSE FEEDS
            </Link>
          </div>
        )}

        {!loading && ids.length > 0 && feeds.length === 0 && (
          <div className="py-12 text-center text-xs text-[#64748B]">
            Couldn't find your watched feeds in the trending list.
          </div>
        )}

        <ul className="space-y-2">
          {feeds.map((f) => {
            const t = (f.type || f.feedType || 'other').toLowerCase();
            const color = FEED_COLORS[t] ?? FEED_COLORS.other;
            return (
              <li
                key={f.id}
                className="flex items-stretch gap-3 overflow-hidden rounded-lg border border-[#0D2235] bg-black/40"
              >
                <span className="w-1 shrink-0" style={{ background: color }} />
                <Link href={`/spy/app/feed/${f.id}`} className="min-w-0 flex-1 px-3 py-2.5">
                  <div className="truncate text-sm font-bold text-[#E2E8F0]">
                    {f.name || 'Unnamed feed'}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-widest text-[#64748B]">
                    <span style={{ color }}>{t}</span>
                    {(f.county || f.state) && (
                      <span> · {[f.county, f.state].filter(Boolean).join(', ')}</span>
                    )}
                  </div>
                </Link>
                <button
                  onClick={() => remove(f.id)}
                  className="px-4 text-[#64748B] transition hover:text-[#FF2D2D]"
                  aria-label="Remove from watchlist"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
