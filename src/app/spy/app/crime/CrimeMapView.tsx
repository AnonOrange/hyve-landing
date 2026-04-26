'use client';

// Real crime incident reports — discrete pins with category icons.
// Sources: Chicago, SF, DC, NYC open-data portals (4 cities, last 30 days,
// refreshed daily). Each pin is a single reported incident, not aggregated.

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/leaflet.markercluster.js';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Marker, Popup } from 'react-leaflet';
import MapHeader from '../MapHeader';
import MapLoadingOverlay from '../MapLoadingOverlay';

const API_BASE = 'https://hyve-api.vercel.app';

type CrimeIncident = {
  id: string;
  city: string;
  category: string;
  subcategory: string | null;
  description: string | null;
  lat: number;
  lng: number;
  occurred_at: string;
  source: string;
};

// Category taxonomy: emoji + color + display label. Frontend renders the icon
// directly via Leaflet divIcon — no SVG sprite needed.
const CATEGORY_META: Record<string, { icon: string; color: string; label: string }> = {
  homicide:  { icon: '💀', color: '#7F1D1D', label: 'Homicide' },
  shooting:  { icon: '🔫', color: '#DC2626', label: 'Shooting / weapons' },
  sex:       { icon: '⚠',  color: '#A855F7', label: 'Sex offense' },
  robbery:   { icon: '💰', color: '#EA580C', label: 'Robbery' },
  assault:   { icon: '👊', color: '#F59E0B', label: 'Assault' },
  arson:     { icon: '🔥', color: '#EF4444', label: 'Arson' },
  burglary:  { icon: '🏚', color: '#0EA5E9', label: 'Burglary' },
  vehicle:   { icon: '🚗', color: '#06B6D4', label: 'Vehicle theft' },
  theft:     { icon: '🛒', color: '#22D3EE', label: 'Theft / larceny' },
  vandalism: { icon: '🎨', color: '#A3E635', label: 'Vandalism' },
  drug:      { icon: '💊', color: '#10B981', label: 'Drugs' },
  fraud:     { icon: '💳', color: '#FBBF24', label: 'Fraud' },
  other:     { icon: '❓', color: '#94A3B8', label: 'Other' },
};

function MapInvalidator() {
  const map = useMap();
  useEffect(() => {
    const id = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(id);
  }, [map]);
  return null;
}

function makeIcon(category: string) {
  const meta = CATEGORY_META[category] || CATEGORY_META.other;
  return L.divIcon({
    html: `<div style="
      width:28px;height:28px;
      display:flex;align-items:center;justify-content:center;
      background:${meta.color};
      border:2px solid #020D14;
      border-radius:50%;
      box-shadow:0 0 8px ${meta.color}80;
      font-size:14px;
      ">${meta.icon}</div>`,
    className: 'hyve-crime-icon',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const sec = Math.max(0, (Date.now() - t) / 1000);
  if (sec < 60) return `${Math.floor(sec)}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export default function CrimeMapView() {
  const [incidents, setIncidents] = useState<CrimeIncident[]>([]);
  const [loading, setLoading] = useState(true);
  // All categories ON by default — user toggles off what they don't want
  const [enabledCats, setEnabledCats] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    Object.keys(CATEGORY_META).forEach((k) => (init[k] = true));
    return init;
  });

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/crime/incidents?limit=10000`)
      .then((r) => r.json())
      .then((arr: CrimeIncident[]) => {
        if (cancelled) return;
        setIncidents(
          (Array.isArray(arr) ? arr : []).filter(
            (p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng),
          ),
        );
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const toggleCat = (k: string) => setEnabledCats((v) => ({ ...v, [k]: !v[k] }));

  const visible = incidents.filter((i) => enabledCats[i.category] !== false);

  // Bucket counts (for chip badges)
  const counts: Record<string, number> = {};
  for (const i of incidents) counts[i.category] = (counts[i.category] || 0) + 1;

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-[#020D14] text-[#E2E8F0]">
      <MapHeader
        accent="#EF4444"
        subtitle="CRIME REPORTS · LIVE"
        rightSlot={
          <div className="text-right font-mono text-[10px] leading-tight text-[#94A3B8] sm:text-xs">
            {loading ? 'loading…' : (
              <>
                <div><span className="font-bold text-[#EF4444]">{incidents.length.toLocaleString()}</span> total</div>
                <div><span className="font-bold text-[#EF4444]">{visible.length.toLocaleString()}</span> visible</div>
              </>
            )}
          </div>
        }
      />

      {/* Category filter chips */}
      <div className="flex w-full gap-1.5 overflow-x-auto px-3 pt-2 pb-1">
        {Object.entries(CATEGORY_META).map(([key, meta]) => {
          const on = enabledCats[key] !== false;
          const n = counts[key] || 0;
          if (n === 0) return null;
          return (
            <button
              key={key}
              onClick={() => toggleCat(key)}
              className="shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-widest backdrop-blur transition"
              style={{
                borderColor: on ? meta.color : '#0D2235',
                background: on ? `${meta.color}1F` : 'rgba(0,0,0,0.6)',
                color: on ? meta.color : '#64748B',
              }}
            >
              <span className="mr-1">{meta.icon}</span>
              {meta.label.toUpperCase()} <span className="ml-1 opacity-70">{n.toLocaleString()}</span>
            </button>
          );
        })}
      </div>

      <div className="relative flex-1">
        <MapLoadingOverlay visible={loading} expectedCount={15699} layerName="crime" accent="#EF4444" />
        <MapContainer
          center={[39.8, -98.5]}
          zoom={4}
          minZoom={3}
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
              const size = c < 100 ? 36 : c < 1000 ? 44 : 56;
              return L.divIcon({
                html: `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:rgba(239,68,68,0.85);color:#020D14;font-weight:900;font-family:'Courier New',monospace;font-size:${c < 100 ? 12 : 14}px;border:2px solid #EF4444;border-radius:50%;box-shadow:0 0 12px rgba(239,68,68,0.6)">${c.toLocaleString()}</div>`,
                className: 'hyve-crime-cluster',
                iconSize: [size, size],
              });
            }}
          >
            {visible.map((i) => {
              const meta = CATEGORY_META[i.category] || CATEGORY_META.other;
              return (
                <Marker key={i.id} position={[i.lat, i.lng]} icon={makeIcon(i.category)}>
                  <Popup>
                    <div className="min-w-[220px]">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-lg">{meta.icon}</span>
                        <span className="text-[10px] font-black tracking-widest" style={{ color: meta.color }}>
                          {meta.label.toUpperCase()}
                        </span>
                      </div>
                      <div className="mb-1 text-sm font-bold text-[#020D14]">{i.subcategory || meta.label}</div>
                      {i.description && i.description !== i.subcategory && (
                        <div className="mb-1 text-xs text-[#475569]">{i.description}</div>
                      )}
                      <div className="font-mono text-[10px] text-[#64748B]">
                        {i.city} · {timeAgo(i.occurred_at)}
                      </div>
                      <div className="font-mono text-[9px] text-[#94A3B8]">
                        Source: {i.source}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MarkerClusterGroup>
        </MapContainer>
      </div>
    </main>
  );
}
