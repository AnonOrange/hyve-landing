'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/leaflet.markercluster.js';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import MarkerClusterGroup from 'react-leaflet-cluster';
import MapHeader from '../MapHeader';
import MapLoadingOverlay from '../MapLoadingOverlay';

// Pulls from /api/realtime/offenders (Supabase-backed, geo-filtered).
// Was: 55MB direct download from /cameras/offenders. Now: ~50-200KB
// when location is known, ~5MB max for full nationwide load.

type Offender = {
  id?: string;
  label?: string;
  agency?: string;
  lat?: number;
  lng?: number;
  state?: string;
  county?: string;
  feedUrl?: string;
  details?: Record<string, string | undefined>;
};

function MapInvalidator() {
  const map = useMap();
  useEffect(() => {
    const id = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(id);
  }, [map]);
  return null;
}

const STATE_REGISTRY_URLS: Record<string, (last: string, first: string) => string> = {
  CA: (l, f) => `https://www.meganslaw.ca.gov/Search.aspx?Type=NameSearch&LastName=${encodeURIComponent(l)}&FirstName=${encodeURIComponent(f)}`,
  FL: (l, f) => `https://offender.fdle.state.fl.us/offender/sops/searchByName.action?lastName=${encodeURIComponent(l)}&firstName=${encodeURIComponent(f)}`,
  TX: () => `https://records.txdps.state.tx.us/SexOffender/PublicSite/Index.aspx`,
  IL: (l, f) => `https://sor.isp.illinois.gov/?lastName=${encodeURIComponent(l)}&firstName=${encodeURIComponent(f)}`,
  NY: () => `https://criminaljustice.ny.gov/SomsSUBDirectory/search_index.jsp`,
  OH: (l, f) => `https://services.dps.ohio.gov/SOR/Public/Reports/PersonByName?lastName=${encodeURIComponent(l)}&firstName=${encodeURIComponent(f)}`,
  GA: () => `https://gbi.georgia.gov/services/sex-offender-registry-search`,
  MI: () => `https://mspsor.com/Search.aspx`,
  NC: (l, f) => `https://sexoffender.ncsbi.gov/searchresults.aspx?LastName=${encodeURIComponent(l)}&FirstName=${encodeURIComponent(f)}`,
};

export default function OffenderMapView() {
  const [offenders, setOffenders] = useState<Offender[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Offender | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/realtime/offenders?limit=5000`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const arr: Offender[] = j.offenders ?? [];
        setOffenders(arr.filter((o) => o.lat != null && o.lng != null));
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const filtered = filter
    ? offenders.filter((o) => {
        const f = filter.toLowerCase();
        return (o.label || '').toLowerCase().includes(f)
          || (o.county || '').toLowerCase().includes(f)
          || (o.state || '').toLowerCase().includes(f);
      })
    : offenders;

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-[#020D14] text-[#E2E8F0]">
      <MapHeader
        accent="#A855F7"
        subtitle="REGISTERED OFFENDERS"
        rightSlot={
          <div className="text-right font-mono text-[10px] leading-tight text-[#94A3B8] sm:text-xs">
            {loading ? 'loading…' : (
              <>
                <div><span className="font-bold text-[#A855F7]">{offenders.length.toLocaleString()}</span> on map</div>
                {filter && <div><span className="font-bold text-[#A855F7]">{filtered.length.toLocaleString()}</span> matching</div>}
              </>
            )}
          </div>
        }
      />
      <div className="px-3 pt-2">
        <input
          type="text"
          placeholder="Filter by name, county, state…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full rounded border border-[#0D2235] bg-black/60 px-3 py-2 text-xs text-white placeholder-[#475569] backdrop-blur focus:border-[#A855F7] focus:outline-none"
        />
      </div>
      <div className="relative flex-1">
        <MapLoadingOverlay visible={loading} expectedCount={97061} layerName="offender" accent="#A855F7" />
        <MapContainer
          center={[35.5, -79.0]}
          zoom={6}
          minZoom={4}
          maxZoom={20}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
        >
          <MapInvalidator />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            subdomains={['a', 'b', 'c', 'd']}
            attribution="© CARTO © OpenStreetMap"
            maxZoom={20}
          />
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
            {filtered.map((o, i) => (
              <CircleMarker
                key={`off-${i}`}
                center={[o.lat!, o.lng!]}
                radius={3}
                pathOptions={{ color: '#A855F7', fillColor: '#A855F7', fillOpacity: 0.85, weight: 0 }}
                eventHandlers={{ click: () => setSelected(o) }}
              />
            ))}
          </MarkerClusterGroup>
        </MapContainer>
      </div>

      {selected && (() => {
        const d = (selected.details || {}) as Record<string, string | undefined>;
        const fullName = selected.label || '';
        let last = d.last || '';
        let first = d.first || '';
        if (!last && fullName.includes(',')) {
          last = fullName.split(',')[0].trim();
          first = (fullName.split(',')[1] || '').trim().split(/\s+/)[0];
        } else if (!last) {
          const parts = fullName.replace(/,/g, '').trim().split(/\s+/);
          if (parts.length >= 2) {
            last = parts[parts.length - 1];
            first = parts[0];
          }
        }
        const state = (d.state || selected.state || '').toUpperCase();
        const stateRegBuilder = STATE_REGISTRY_URLS[state];
        const stateRegUrl = stateRegBuilder ? stateRegBuilder(last, first) : null;
        const nsopwUrl = `https://www.nsopw.gov/SearchByName?lastName=${encodeURIComponent(last)}&firstName=${encodeURIComponent(first)}`;
        const googleImg = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(fullName + ' ' + state + ' sex offender registry')}`;
        const row = (label: string, value?: string | null) =>
          value ? <div key={label} className="flex justify-between gap-3 border-b border-[#0D2235]/50 py-1.5"><span className="font-mono text-[10px] uppercase tracking-widest text-[#64748B]">{label}</span><span className="text-right text-xs text-white">{value}</span></div> : null;

        return (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 p-4 backdrop-blur" onClick={() => setSelected(null)}>
            <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg border border-[#A855F7] bg-[#020D14] p-5" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[10px] font-black tracking-[0.4em] text-[#A855F7]">REGISTERED OFFENDER</div>
                <button onClick={() => setSelected(null)} className="rounded border border-[#0D2235] px-2 py-0.5 text-xs text-[#64748B] hover:text-[#E2E8F0]">✕</button>
              </div>

              {d.photo_url ? (
                <img src={d.photo_url} alt={fullName} className="mb-3 h-48 w-full rounded border border-[#0D2235] object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
              ) : (
                <div className="mb-3 rounded border border-dashed border-[#A855F7]/40 bg-[#A855F7]/5 p-3 text-center">
                  <div className="mb-2 text-[10px] font-black tracking-widest text-[#A855F7]">NO PHOTO IN BULK FEED</div>
                  <div className="mb-3 text-[11px] text-[#94A3B8]">Look up photo on the official registry:</div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {stateRegUrl && (
                      <a href={stateRegUrl} target="_blank" rel="noreferrer" className="rounded bg-[#A855F7] px-3 py-1.5 text-[10px] font-black tracking-widest text-white hover:bg-[#C084FC]">{state} REGISTRY ↗</a>
                    )}
                    <a href={nsopwUrl} target="_blank" rel="noreferrer" className="rounded border border-[#A855F7] px-3 py-1.5 text-[10px] font-black tracking-widest text-[#A855F7] hover:bg-[#A855F7]/10">NSOPW ↗</a>
                    <a href={googleImg} target="_blank" rel="noreferrer" className="rounded border border-[#0D2235] px-3 py-1.5 text-[10px] font-black tracking-widest text-[#94A3B8] hover:text-white">IMAGES ↗</a>
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
                {row('Classification', d.classification)}
                {row('Charge', d.charge)}
                {row('Conviction date', d.conviction_date)}
                {row('Address', d.address)}
                {row('City', d.city || selected.county)}
                {row('State', state)}
                {row('ZIP', d.zip)}
                {row('Registered', d.registered)}
                {row('Source', selected.agency)}
              </div>

              <p className="mt-4 text-[10px] text-[#475569]">
                Public registry data under federal Adam Walsh Act. Verify at the official source.
              </p>
            </div>
          </div>
        );
      })()}
    </main>
  );
}
