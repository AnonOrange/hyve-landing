'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CameraOverlay, CameraThumb, type Camera as SharedCamera } from '../../CameraOverlay';
import ChatPanel from './ChatPanel';

const API_BASE = 'https://hyve-api.vercel.app';

type Feed = {
  id: string;
  name?: string;
  type?: string;
  feedType?: string;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  county?: string;
  state?: string;
  description?: string;
};

type NowPlaying =
  | { source: 'openmhz'; openMhzShortName: string; callsApiUrl: string }
  | { source: 'direct'; streamUrl: string };

type Call = {
  _id?: string;
  filename?: string;
  url?: string;
  m4a_url?: string;
  talkgroupNum?: number | string;
  talkgroup?: number | string;
  talkgroupName?: string;
  talkgroup_name?: string;
  talkgroup_tag?: string;
  start_time?: number; // unix seconds
  startTime?: number;
  time?: string;
  len?: number;
  length?: number;
};

type NewsItem = {
  title?: string;
  link?: string;
  url?: string;
  source?: string;
  publisher?: string;
  pubDate?: string;
  publishedAt?: string;
};

type Camera = {
  id?: string;
  name?: string;
  label?: string;        // backend uses `label`
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  feedType?: string;
  url?: string;
  streamUrl?: string;
  snapshotUrl?: string;
  feedUrl?: string;      // backend uses `feedUrl` as the actual stream/image URL
  agency?: string;
};

function nlat(o: any): number | undefined {
  const v = o?.lat ?? o?.latitude;
  return typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(v) : undefined);
}
function nlng(o: any): number | undefined {
  const v = o?.lng ?? o?.lon ?? o?.longitude;
  return typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(v) : undefined);
}

function callTimestamp(c: Call): number {
  if (typeof c.start_time === 'number') return c.start_time * 1000;
  if (typeof c.startTime === 'number') return c.startTime * 1000;
  if (c.time) {
    const t = Date.parse(c.time);
    if (!isNaN(t)) return t;
  }
  return 0;
}
function callUrl(c: Call): string {
  return c.url || c.m4a_url || c.filename || '';
}
function callTg(c: Call): string {
  return (c.talkgroupName || c.talkgroup_tag || c.talkgroup_name || (c.talkgroup ?? c.talkgroupNum) || 'Talkgroup').toString();
}
function callKey(c: Call): string {
  return c._id || callUrl(c) || `${callTimestamp(c)}-${callTg(c)}`;
}

function relativeTime(input: string): string {
  const t = Date.parse(input);
  if (isNaN(t)) return input;
  const diff = Date.now() - t;
  const m = Math.round(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(t).toLocaleDateString();
}

export default function FeedDetailView() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const feedId = params.id;

  const [feed, setFeed] = useState<Feed | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number | null>(null); // index into calls (newest = 0)
  const [isLive, setIsLive] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCam, setSelectedCam] = useState<Camera | null>(null);

  // Watchlist star
  const [watched, setWatched] = useState(false);

  // AI Summary
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryAt, setSummaryAt] = useState<number>(0);
  const [hasKey, setHasKey] = useState(false);

  // News
  const [news, setNews] = useState<NewsItem[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Watchlist hydrate
  useEffect(() => {
    if (!feedId) return;
    try {
      const raw = localStorage.getItem('hyve_spy_watchlist');
      const arr: string[] = raw ? JSON.parse(raw) : [];
      setWatched(Array.isArray(arr) && arr.includes(feedId));
    } catch {}
    try {
      // Multi-provider: legacy key OR new generic key both count as "has key"
      setHasKey(!!localStorage.getItem('hyve_spy_anthropic_key') || !!localStorage.getItem('hyve_spy_llm_key'));
    } catch {}
  }, [feedId]);

  const toggleWatch = () => {
    if (!feedId) return;
    try {
      const raw = localStorage.getItem('hyve_spy_watchlist');
      const arr: string[] = raw ? JSON.parse(raw) : [];
      const set = new Set(Array.isArray(arr) ? arr : []);
      if (set.has(feedId)) {
        set.delete(feedId);
        setWatched(false);
      } else {
        set.add(feedId);
        setWatched(true);
      }
      localStorage.setItem('hyve_spy_watchlist', JSON.stringify([...set]));
    } catch {}
  };

  // Read whichever LLM key the user has configured (any provider).
  // Returns { key, provider, ollamaUrl, model } or null if no key set.
  const getLlmConfig = (): { key: string; provider?: string; ollamaUrl?: string; model?: string } | null => {
    try {
      const newKey = localStorage.getItem('hyve_spy_llm_key') || '';
      const provider = localStorage.getItem('hyve_spy_llm_provider') || '';
      const ollamaUrl = localStorage.getItem('hyve_spy_ollama_url') || '';
      const model = localStorage.getItem('hyve_spy_llm_model') || '';
      if (newKey || (provider === 'ollama' && ollamaUrl)) {
        return { key: newKey, provider: provider || undefined, ollamaUrl: ollamaUrl || undefined, model: model || undefined };
      }
      // Legacy fallback — old code only saved Anthropic key
      const legacy = localStorage.getItem('hyve_spy_anthropic_key') || '';
      if (legacy) return { key: legacy, provider: 'anthropic' };
    } catch {}
    return null;
  };

  // Auto-generate the summary as soon as the feed page opens (if a key is configured).
  useEffect(() => {
    if (!feedId) return;
    if (getLlmConfig()) {
      const t = setTimeout(() => generateSummary(), 800);
      return () => clearTimeout(t);
    }
  }, [feedId]);

  const generateSummary = async () => {
    if (!feedId) return;
    const cfg = getLlmConfig();
    if (!cfg) {
      setHasKey(false);
      setSummaryError('Add an LLM API key in Settings to enable AI summaries (any provider — Anthropic, OpenAI, Gemini, OpenRouter, Groq, or Ollama).');
      return;
    }
    if (Date.now() - summaryAt < 60_000 && summary) return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const headers: Record<string, string> = {};
      if (cfg.key) headers['X-LLM-Api-Key'] = cfg.key;
      if (cfg.provider) headers['X-LLM-Provider'] = cfg.provider;
      if (cfg.ollamaUrl) headers['X-Ollama-Url'] = cfg.ollamaUrl;
      if (cfg.model) headers['X-LLM-Model'] = cfg.model;
      const r = await fetch(`${API_BASE}/summarize/${feedId}`, { headers });
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        throw new Error(`HTTP ${r.status}: ${txt.slice(0, 140)}`);
      }
      const j = await r.json().catch(() => null);
      const text =
        (typeof j === 'string' ? j : j?.summary || j?.text || j?.message || '') ||
        'No summary returned.';
      setSummary(text);
      setSummaryAt(Date.now());
    } catch (e: any) {
      setSummaryError(e?.message || 'Failed to generate summary.');
    } finally {
      setSummaryLoading(false);
    }
  };

  // Fetch feed metadata + now-playing
  useEffect(() => {
    if (!feedId) return;
    let cancelled = false;
    (async () => {
      try {
        const [fRes, nRes] = await Promise.all([
          fetch(`${API_BASE}/feeds/${feedId}`),
          fetch(`${API_BASE}/feeds/${feedId}/now-playing`),
        ]);
        const fJson = await fRes.json().catch(() => null);
        const nJson = await nRes.json().catch(() => null);
        if (cancelled) return;
        const feedObj = fJson?.feed || fJson?.data || fJson;
        setFeed(feedObj);
        setNowPlaying(nJson);
      } catch (e: any) {
        setError(e?.message || 'Failed to load feed');
      }
    })();
    return () => { cancelled = true; };
  }, [feedId]);

  // Fetch nearby cameras once we know feed coords
  useEffect(() => {
    if (!feed) return;
    const lat = nlat(feed), lng = nlng(feed);
    if (lat == null || lng == null) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/cameras/nearby?lat=${lat}&lng=${lng}&radius=50`);
        const j = await res.json();
        const arr: Camera[] = Array.isArray(j) ? j : (j?.cameras ?? j?.data ?? []);
        setCameras(arr.slice(0, 12));
      } catch (e) {
        console.warn('camera fetch failed', e);
      }
    })();
  }, [feed]);

  // News related to this feed (RSS)
  useEffect(() => {
    if (!feed) return;
    const lat = nlat(feed), lng = nlng(feed);
    if (lat == null || lng == null) return;
    const keyword = (feed.type || feed.feedType || '').toLowerCase();
    let cancelled = false;
    (async () => {
      try {
        const url = `${API_BASE}/news/related?lat=${lat}&lng=${lng}${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ''}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const j = await res.json();
        const arr: NewsItem[] = Array.isArray(j) ? j : (j?.items ?? j?.news ?? j?.data ?? []);
        if (!cancelled) setNews(arr.slice(0, 5));
      } catch (e) {
        console.warn('news fetch failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [feed]);

  // Refresh OpenMHz calls (for openmhz source)
  const fetchCalls = useCallback(async () => {
    if (!nowPlaying || nowPlaying.source !== 'openmhz') return;
    try {
      const res = await fetch(nowPlaying.callsApiUrl, { cache: 'no-store' });
      const j = await res.json();
      const arr: Call[] = j?.calls || j?.data || (Array.isArray(j) ? j : []);
      // Newest first
      arr.sort((a, b) => callTimestamp(b) - callTimestamp(a));
      setCalls((prev) => {
        if (!prev.length) return arr;
        const seen = new Set(prev.map(callKey));
        const newOnes = arr.filter((c) => !seen.has(callKey(c)));
        // CRITICAL: keep the same array reference when nothing new arrived.
        // Otherwise React sees `calls` as "changed" every 15 s, the play useEffect
        // re-fires, and the audio src gets re-set to the same URL — which the
        // browser interprets as restarting the transmission. That's the
        // "recycling the last communication" bug.
        if (newOnes.length === 0) return prev;
        return [...newOnes, ...prev].slice(0, 200);
      });
    } catch (e) {
      console.warn('calls fetch failed', e);
    }
  }, [nowPlaying]);

  useEffect(() => {
    if (!nowPlaying) return;
    if (nowPlaying.source === 'openmhz') {
      fetchCalls();
      const i = setInterval(fetchCalls, 15000);
      return () => clearInterval(i);
    }
  }, [nowPlaying, fetchCalls]);

  // Play current call. We track the call's stable ID (callKey) instead of the
  // array position so that when new transmissions prepend to `calls`, the
  // currently-playing transmission isn't interrupted by the index shifting.
  const playingCallKey = useRef<string | null>(null);
  useEffect(() => {
    if (currentIdx == null || nowPlaying?.source !== 'openmhz') return;
    const c = calls[currentIdx];
    if (!c) return;
    const k = callKey(c);
    // Already playing this exact call? Don't restart it.
    if (playingCallKey.current === k && !audioRef.current?.paused) return;
    const url = callUrl(c);
    if (!url || !audioRef.current) return;
    playingCallKey.current = k;
    audioRef.current.src = url;
    audioRef.current.play().then(() => setPlaying(true)).catch((e) => {
      console.warn('audio play failed', e);
      setPlaying(false);
    });
  }, [currentIdx, calls, nowPlaying]);

  const onAudioEnded = () => {
    setPlaying(false);
    if (nowPlaying?.source === 'openmhz' && currentIdx != null) {
      // advance to NEWER (lower index)
      const next = currentIdx - 1;
      if (next >= 0) {
        setCurrentIdx(next);
      } else if (isLive) {
        // wait for more calls; refresh
        fetchCalls();
      }
    }
  };

  const goLive = async () => {
    setIsLive(true);
    if (nowPlaying?.source === 'openmhz') {
      await fetchCalls();
      // Use functional set to ensure we get latest calls
      setCalls((c) => {
        if (c.length > 0) {
          setCurrentIdx(0);
        }
        return c;
      });
      if (calls.length > 0) setCurrentIdx(0);
    } else if (nowPlaying?.source === 'direct') {
      if (audioRef.current) {
        audioRef.current.src = nowPlaying.streamUrl;
        audioRef.current.play().then(() => setPlaying(true)).catch((e) => {
          console.warn('direct stream play failed', e);
        });
      }
    }
  };

  const playOlder = () => {
    if (currentIdx == null) {
      if (calls.length > 0) setCurrentIdx(0);
      return;
    }
    const next = currentIdx + 1;
    if (next < calls.length) setCurrentIdx(next);
  };
  const playNewer = () => {
    if (currentIdx == null) {
      if (calls.length > 0) setCurrentIdx(0);
      return;
    }
    const next = currentIdx - 1;
    if (next >= 0) setCurrentIdx(next);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      if (!audioRef.current.src) {
        goLive();
      } else {
        audioRef.current.play().then(() => setPlaying(true)).catch(() => {});
      }
    }
  };

  const currentCall = currentIdx != null ? calls[currentIdx] : null;

  const foiaHref = useMemo(() => {
    if (!feed) return '#';
    const t = currentCall ? callTimestamp(currentCall) : Date.now();
    const tg = currentCall ? callTg(currentCall) : (feed.name || '');
    const desc = currentCall
      ? `Transmission on ${tg} at ${new Date(t).toLocaleString()}`
      : `Activity on ${feed.name || 'this feed'}`;
    const params = new URLSearchParams({
      time: String(t),
      talkgroupName: tg,
      description: desc,
    });
    return `${API_BASE}/feeds/${feedId}/foia.pdf?${params.toString()}`;
  }, [feed, currentCall, feedId]);

  return (
    <main className="min-h-screen bg-[#020D14] pb-12 text-[#E2E8F0]">
      {/* Header */}
      <div
        className="sticky top-0 z-20 border-b border-[#0D2235] bg-[#020D14]/90 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <button
            onClick={() => router.push('/spy/app')}
            className="rounded border border-[#0D2235] px-3 py-1.5 text-xs font-bold tracking-widest text-[#64748B] transition hover:text-[#00D4FF]"
          >
            ← MAP
          </button>
          <div className="text-[10px] font-black tracking-[0.4em] text-[#00D4FF]">HYVE SPY</div>
          <button
            onClick={toggleWatch}
            aria-label={watched ? 'Remove from watchlist' : 'Add to watchlist'}
            className="rounded border border-[#0D2235] px-3 py-1.5 text-base leading-none transition"
            style={{ color: watched ? '#F59E0B' : '#64748B' }}
          >
            {watched ? '★' : '☆'}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 pt-4">
        {/* Feed info */}
        <div className="rounded-lg border border-[#0D2235] bg-black/40 p-4">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-[#00D4FF]">
            {(feed?.type || feed?.feedType || 'feed').toString()}
            {feed?.county || feed?.state ? ` · ${[feed?.county, feed?.state].filter(Boolean).join(', ')}` : ''}
          </div>
          <h1 className="text-xl font-black leading-tight">
            {feed?.name || (feed ? 'Unnamed feed' : 'Loading…')}
          </h1>
          {feed?.description && (
            <p className="mt-2 text-sm text-[#64748B]">{feed.description}</p>
          )}
          {error && <p className="mt-2 text-xs text-[#FF2D2D]">{error}</p>}
        </div>

        {/* Now playing card */}
        <div className="mt-4 rounded-lg border border-[#0D2235] bg-gradient-to-br from-[#00D4FF]/5 to-transparent p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${playing ? 'animate-pulse bg-[#FF2D2D]' : 'bg-[#334155]'}`} />
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B]">
              {nowPlaying?.source === 'direct' ? 'Live Stream' : 'OpenMHz · Trunked Calls'}
            </div>
          </div>

          <div className="rounded border border-[#0D2235] bg-black/60 p-3">
            <div className="text-xs text-[#64748B]">Now playing</div>
            <div className="mt-1 truncate text-base font-bold text-[#E2E8F0]">
              {currentCall ? callTg(currentCall) : (nowPlaying?.source === 'direct' ? 'Direct stream' : 'Tap GO LIVE to start')}
            </div>
            {currentCall && (
              <div className="mt-1 font-mono text-[11px] text-[#64748B]">
                {new Date(callTimestamp(currentCall)).toLocaleString()}
                {currentIdx != null && (
                  <span className="ml-2">· #{currentIdx + 1} of {calls.length}</span>
                )}
              </div>
            )}
          </div>

          {/* Audio element (hidden — we drive it with buttons) */}
          <audio
            ref={audioRef}
            onEnded={onAudioEnded}
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
            preload="none"
            className="mt-3 w-full"
            controls
            playsInline
          />

          {nowPlaying?.source === 'openmhz' && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                onClick={playOlder}
                disabled={!calls.length}
                className="rounded border border-[#0D2235] bg-black/40 px-3 py-2.5 text-xs font-black tracking-widest text-[#E2E8F0] transition hover:border-[#00D4FF]/50 disabled:opacity-40"
              >
                ◀ OLDER
              </button>
              <button
                onClick={goLive}
                className="rounded bg-[#00D4FF] px-3 py-2.5 text-xs font-black tracking-widest text-[#020D14] transition hover:bg-white"
                style={{ boxShadow: '0 0 20px -2px rgba(0,212,255,0.5)' }}
              >
                ● GO LIVE
              </button>
              <button
                onClick={playNewer}
                disabled={!calls.length}
                className="rounded border border-[#0D2235] bg-black/40 px-3 py-2.5 text-xs font-black tracking-widest text-[#E2E8F0] transition hover:border-[#00D4FF]/50 disabled:opacity-40"
              >
                NEWER ▶
              </button>
            </div>
          )}

          {nowPlaying?.source === 'direct' && (
            <button
              onClick={goLive}
              className="mt-3 w-full rounded bg-[#00D4FF] px-3 py-3 text-xs font-black tracking-widest text-[#020D14] transition hover:bg-white"
              style={{ boxShadow: '0 0 20px -2px rgba(0,212,255,0.5)' }}
            >
              ● PLAY LIVE STREAM
            </button>
          )}

          <div className="mt-3 text-[10px] text-[#334155]">
            iOS note: tap GO LIVE to start audio. Browsers require a user gesture before playback.
          </div>
        </div>

        {/* AI Summary */}
        <div className="mt-4 rounded-lg border border-[#0D2235] bg-gradient-to-br from-[#A855F7]/5 to-transparent p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#A855F7]">
              AI Summary (Claude)
            </div>
            {summary && (
              <div className="font-mono text-[10px] text-[#334155]">
                generated {Math.round((Date.now() - summaryAt) / 1000)}s ago
              </div>
            )}
          </div>
          <button
            onClick={generateSummary}
            disabled={summaryLoading}
            className="w-full rounded border border-[#A855F7] bg-[#A855F7]/10 px-3 py-2.5 text-xs font-black tracking-widest text-[#A855F7] transition hover:bg-[#A855F7]/20 disabled:opacity-50"
          >
            {summaryLoading ? '◌ GENERATING…' : summary ? '↻ REGENERATE AI SUMMARY' : '✦ GENERATE AI SUMMARY'}
          </button>
          {summaryLoading && (
            <div className="mt-3 space-y-2">
              <div className="h-3 w-full animate-pulse rounded bg-[#0D2235]" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-[#0D2235]" />
              <div className="h-3 w-4/6 animate-pulse rounded bg-[#0D2235]" />
            </div>
          )}
          {!summaryLoading && !hasKey && !summary && (
            <div className="mt-3 rounded border border-[#0D2235] bg-black/40 px-3 py-2 text-xs text-[#64748B]">
              Add your Anthropic API key in <a href="/spy/app/settings" className="text-[#00D4FF] underline">Settings</a> to enable AI summaries.
            </div>
          )}
          {!summaryLoading && summaryError && (
            <div className="mt-3 rounded border border-[#FF2D2D]/40 bg-[#FF2D2D]/10 px-3 py-2 text-xs text-[#FF2D2D]">
              {summaryError}
            </div>
          )}
          {!summaryLoading && summary && (
            <div className="mt-3 whitespace-pre-wrap rounded border border-[#0D2235] bg-black/40 px-3 py-3 text-sm leading-relaxed text-[#E2E8F0]">
              {summary}
            </div>
          )}
        </div>

        {/* Recent calls list */}
        {nowPlaying?.source === 'openmhz' && calls.length > 0 && (
          <div className="mt-4 rounded-lg border border-[#0D2235] bg-black/30">
            <div className="border-b border-[#0D2235] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-[#64748B]">
              Recent Transmissions
            </div>
            <ul className="max-h-72 overflow-y-auto">
              {calls.slice(0, 50).map((c, i) => {
                const active = i === currentIdx;
                return (
                  <li
                    key={callKey(c)}
                    onClick={() => setCurrentIdx(i)}
                    className={`flex cursor-pointer items-center justify-between border-b border-[#0D2235]/50 px-3 py-2 text-xs transition ${active ? 'bg-[#00D4FF]/10' : 'hover:bg-white/5'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-[#E2E8F0]">{callTg(c)}</div>
                      <div className="font-mono text-[10px] text-[#64748B]">
                        {new Date(callTimestamp(c)).toLocaleTimeString()}
                      </div>
                    </div>
                    {active && playing && (
                      <span className="ml-2 h-2 w-2 animate-pulse rounded-full bg-[#FF2D2D]" />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Cameras */}
        {cameras.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#00D4FF]">
              Live cameras within 30 miles
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {cameras.map((cam, i) => (
                <CameraThumb
                  key={(cam as any).id || i}
                  cam={cam as SharedCamera}
                  onOpen={() => setSelectedCam(cam)}
                />
              ))}
            </div>
          </div>
        )}

        {/* News */}
        {news.length > 0 && (
          <div className="mt-6 rounded-lg border border-[#0D2235] bg-black/30">
            <div className="border-b border-[#0D2235] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-[#00D4FF]">
              Recent news near this incident
            </div>
            <ul>
              {news.map((n, i) => {
                const href = n.link || n.url || '#';
                const src = n.source || n.publisher || '';
                const dt = n.pubDate || n.publishedAt;
                return (
                  <li key={i} className="border-b border-[#0D2235]/50 last:border-0">
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="block px-3 py-2.5 transition hover:bg-white/5"
                    >
                      <div className="text-sm font-bold leading-snug text-[#E2E8F0]">
                        {n.title || 'Untitled'}
                      </div>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[#64748B]">
                        {src && <span>{src}</span>}
                        {src && dt && <span> · </span>}
                        {dt && <span>{relativeTime(dt)}</span>}
                      </div>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* FOIA */}
        <div className="mt-6 rounded-lg border border-[#0D2235] bg-black/30 p-4">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#A855F7]">
            Records request
          </div>
          <p className="text-sm text-[#64748B]">
            Generate a fillable FOIA request PDF, pre-formatted with the agency, the current incident timestamp, and 8 enumerated request items.
          </p>
          <a
            href={foiaHref}
            download={`foia-${feedId}.pdf`}
            className="mt-3 inline-block rounded border border-[#A855F7] bg-[#A855F7]/10 px-4 py-2 text-xs font-black tracking-widest text-[#A855F7] transition hover:bg-[#A855F7]/20"
          >
            ⤓ DOWNLOAD FOIA REQUEST (PDF)
          </a>
        </div>
      </div>
      {selectedCam && (
        <CameraOverlay cam={selectedCam as SharedCamera} onClose={() => setSelectedCam(null)} />
      )}
      <ChatPanel feedId={feedId} feedName={feed?.name} />
    </main>
  );
}

function CameraTile({ cam }: { cam: Camera }) {
  const url = cam.snapshotUrl || cam.streamUrl || cam.feedUrl || cam.url || '';
  const camName = cam.name || cam.label || cam.agency || '';
  const type = (cam.feedType || '').toLowerCase();
  const [tick, setTick] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);

  // Snapshot auto-refresh
  useEffect(() => {
    const isSnapshot = type === 'snapshot' || (!type && /\.(jpg|jpeg|png|gif)(\?|$)/i.test(url));
    if (!isSnapshot) return;
    const i = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(i);
  }, [type, url]);

  // HLS playback
  useEffect(() => {
    if (type !== 'hls' || !url || !videoRef.current) return;
    const v = videoRef.current;
    if (v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = url;
      return;
    }
    let cancelled = false;
    (async () => {
      const Hls = (await import('hls.js')).default;
      if (cancelled) return;
      if (Hls.isSupported()) {
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(v);
      }
    })();
    return () => {
      cancelled = true;
      try { hlsRef.current?.destroy(); } catch {}
    };
  }, [type, url]);

  if (!url) {
    return (
      <div className="aspect-video rounded border border-[#0D2235] bg-black/40 p-2 text-[10px] text-[#334155]">
        No URL
      </div>
    );
  }

  if (type === 'youtube' || /youtube\.com|youtu\.be/.test(url)) {
    const m =
      url.match(/[?&]v=([a-zA-Z0-9_-]{11})/) ||
      url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/) ||
      url.match(/youtube\.com\/(?:embed|live|shorts)\/([a-zA-Z0-9_-]{11})/);
    if (m) {
      return (
        <div className="overflow-hidden rounded border border-[#0D2235] bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1&playsinline=1&rel=0`}
            className="aspect-video w-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
          {camName && <div className="truncate px-2 py-1 text-[10px] text-[#64748B]">{camName}</div>}
        </div>
      );
    }
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex aspect-video items-center justify-center rounded border border-[#0D2235] bg-black p-2 text-center text-[11px] text-[#FF2D2D] hover:border-[#FF2D2D]/60"
      >
        ▶ YouTube<br />{camName.slice(0, 30)}
      </a>
    );
  }

  if (type === 'webview') {
    return (
      <iframe
        src={url}
        title={camName || 'cam'}
        className="aspect-video w-full rounded border border-[#0D2235] bg-black"
        sandbox="allow-scripts allow-same-origin"
      />
    );
  }

  if (type === 'hls') {
    return (
      <div className="overflow-hidden rounded border border-[#0D2235] bg-black">
        <video
          ref={videoRef}
          className="aspect-video w-full"
          controls
          autoPlay
          muted
          playsInline
        />
        {camName && <div className="truncate px-2 py-1 text-[10px] text-[#64748B]">{camName}</div>}
      </div>
    );
  }

  // Default: snapshot
  return (
    <div className="overflow-hidden rounded border border-[#0D2235] bg-black">
      <img
        src={`${url}${url.includes('?') ? '&' : '?'}_t=${tick}`}
        alt={camName || 'camera'}
        className="aspect-video w-full object-cover"
        onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0.3')}
      />
      {camName && <div className="truncate px-2 py-1 text-[10px] text-[#64748B]">{camName}</div>}
    </div>
  );
}
