'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import MapHeader from '../MapHeader';

const API_BASE = 'https://hyve-api.vercel.app';

type CrimePoint = {
  feedId: string;
  lat: number;
  lng: number;
  intensity: number;
  count: number;
  source: string;
  baselineCity?: string;
};

function MapInvalidator() {
  const map = useMap();
  useEffect(() => {
    const id = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(id);
  }, [map]);
  return null;
}

export default function CrimeMapView() {
  const [points, setPoints] = useState<CrimePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/crime/heatmap`)
      .then((r) => r.json())
      .then((arr: any[]) => {
        if (cancelled) return;
        setPoints(
          (Array.isArray(arr) ? arr : []).filter(
            (p: any) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng) && (p?.intensity ?? 0) > 0,
          ),
        );
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-[#020D14] text-[#E2E8F0]">
      <MapHeader
        accent="#EF4444"
        subtitle="CRIME INTENSITY"
        rightSlot={
          <div className="text-right font-mono text-[10px] leading-tight text-[#94A3B8] sm:text-xs">
            {loading ? 'loading…' : (
              <div><span className="font-bold text-[#EF4444]">{points.length.toLocaleString()}</span> hot zones</div>
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
          {points.map((p, i) => {
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
        </MapContainer>
        <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded border border-[#0D2235] bg-black/80 p-3 font-mono text-[10px] text-[#94A3B8] backdrop-blur">
          <div className="mb-1 text-[9px] font-black tracking-widest text-[#EF4444]">INTENSITY</div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#EF4444] opacity-30" />
            <span>low</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#EF4444] opacity-60" />
            <span>medium</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-full bg-[#EF4444] opacity-90" />
            <span>high</span>
          </div>
        </div>
      </div>
    </main>
  );
}
