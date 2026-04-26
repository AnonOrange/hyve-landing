'use client'

// Leaflet-based map for the TV tab. Plots TvPin[] with category-colored
// markers and clusters overlapping ones (otherwise the screen would be
// solid red over Europe/Asia from iptv-org density).
//
// Imported via dynamic(..., { ssr: false }) from page.tsx because Leaflet
// touches `window` at module load.

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import type { TvPin } from './page'
import type { BroadcastCategory } from '@/lib/liveBroadcasts'

const IPTV_COLOR = '#94A3B8'

function makeIcon(color: string, label: string) {
  return L.divIcon({
    className: 'tv-pin',
    html: `<div style="
      width:18px;height:18px;border-radius:50%;
      background:${color};border:2px solid #020D14;
      box-shadow:0 0 0 2px ${color}55, 0 0 12px ${color}88;
      display:flex;align-items:center;justify-content:center;
      font-size:9px;color:#020D14;font-weight:bold;
    ">${label}</div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

const ICONS: Record<string, L.DivIcon> = {
  news: makeIcon('#EF4444', 'N'),
  government: makeIcon('#A855F7', 'G'),
  space: makeIcon('#22D3EE', 'S'),
  events: makeIcon('#F59E0B', 'C'),
  nature: makeIcon('#22C55E', '~'),
  music: makeIcon('#EC4899', '♪'),
  iptv: makeIcon(IPTV_COLOR, ''),
}

export default function TvMap({
  pins,
  onPick,
}: {
  pins: TvPin[]
  categoryColor: Record<BroadcastCategory, string>
  onPick: (p: TvPin) => void
}) {
  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      minZoom={2}
      maxZoom={10}
      worldCopyJump
      className="h-full w-full"
      style={{ background: '#020D14' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &middot; <a href="https://carto.com">CARTO</a>'
        url="https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png"
      />
      <MarkerClusterGroup
        chunkedLoading
        showCoverageOnHover={false}
        spiderfyOnMaxZoom
        maxClusterRadius={45}
      >
        {pins.map((p) => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={ICONS[p.category] || ICONS.iptv}
            eventHandlers={{ click: () => onPick(p) }}
          >
            <Popup>
              <div className="min-w-[160px] text-[12px]">
                <div className="font-bold">{p.flag ? `${p.flag} ` : ''}{p.name}</div>
                <div className="text-[10px] text-gray-500">{p.agency}</div>
                {p.description && (
                  <div className="mt-1 text-[10px] text-gray-700">{p.description}</div>
                )}
                <button
                  onClick={() => onPick(p)}
                  className="mt-2 rounded bg-red-600 px-2 py-1 text-[10px] font-bold text-white"
                >
                  ▶ WATCH
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  )
}
