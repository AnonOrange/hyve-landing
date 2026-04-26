'use client'

// Leaflet renderer for PULSE. Each PulsePoint becomes a CircleMarker:
//   - radius = 4 + intensity * 18 (more intense = bigger blob)
//   - color = green→amber→red ramp
//   - opacity = 0.4 + intensity * 0.5 (so cool spots are still visible)
//
// We don't cluster — that would defeat the heat-pattern visual. With ~2k feeds
// and up to a few hundred crime cells, plain rendering performs fine.

import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { PulsePoint } from './page'

function rampColor(intensity: number): string {
  if (intensity > 0.66) return '#EF4444'
  if (intensity > 0.33) return '#F59E0B'
  return '#22C55E'
}

export default function PulseMap({ points }: { points: PulsePoint[] }) {
  return (
    <MapContainer
      center={[39.8, -98.5]}
      zoom={4}
      minZoom={3}
      maxZoom={12}
      worldCopyJump
      className="h-full w-full"
      style={{ background: '#020D14' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &middot; CARTO'
        url="https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png"
      />
      {points.map((p) => {
        const color = rampColor(p.intensity)
        return (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={4 + p.intensity * 18}
            pathOptions={{
              color,
              weight: 1.5,
              fillColor: color,
              fillOpacity: 0.4 + p.intensity * 0.5,
            }}
          >
            <Popup>
              <div className="min-w-[160px] text-[12px]">
                <div className="font-bold">{p.label}</div>
                <div className="text-[10px] text-gray-500">{p.detail}</div>
                <div className="mt-1 font-mono text-[10px]" style={{ color }}>
                  intensity {Math.round(p.intensity * 100)}% · {p.source}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
