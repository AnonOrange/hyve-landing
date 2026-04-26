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
  // Stubs for dead-code blocks below (other layers moved to dedicated tabs).
  // TS doesn't dead-code-eliminate `false && ...` so these need to exist as types.
  const alpr: any[] = [];
  const offenders: any[] = [];
  const selectedAlpr: any = null;
  const selectedOffender: any = null;
  const setSelectedAlpr = (_: any) => {};
  const setSelectedOffender = (_: any) => {};
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

  // Lean operations map: feeds + cameras only. Surveillance, offenders, crime,
  // ALPR each have their own dedicated tab now — see /spy/app/{surveillance,
  // offenders,crime}. This keeps the operations map fast and focused.
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
        setCameras(cArr.filter((c) => normalizeLat(c) != null && normalizeLng(c) != null));
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

        {/* ALPR / Surveillance / Offenders / Crime now live on dedicated tabs.
            See /spy/app/{surveillance,offenders,crime}. */}
        {false && typeVisibility.alpr && (
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

        {/* Offenders moved to /spy/app/offenders */}
        {false && typeVisibility.offenders && (
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

        {/* Crime moved to /spy/app/crime */}
        {false && typeVisibility.crime && [].map((p: any, i: number) => {
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

      {/* These cards moved to /spy/app/{offenders,surveillance}. Below kept disabled. */}
      {false && selectedOffender && (() => {
        const o = selectedOffender as any;
        const d = (o.details || {}) as Record<string, string | undefined>;
        const row = (label: string, value?: string | null) =>
          value ? <div key={label} className="flex justify-between gap-3 border-b border-[#0D2235]/50 py-1.5"><span className="font-mono text-[10px] uppercase tracking-widest text-[#64748B]">{label}</span><span className="text-right text-xs text-white">{value}</span></div> : null;

        // Build official-source lookup URLs that prefill name. These open the user's
        // browser at the authoritative registry — we don't proxy or republish, the
        // photo loads from the official source where the user can verify.
        const fullName = o.label || '';
        const nameParts = fullName.replace(/,/g, '').trim().split(/\s+/);
        // Naive last/first split — handles "LASTNAME, FIRST" and "First Last" forms.
        let last = d.last || '';
        let first = d.first || '';
        if (!last && fullName.includes(',')) {
          last = fullName.split(',')[0].trim();
          first = (fullName.split(',')[1] || '').trim().split(/\s+/)[0];
        } else if (!last && nameParts.length >= 2) {
          last = nameParts[nameParts.length - 1];
          first = nameParts[0];
        }
        const state = (d.state || o.state || '').toUpperCase();
        const STATE_REGISTRY_URLS: Record<string, string> = {
          CA: `https://www.meganslaw.ca.gov/Search.aspx?Type=NameSearch&LastName=${encodeURIComponent(last)}&FirstName=${encodeURIComponent(first)}`,
          FL: `https://offender.fdle.state.fl.us/offender/sops/searchByName.action?lastName=${encodeURIComponent(last)}&firstName=${encodeURIComponent(first)}`,
          TX: `https://records.txdps.state.tx.us/SexOffender/PublicSite/Index.aspx`,
          IL: `https://sor.isp.illinois.gov/?lastName=${encodeURIComponent(last)}&firstName=${encodeURIComponent(first)}`,
          NY: `https://criminaljustice.ny.gov/SomsSUBDirectory/search_index.jsp`,
          OH: `https://services.dps.ohio.gov/SOR/Public/Reports/PersonByName?lastName=${encodeURIComponent(last)}&firstName=${encodeURIComponent(first)}`,
          GA: `https://gbi.georgia.gov/services/sex-offender-registry-search`,
          MI: `https://mspsor.com/Search.aspx`,
        };
        const stateRegUrl = STATE_REGISTRY_URLS[state];
        const nsopwUrl = `https://www.nsopw.gov/SearchByName?lastName=${encodeURIComponent(last)}&firstName=${encodeURIComponent(first)}`;
        const googleImg = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(fullName + ' ' + (state || '') + ' sex offender registry')}`;

        return (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 p-4 backdrop-blur" onClick={() => setSelectedOffender(null)}>
            <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg border border-[#A855F7] bg-[#020D14] p-5" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[10px] font-black tracking-[0.4em] text-[#A855F7]">REGISTERED OFFENDER</div>
                <button onClick={() => setSelectedOffender(null)} className="rounded border border-[#0D2235] px-2 py-0.5 text-xs text-[#64748B] hover:text-[#E2E8F0]">✕</button>
              </div>

              {d.photo_url ? (
                <img src={d.photo_url} alt={o.label} className="mb-3 h-48 w-full rounded border border-[#0D2235] object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
              ) : (
                <div className="mb-3 rounded border border-dashed border-[#A855F7]/40 bg-[#A855F7]/5 p-3 text-center">
                  <div className="mb-2 text-[10px] font-black tracking-widest text-[#A855F7]">NO PHOTO IN SOURCE FEED</div>
                  <div className="mb-3 text-[11px] text-[#94A3B8]">Look up photo on the official registry:</div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {stateRegUrl && (
                      <a href={stateRegUrl} target="_blank" rel="noreferrer" className="rounded bg-[#A855F7] px-3 py-1.5 text-[10px] font-black tracking-widest text-white hover:bg-[#C084FC]">
                        {state} REGISTRY ↗
                      </a>
                    )}
                    <a href={nsopwUrl} target="_blank" rel="noreferrer" className="rounded border border-[#A855F7] px-3 py-1.5 text-[10px] font-black tracking-widest text-[#A855F7] hover:bg-[#A855F7]/10">
                      NSOPW ↗
                    </a>
                    <a href={googleImg} target="_blank" rel="noreferrer" className="rounded border border-[#0D2235] px-3 py-1.5 text-[10px] font-black tracking-widest text-[#94A3B8] hover:text-white">
                      IMAGES ↗
                    </a>
                  </div>
                </div>
              )}

              <div className="mb-3 text-lg font-bold text-white">{fullName || 'Registered offender'}</div>

              <div className="space-y-0">
                {row('DOB', d.dob)}
                {row('Sex', d.sex)}
                {row('Race', d.race)}
                {row('Height', d.height ? `${d.height}${/^\d+$/.test(d.height || '') ? '"' : ''}` : null)}
                {row('Weight', d.weight ? `${d.weight}${/^\d+$/.test(d.weight || '') ? ' lb' : ''}` : null)}
                {row('Eye color', d.eye)}
                {row('Hair color', d.hair)}
                {row('Aliases', d.aliases)}
                {row('Markings', d.markings)}
                {row('Classification', d.classification)}
                {row('Charge', d.charge)}
                {row('Address', d.address)}
                {row('City', d.city || o.county)}
                {row('State', state)}
                {row('ZIP', d.zip)}
                {row('Registered', d.registered)}
                {row('Case #', d.case_number)}
                {row('Source', o.agency)}
                {row('Coords', `${o.lat?.toFixed(5)}, ${o.lng?.toFixed(5)}`)}
              </div>

              <div className="mt-4 flex gap-2 border-t border-[#0D2235] pt-3">
                {stateRegUrl && (
                  <a href={stateRegUrl} target="_blank" rel="noreferrer" className="flex-1 rounded border border-[#A855F7] bg-[#A855F7]/10 px-3 py-2 text-center text-[10px] font-black tracking-widest text-[#A855F7] hover:bg-[#A855F7]/20">
                    OPEN {state} REGISTRY ↗
                  </a>
                )}
                <a href={nsopwUrl} target="_blank" rel="noreferrer" className="flex-1 rounded border border-[#0D2235] px-3 py-2 text-center text-[10px] font-black tracking-widest text-[#94A3B8] hover:text-white">
                  NSOPW ↗
                </a>
              </div>

              <p className="mt-3 text-[10px] text-[#475569]">
                Data from public state/county/city ArcGIS registry feeds. Offender locations are public record under the federal Adam Walsh Act. Verify at the official source.
              </p>
            </div>
          </div>
        );
      })()}

      {/* ALPR info modal moved to /spy/app/surveillance */}
      {false && selectedAlpr && (
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
