'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import { useRouter } from 'next/navigation';
import { CameraOverlay, type Camera } from './CameraOverlay';

const API_BASE = 'https://hyve-api.vercel.app';

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
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  listeners?: number;
  county?: string;
  state?: string;
};


function normalizeLat(o: any): number | undefined {
  const v = o?.lat ?? o?.latitude;
  return typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(v) : undefined);
}
function normalizeLng(o: any): number | undefined {
  const v = o?.lng ?? o?.lon ?? o?.longitude;
  return typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(v) : undefined);
}

function FlyTo({ center, zoom }: { center: [number, number] | null; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom ?? 11, { duration: 1.2 });
  }, [center, zoom, map]);
  return null;
}

export default function MapView() {
  const router = useRouter();
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [selectedCam, setSelectedCam] = useState<Camera | null>(null);
  const [counts, setCounts] = useState<{ feeds: number; cameras: number }>({ feeds: 0, cameras: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [typeVisibility, setTypeVisibility] = useState<Record<string, boolean>>({
    police: true,
    fire: true,
    ems: true,
    aviation: true,
    cameras: true,
  });

  // Load feeds + cameras
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [fRes, cRes] = await Promise.all([
          fetch(`${API_BASE}/feeds/trending?limit=2000`),
          fetch(`${API_BASE}/cameras/nearby?lat=39.8&lng=-98.5&radius=5000`),
        ]);
        const fJson = await fRes.json();
        const cJson = await cRes.json();
        if (cancelled) return;

        const fArr: Feed[] = Array.isArray(fJson) ? fJson : (fJson?.feeds ?? fJson?.data ?? []);
        const cArr: Camera[] = Array.isArray(cJson) ? cJson : (cJson?.cameras ?? cJson?.data ?? []);

        setFeeds(fArr.filter((f) => normalizeLat(f) != null && normalizeLng(f) != null));
        setCameras(cArr.slice(0, 1500).filter((c) => normalizeLat(c) != null && normalizeLng(c) != null));
        setCounts({ feeds: fArr.length, cameras: cArr.length });
      } catch (e) {
        console.error('Failed to load map data', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const usBounds = useMemo<L.LatLngBoundsExpression>(
    () => [[15, -170], [72, -50]],
    []
  );

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&countrycodes=us&limit=1`;
      // Browsers won't let us set User-Agent, but Nominatim accepts requests w/ a Referer.
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Geocoder ${res.status}`);
      const j = await res.json();
      if (!Array.isArray(j) || j.length === 0) {
        setSearchError('No results.');
        return;
      }
      const lat = parseFloat(j[0].lat);
      const lng = parseFloat(j[0].lon);
      if (isNaN(lat) || isNaN(lng)) throw new Error('bad coords');
      setFlyTo([lat, lng]);
      // load nearby cameras
      try {
        const cRes = await fetch(`${API_BASE}/cameras/nearby?lat=${lat}&lng=${lng}&radius=100`);
        const cj = await cRes.json();
        const arr: Camera[] = Array.isArray(cj) ? cj : (cj?.cameras ?? cj?.data ?? []);
        if (arr.length) {
          setCameras((prev) => {
            const seen = new Set(prev.map((c) => `${normalizeLat(c)},${normalizeLng(c)}`));
            const merged = [...prev];
            for (const c of arr) {
              const k = `${normalizeLat(c)},${normalizeLng(c)}`;
              if (!seen.has(k)) merged.push(c);
            }
            return merged;
          });
        }
      } catch {}
    } catch (err: any) {
      setSearchError(err?.message || 'Search failed.');
    } finally {
      setSearching(false);
    }
  };

  const toggleType = (t: string) =>
    setTypeVisibility((v) => ({ ...v, [t]: !v[t] }));

  const visibleFeeds = useMemo(() => {
    return feeds.filter((f) => {
      const t = (f.type || f.feedType || 'other').toLowerCase();
      // Map "marine" and "other" alongside aviation toggle? Only listed types control visibility; default keep "other"/"marine" with aviation=false off-only filter.
      if (t === 'police') return typeVisibility.police;
      if (t === 'fire') return typeVisibility.fire;
      if (t === 'ems') return typeVisibility.ems;
      if (t === 'aviation') return typeVisibility.aviation;
      return true;
    });
  }, [feeds, typeVisibility]);

  const handleNearMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation not supported by this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setFlyTo([latitude, longitude]);
        try {
          const res = await fetch(`${API_BASE}/cameras/nearby?lat=${latitude}&lng=${longitude}&radius=200`);
          const j = await res.json();
          const arr: Camera[] = Array.isArray(j) ? j : (j?.cameras ?? j?.data ?? []);
          if (arr.length > 0) {
            setCameras((prev) => {
              const seen = new Set(prev.map((c) => `${normalizeLat(c)},${normalizeLng(c)}`));
              const merged = [...prev];
              for (const c of arr) {
                const k = `${normalizeLat(c)},${normalizeLng(c)}`;
                if (!seen.has(k)) merged.push(c);
              }
              return merged;
            });
          }
        } catch (e) {
          console.warn('Near-me fetch failed', e);
        }
      },
      (err) => {
        alert('Could not get your location: ' + err.message);
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#020D14] text-[#E2E8F0]">
      <MapContainer
        center={[39.8, -98.5]}
        zoom={4}
        minZoom={3}
        maxZoom={18}
        maxBounds={usBounds}
        maxBoundsViscosity={0.4}
        worldCopyJump={false}
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains={['a', 'b', 'c', 'd']}
          maxZoom={20}
        />
        <FlyTo center={flyTo} zoom={11} />

        {/* Camera dots (rendered first so feed pins draw on top) */}
        {typeVisibility.cameras && cameras.map((c, idx) => {
          const lat = normalizeLat(c)!;
          const lng = normalizeLng(c)!;
          return (
            <CircleMarker
              key={`cam-${idx}-${lat}-${lng}`}
              center={[lat, lng]}
              radius={3}
              pathOptions={{
                color: '#22C55E',
                fillColor: '#22C55E',
                fillOpacity: 0.7,
                weight: 0,
              }}
              eventHandlers={{
                click: () => setSelectedCam(c),
              }}
            />
          );
        })}

        {/* Feed pins */}
        {visibleFeeds.map((f) => {
          const lat = normalizeLat(f)!;
          const lng = normalizeLng(f)!;
          const type = (f.type || f.feedType || 'other').toLowerCase();
          const color = FEED_COLORS[type] ?? FEED_COLORS.other;
          return (
            <CircleMarker
              key={`feed-${f.id}`}
              center={[lat, lng]}
              radius={6}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: 0.85,
                weight: 1.5,
              }}
              eventHandlers={{
                click: () => router.push(`/spy/app/feed/${f.id}`),
              }}
            />
          );
        })}
      </MapContainer>

      {/* Header */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex items-start justify-between px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <div className="pointer-events-auto rounded-md border border-[#0D2235] bg-black/70 px-3 py-2 backdrop-blur">
          <div className="text-[10px] font-black tracking-[0.4em] text-[#00D4FF]">HYVE SPY</div>
          <div className="mt-0.5 font-mono text-[10px] text-[#64748B]">
            {loading ? 'loading…' : `${feeds.length} feeds · ${cameras.length} cams`}
          </div>
        </div>
        <a
          href="/spy"
          className="pointer-events-auto rounded-md border border-[#0D2235] bg-black/70 px-3 py-2 text-[10px] font-bold tracking-widest text-[#64748B] backdrop-blur transition hover:text-[#00D4FF]"
        >
          ← LANDING
        </a>
      </div>

      {/* Search + chips overlay */}
      <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+4rem)] z-[1000] flex flex-col items-center px-3">
        <form
          onSubmit={handleSearch}
          className="pointer-events-auto flex w-full max-w-md items-center gap-1 rounded-full border border-[#0D2235] bg-black/80 px-3 py-1.5 backdrop-blur"
        >
          <span className="text-xs text-[#64748B]">⌕</span>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search city, address, or place…"
            className="flex-1 bg-transparent px-2 py-1 text-xs text-[#E2E8F0] placeholder-[#334155] outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSearchError(null);
              }}
              className="px-1 text-xs text-[#334155] hover:text-[#FF2D2D]"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
          <button
            type="submit"
            disabled={searching}
            className="rounded-full bg-[#00D4FF] px-3 py-1 text-[10px] font-black tracking-widest text-[#020D14] disabled:opacity-50"
          >
            {searching ? '…' : 'GO'}
          </button>
        </form>
        {searchError && (
          <div className="pointer-events-auto mt-1 rounded bg-black/80 px-2 py-1 text-[10px] text-[#FF2D2D]">
            {searchError}
          </div>
        )}
        <div className="pointer-events-auto mt-2 flex w-full max-w-md gap-1.5 overflow-x-auto pb-1">
          {[
            { key: 'police', label: 'Police', color: FEED_COLORS.police },
            { key: 'fire', label: 'Fire', color: FEED_COLORS.fire },
            { key: 'ems', label: 'EMS', color: FEED_COLORS.ems },
            { key: 'aviation', label: 'Aviation', color: FEED_COLORS.aviation },
            { key: 'cameras', label: 'Cameras', color: '#22C55E' },
          ].map((c) => {
            const on = typeVisibility[c.key];
            return (
              <button
                key={c.key}
                onClick={() => toggleType(c.key)}
                className="shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-widest backdrop-blur transition"
                style={{
                  borderColor: on ? c.color : '#0D2235',
                  background: on ? `${c.color}1F` : 'rgba(0,0,0,0.6)',
                  color: on ? c.color : '#64748B',
                }}
              >
                {c.label.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="pointer-events-none absolute left-3 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-[1000]">
        <div className="rounded-md border border-[#0D2235] bg-black/70 p-2 backdrop-blur">
          <div className="mb-1 font-mono text-[9px] uppercase tracking-widest text-[#64748B]">Legend</div>
          <ul className="space-y-1 text-[10px]">
            {Object.entries(FEED_COLORS).slice(0, 5).map(([k, v]) => (
              <li key={k} className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: v }} />
                <span className="capitalize text-[#E2E8F0]">{k}</span>
              </li>
            ))}
            <li className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: '#22C55E' }} />
              <span className="text-[#E2E8F0]">Camera</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Near Me button */}
      <button
        onClick={handleNearMe}
        className="absolute right-3 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-[1000] rounded-full border-2 border-[#00D4FF] bg-[#00D4FF]/15 px-5 py-3 text-xs font-black tracking-widest text-[#00D4FF] backdrop-blur transition hover:bg-[#00D4FF]/30"
        style={{ boxShadow: '0 0 20px -2px rgba(0,212,255,0.5)' }}
      >
        ◎ NEAR ME
      </button>

      {/* Camera overlay */}
      {selectedCam && (
        <CameraOverlay cam={selectedCam} onClose={() => setSelectedCam(null)} />
      )}
    </main>
  );
}
