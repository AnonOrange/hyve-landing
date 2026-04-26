'use client';

// Dedicated surveillance-infrastructure map: Flock ALPR, EFF Atlas of Surveillance,
// OSM CCTV, ShotSpotter, drones, face recognition, etc. Sixteen sub-types behind
// a layer-toggle panel. Single-purpose so it loads fast and stays focused.

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/leaflet.markercluster.js';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import MarkerClusterGroup from 'react-leaflet-cluster';
import MapHeader from '../MapHeader';

const API_BASE = 'https://hyve-api.vercel.app';

type SurvCam = {
  id?: string;
  label?: string;
  agency?: string;
  source?: string;
  feedUrl?: string;
  lat?: number;
  lng?: number;
  surveillance_type?: string;
};

function MapInvalidator() {
  const map = useMap();
  useEffect(() => {
    const id = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(id);
  }, [map]);
  return null;
}

const LAYERS: { key: string; label: string; color: string; group: string }[] = [
  { key: 'alpr-flock',           label: 'Flock ALPR',                color: '#F59E0B', group: 'alpr' },
  { key: 'alpr',                 label: 'Other ALPR (EFF)',          color: '#FB923C', group: 'alpr' },
  { key: 'alpr-other',           label: 'OSM ALPR',                  color: '#FBBF24', group: 'alpr' },
  { key: 'public-cctv',          label: 'Public CCTV (OSM)',         color: '#22D3EE', group: 'cameras' },
  { key: 'camera-registry',      label: 'Camera Registries',         color: '#06B6D4', group: 'cameras' },
  { key: 'guard-camera',         label: 'Guard Cameras',             color: '#0EA5E9', group: 'cameras' },
  { key: 'gunshot-detection',    label: 'ShotSpotter',               color: '#EF4444', group: 'sensors' },
  { key: 'cell-site-simulator',  label: 'Stingrays',                 color: '#DC2626', group: 'sensors' },
  { key: 'face-recognition',     label: 'Face Recognition',          color: '#A855F7', group: 'people' },
  { key: 'body-worn-cameras',    label: 'Body-worn Cameras',         color: '#9333EA', group: 'people' },
  { key: 'video-analytics',      label: 'Video Analytics',           color: '#7C3AED', group: 'people' },
  { key: 'drones',               label: 'Drones',                    color: '#10B981', group: 'aerial' },
  { key: 'real-time-crime-center', label: 'Real-Time Crime Centers', color: '#F472B6', group: 'fusion' },
  { key: 'fusion-center',        label: 'Fusion Centers',            color: '#EC4899', group: 'fusion' },
  { key: 'third-party-platforms',label: 'Third-Party Platforms',     color: '#DB2777', group: 'fusion' },
  { key: 'predictive-policing',  label: 'Predictive Policing',       color: '#BE185D', group: 'fusion' },
];

const GROUPS = [
  { key: 'alpr', label: 'License-Plate Readers' },
  { key: 'cameras', label: 'Camera Networks' },
  { key: 'sensors', label: 'Sensors' },
  { key: 'people', label: 'Identity & Bio' },
  { key: 'aerial', label: 'Aerial' },
  { key: 'fusion', label: 'Fusion / Analytics' },
];

export default function SurveillanceMapView() {
  const [data, setData] = useState<SurvCam[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SurvCam | null>(null);
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/cameras/surveillance`)
      .then((r) => r.json())
      .then((arr: SurvCam[]) => {
        if (cancelled) return;
        setData((Array.isArray(arr) ? arr : []).filter((c) => c.lat != null && c.lng != null));
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const counts: Record<string, number> = {};
  for (const c of data) counts[c.surveillance_type || 'unknown'] = (counts[c.surveillance_type || 'unknown'] || 0) + 1;

  const toggle = (k: string) => setVisible((v) => ({ ...v, [k]: !v[k] }));
  const enableGroup = (g: string) => setVisible((v) => {
    const next = { ...v };
    for (const l of LAYERS) if (l.group === g) next[l.key] = true;
    return next;
  });
  const clearAll = () => setVisible({});

  const byType: Record<string, SurvCam[]> = {};
  for (const c of data) {
    const t = c.surveillance_type || 'unknown';
    if (!visible[t]) continue;
    if (!byType[t]) byType[t] = [];
    byType[t].push(c);
  }
  const totalOn = Object.values(byType).reduce((s, a) => s + a.length, 0);

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-[#020D14] text-[#E2E8F0]">
      <MapHeader
        accent="#F59E0B"
        subtitle="SURVEILLANCE INFRASTRUCTURE · PRO"
        rightSlot={
          <div className="flex items-center gap-3">
            <div className="text-right font-mono text-[10px] leading-tight text-[#94A3B8] sm:text-xs">
              {loading ? 'loading…' : (
                <>
                  <div><span className="font-bold text-[#F59E0B]">{data.length.toLocaleString()}</span> total</div>
                  <div><span className="font-bold text-[#F59E0B]">{totalOn.toLocaleString()}</span> visible</div>
                </>
              )}
            </div>
            <button
              onClick={() => setPanelOpen((v) => !v)}
              className="rounded border border-[#F59E0B] bg-[#F59E0B]/10 px-3 py-1.5 text-[10px] font-black tracking-widest text-[#F59E0B] hover:bg-[#F59E0B]/20"
            >
              {panelOpen ? '✕' : '☰ LAYERS'}
            </button>
          </div>
        }
      />

      <div className="relative flex-1">
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
          {Object.entries(byType).map(([type, cams]) => {
            const layer = LAYERS.find((l) => l.key === type);
            const color = layer?.color || '#FFFFFF';
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            return (
              <MarkerClusterGroup
                key={`surv-${type}`}
                chunkedLoading
                chunkInterval={50}
                chunkDelay={20}
                maxClusterRadius={60}
                disableClusteringAtZoom={15}
                spiderfyOnMaxZoom
                removeOutsideVisibleBounds
                iconCreateFunction={(cluster: any) => {
                  const count = cluster.getChildCount();
                  const size = count < 100 ? 28 : count < 1000 ? 36 : 46;
                  return L.divIcon({
                    html: `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:rgba(${r},${g},${b},0.85);color:#020D14;font-weight:900;font-family:'Courier New',monospace;font-size:${count < 100 ? 10 : 12}px;border:2px solid ${color};border-radius:4px;box-shadow:0 0 10px rgba(${r},${g},${b},0.6)">${count.toLocaleString()}</div>`,
                    className: 'hyve-surv-cluster',
                    iconSize: [size, size],
                  });
                }}
              >
                {cams.map((c, i) => (
                  <CircleMarker
                    key={`surv-${type}-${i}`}
                    center={[c.lat!, c.lng!]}
                    radius={3}
                    pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 0 }}
                    eventHandlers={{ click: () => setSelected(c) }}
                  />
                ))}
              </MarkerClusterGroup>
            );
          })}
        </MapContainer>

        {panelOpen && (
          <div className="absolute right-3 top-3 z-[1000] max-h-[calc(100vh-140px)] w-72 overflow-y-auto rounded-lg border border-[#0D2235] bg-[#020D14]/95 p-3 backdrop-blur">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10px] font-black tracking-[0.4em] text-[#F59E0B]">LAYERS</div>
              <button onClick={clearAll} className="rounded border border-[#0D2235] px-2 py-0.5 text-[10px] font-bold text-[#64748B] hover:text-[#FF2D2D]">CLEAR</button>
            </div>
            {GROUPS.map((g) => {
              const inGroup = LAYERS.filter((l) => l.group === g.key);
              return (
                <div key={g.key} className="mb-3">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="text-[10px] font-black tracking-widest text-[#94A3B8]">{g.label.toUpperCase()}</div>
                    <button onClick={() => enableGroup(g.key)} className="text-[9px] font-bold text-[#475569] hover:text-[#00D4FF]">+ ALL</button>
                  </div>
                  {inGroup.map((l) => (
                    <label key={l.key} className="flex cursor-pointer items-center justify-between gap-2 py-0.5">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={!!visible[l.key]} onChange={() => toggle(l.key)} className="accent-[#F59E0B]" />
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-sm" style={{ background: l.color }} />
                          <span className="text-xs text-[#E2E8F0]">{l.label}</span>
                        </div>
                      </div>
                      <span className="font-mono text-[10px] text-[#475569]">{(counts[l.key] || 0).toLocaleString()}</span>
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 p-4 backdrop-blur" onClick={() => setSelected(null)}>
          <div className="w-full max-w-md rounded-lg border border-[#F59E0B] bg-[#020D14] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10px] font-black tracking-[0.4em] text-[#F59E0B]">⚠ SURVEILLANCE</div>
              <button onClick={() => setSelected(null)} className="rounded border border-[#0D2235] px-2 py-0.5 text-xs text-[#64748B] hover:text-[#E2E8F0]">✕</button>
            </div>
            <div className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: LAYERS.find((l) => l.key === selected.surveillance_type)?.color || '#F59E0B' }}>
              {LAYERS.find((l) => l.key === selected.surveillance_type)?.label || selected.surveillance_type}
            </div>
            <div className="mb-4 text-base font-bold text-white">{selected.label}</div>
            <div className="mb-4 space-y-1 font-mono text-xs text-[#94A3B8]">
              <div>Lat/Lng: <span className="text-white">{selected.lat?.toFixed(5)}, {selected.lng?.toFixed(5)}</span></div>
              <div>Operator: <span className="text-white">{selected.agency || '—'}</span></div>
              <div>Source: <span className="text-white">{selected.source || 'community'}</span></div>
            </div>
            <p className="mb-3 text-xs text-[#94A3B8]">
              Surveillance infrastructure documented by EFF Atlas of Surveillance, DeFlock community DB,
              or OpenStreetMap. There is no live feed available — these are surveillance locations only.
            </p>
            {selected.feedUrl && (
              <a href={selected.feedUrl} target="_blank" rel="noreferrer" className="inline-block rounded bg-[#F59E0B] px-3 py-1.5 text-[10px] font-black tracking-widest text-[#020D14] hover:bg-white">
                LEARN MORE ↗
              </a>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
