'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap, LayersControl, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster/dist/leaflet.markercluster.js';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { useRouter } from 'next/navigation';
import { CameraOverlay, type Camera } from './CameraOverlay';
import MapHeader from './MapHeader';

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
  type CrimePoint = { feedId: string; lat: number; lng: number; intensity: number; count: number; source: string; baselineCity?: string };
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [alpr, setAlpr] = useState<Camera[]>([]);
  const [crime, setCrime] = useState<CrimePoint[]>([]);
  const [offenders, setOffenders] = useState<Camera[]>([]);
  const [selectedAlpr, setSelectedAlpr] = useState<Camera | null>(null);
  const [selectedOffender, setSelectedOffender] = useState<Camera | null>(null);
  const [loading, setLoading] = useState(true);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [selectedCam, setSelectedCam] = useState<Camera | null>(null);
  const [counts, setCounts] = useState<{ feeds: number; cameras: number; alpr: number }>({ feeds: 0, cameras: 0, alpr: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [typeVisibility, setTypeVisibility] = useState<Record<string, boolean>>({
    police: true,
    fire: true,
    ems: true,
    aviation: true,
    cameras: true,
    alpr: false,  // off by default — adds ~50k markers, opt-in
    crime: false,  // crime intensity heatmap, opt-in
    offenders: false,  // sex offender registry, opt-in
  });

  // Load feeds + cameras
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [fRes, cRes, aRes, crimeRes, oRes] = await Promise.all([
          fetch(`${API_BASE}/feeds/trending?limit=2000`),
          fetch(`${API_BASE}/cameras/nearby?lat=39.8&lng=-98.5&radius=5000`),
          fetch(`${API_BASE}/cameras/alpr`),
          fetch(`${API_BASE}/crime/heatmap`),
          fetch(`${API_BASE}/cameras/offenders`),
        ]);
        const fJson = await fRes.json();
        const cJson = await cRes.json();
        const aJson = await aRes.json();
        const crimeJson = await crimeRes.json();
        const oJson = await oRes.json();
        if (cancelled) return;

        const fArr: Feed[] = Array.isArray(fJson) ? fJson : (fJson?.feeds ?? fJson?.data ?? []);
        const cArr: Camera[] = Array.isArray(cJson) ? cJson : (cJson?.cameras ?? cJson?.data ?? []);
        const aArr: Camera[] = Array.isArray(aJson) ? aJson : (aJson?.cameras ?? aJson?.data ?? []);

        setFeeds(fArr.filter((f) => normalizeLat(f) != null && normalizeLng(f) != null));
        setCameras(cArr.filter((c) => normalizeLat(c) != null && normalizeLng(c) != null));
        setAlpr(aArr.filter((c) => normalizeLat(c) != null && normalizeLng(c) != null));
        const crimeArr: CrimePoint[] = (Array.isArray(crimeJson) ? crimeJson : []).filter(
          (p: any) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng) && (p?.intensity ?? 0) > 0,
        );
        setCrime(crimeArr);
        const oArr: Camera[] = Array.isArray(oJson) ? oJson : (oJson?.cameras ?? []);
        setOffenders(oArr.filter((c) => normalizeLat(c) != null && normalizeLng(c) != null));
        setCounts({ feeds: fArr.length, cameras: cArr.length, alpr: aArr.length });
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
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-[#020D14] text-[#E2E8F0]">
      <MapHeader
        subtitle="LIVE NATIONWIDE"
        rightSlot={
          <div className="text-right font-mono text-[10px] leading-tight text-[#94A3B8] sm:text-xs">
            {loading ? (
              'loading…'
            ) : (
              <>
                <div><span className="font-bold text-[#00D4FF]">{counts.cameras.toLocaleString()}</span> cams</div>
                <div><span className="font-bold text-[#00D4FF]">{counts.feeds.toLocaleString()}</span> feeds</div>
              </>
            )}
          </div>
        }
      />
      <div className="relative flex-1">
      <MapContainer
        center={[39.8, -98.5]}
        zoom={4}
        minZoom={3}
        maxZoom={20}
        maxBounds={usBounds}
        maxBoundsViscosity={0.4}
        worldCopyJump={false}
        zoomControl={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains={['a', 'b', 'c', 'd']}
          maxZoom={20}
        />
        <FlyTo center={flyTo} zoom={11} />

        {/* Cameras — clustered so 49k markers don't melt the browser */}
        {typeVisibility.cameras && (
          <MarkerClusterGroup
            chunkedLoading
            chunkInterval={50}
            chunkDelay={20}
            maxClusterRadius={60}
            disableClusteringAtZoom={14}
            spiderfyOnMaxZoom={true}
            removeOutsideVisibleBounds={true}
            iconCreateFunction={(cluster: any) => {
              const count = cluster.getChildCount();
              const size = count < 100 ? 32 : count < 1000 ? 40 : 52;
              return L.divIcon({
                html: `<div style="
                  width:${size}px;height:${size}px;
                  display:flex;align-items:center;justify-content:center;
                  background:rgba(34,197,94,0.85);
                  color:#020D14;font-weight:900;font-family:'Courier New',monospace;
                  font-size:${count < 100 ? 11 : count < 1000 ? 13 : 14}px;
                  border:2px solid #22C55E;border-radius:50%;
                  box-shadow:0 0 12px rgba(34,197,94,0.6);
                ">${count.toLocaleString()}</div>`,
                className: 'hyve-cam-cluster',
                iconSize: [size, size],
              });
            }}
          >
            {cameras.map((c, idx) => {
              const lat = normalizeLat(c)!;
              const lng = normalizeLng(c)!;
              return (
                <CircleMarker
                  key={`cam-${idx}-${lat}-${lng}`}
                  center={[lat, lng]}
                  radius={4}
                  pathOptions={{
                    color: '#22C55E',
                    fillColor: '#22C55E',
                    fillOpacity: 0.75,
                    weight: 0,
                  }}
                  eventHandlers={{ click: () => setSelectedCam(c) }}
                />
              );
            })}
          </MarkerClusterGroup>
        )}

        {/* Flock ALPR markers — locations only, no live feed (Flock data is law-enforcement-only).
            Clicking opens an info card explaining what these are + linking to consumer rights wiki. */}
        {typeVisibility.alpr && (
          <MarkerClusterGroup
            chunkedLoading
            chunkInterval={50}
            chunkDelay={20}
            maxClusterRadius={70}
            disableClusteringAtZoom={15}
            spiderfyOnMaxZoom={true}
            removeOutsideVisibleBounds={true}
            iconCreateFunction={(cluster: any) => {
              const count = cluster.getChildCount();
              const size = count < 100 ? 30 : count < 1000 ? 38 : 50;
              return L.divIcon({
                html: `<div style="
                  width:${size}px;height:${size}px;
                  display:flex;align-items:center;justify-content:center;
                  background:rgba(245,158,11,0.85);
                  color:#020D14;font-weight:900;font-family:'Courier New',monospace;
                  font-size:${count < 100 ? 11 : count < 1000 ? 12 : 13}px;
                  border:2px solid #F59E0B;border-radius:4px;
                  box-shadow:0 0 12px rgba(245,158,11,0.6);
                ">${count.toLocaleString()}</div>`,
                className: 'hyve-alpr-cluster',
                iconSize: [size, size],
              });
            }}
          >
            {alpr.map((c, idx) => {
              const lat = normalizeLat(c)!;
              const lng = normalizeLng(c)!;
              return (
                <CircleMarker
                  key={`alpr-${idx}-${lat}-${lng}`}
                  center={[lat, lng]}
                  radius={3}
                  pathOptions={{
                    color: '#F59E0B',
                    fillColor: '#F59E0B',
                    fillOpacity: 0.85,
                    weight: 0,
                  }}
                  eventHandlers={{ click: () => setSelectedAlpr(c) }}
                />
              );
            })}
          </MarkerClusterGroup>
        )}

        {/* Sex offender registry — purple dots, clickable for details */}
        {typeVisibility.offenders && (
          <MarkerClusterGroup
            chunkedLoading
            chunkInterval={50}
            chunkDelay={20}
            maxClusterRadius={50}
            disableClusteringAtZoom={15}
            spiderfyOnMaxZoom
            removeOutsideVisibleBounds
            iconCreateFunction={(cluster: any) => {
              const c = cluster.getChildCount();
              const size = c < 100 ? 28 : c < 1000 ? 36 : 46;
              return L.divIcon({
                html: `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:rgba(168,85,247,0.85);color:#020D14;font-weight:900;font-family:'Courier New',monospace;font-size:${c < 100 ? 11 : 13}px;border:2px solid #A855F7;border-radius:4px;box-shadow:0 0 12px rgba(168,85,247,0.6)">${c.toLocaleString()}</div>`,
                className: 'hyve-off-cluster',
                iconSize: [size, size],
              });
            }}
          >
            {offenders.map((o, i) => {
              const lat = normalizeLat(o)!;
              const lng = normalizeLng(o)!;
              return (
                <CircleMarker
                  key={`off-${i}`}
                  center={[lat, lng]}
                  radius={3}
                  pathOptions={{ color: '#A855F7', fillColor: '#A855F7', fillOpacity: 0.85, weight: 0 }}
                  eventHandlers={{ click: () => setSelectedOffender(o) }}
                />
              );
            })}
          </MarkerClusterGroup>
        )}

        {/* Crime intensity heatmap-style overlay — graduated red circles per feed location */}
        {typeVisibility.crime && crime.map((p, i) => {
          const r = Math.max(8, p.intensity * 32);
          const opacity = Math.max(0.15, p.intensity * 0.55);
          return (
            <CircleMarker
              key={`crime-${i}-${p.feedId}`}
              center={[p.lat, p.lng]}
              radius={r}
              pathOptions={{
                color: '#EF4444',
                fillColor: '#EF4444',
                fillOpacity: opacity,
                weight: 0,
                interactive: false,
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
            { key: 'alpr', label: 'Flock ALPR', color: '#F59E0B' },
            { key: 'crime', label: 'Crime', color: '#EF4444' },
            { key: 'offenders', label: 'Offenders', color: '#A855F7' },
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

      </div>

      {/* Camera overlay */}
      {selectedCam && (
        <CameraOverlay cam={selectedCam} onClose={() => setSelectedCam(null)} />
      )}

      {/* Sex offender info modal */}
      {selectedOffender && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 p-4 backdrop-blur" onClick={() => setSelectedOffender(null)}>
          <div className="w-full max-w-md rounded-lg border border-[#A855F7] bg-[#020D14] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10px] font-black tracking-[0.4em] text-[#A855F7]">REGISTERED OFFENDER</div>
              <button onClick={() => setSelectedOffender(null)} className="rounded border border-[#0D2235] px-2 py-0.5 text-xs text-[#64748B] hover:text-[#E2E8F0]">✕</button>
            </div>
            <div className="mb-4 text-base font-bold text-white">{selectedOffender.label || 'Registered offender'}</div>
            <div className="mb-4 space-y-1 font-mono text-xs text-[#94A3B8]">
              <div>Lat/Lng: <span className="text-white">{selectedOffender.lat?.toFixed(5)}, {selectedOffender.lng?.toFixed(5)}</span></div>
              {(selectedOffender as any).county && <div>City: <span className="text-white">{(selectedOffender as any).county}</span></div>}
              <div>Source: <span className="text-white">{selectedOffender.agency || 'state registry'}</span></div>
            </div>
            <p className="mb-3 text-xs text-[#64748B]">
              Data sourced from public state and county registries. Offender locations are public record under federal Adam Walsh Act.
              Verify details at the official registry: <a href="https://www.nsopw.gov" target="_blank" rel="noreferrer" className="text-[#A855F7] hover:underline">nsopw.gov</a>
            </p>
          </div>
        </div>
      )}

      {/* ALPR info modal — these aren't watchable cameras, just locations of surveillance infrastructure */}
      {selectedAlpr && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 p-4 backdrop-blur" onClick={() => setSelectedAlpr(null)}>
          <div className="w-full max-w-md rounded-lg border border-[#F59E0B] bg-[#020D14] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10px] font-black tracking-[0.4em] text-[#F59E0B]">⚠ FLOCK ALPR</div>
              <button onClick={() => setSelectedAlpr(null)} className="rounded border border-[#0D2235] px-2 py-0.5 text-xs text-[#64748B] hover:text-[#E2E8F0]">✕</button>
            </div>
            <div className="mb-4 text-lg font-bold text-white">License-plate reader detected</div>
            <div className="mb-4 space-y-1 font-mono text-xs text-[#94A3B8]">
              <div>Lat/Lng: <span className="text-white">{selectedAlpr.lat?.toFixed(5)}, {selectedAlpr.lng?.toFixed(5)}</span></div>
              {(selectedAlpr as any).county && <div>Direction: <span className="text-white">{(selectedAlpr as any).county}</span></div>}
              <div>Operator: <span className="text-white">{selectedAlpr.agency || 'Flock Safety'}</span></div>
              <div>Source: <span className="text-white">DeFlock community DB</span></div>
            </div>
            <p className="mb-3 text-xs text-[#94A3B8]">
              Flock cameras photograph every license plate that passes them, store the data for 30 days,
              and share it across the entire Flock network. There is no live feed available — Flock data
              is restricted to law enforcement contracts.
            </p>
            <a
              href={selectedAlpr.feedUrl || 'https://consumerrights.wiki/w/Flock_Safety'}
              target="_blank"
              rel="noreferrer"
              className="inline-block rounded bg-[#F59E0B] px-3 py-1.5 text-[10px] font-black tracking-widest text-[#020D14] hover:bg-white"
            >
              LEARN MORE ↗
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
