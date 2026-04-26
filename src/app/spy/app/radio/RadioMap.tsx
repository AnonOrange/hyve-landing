'use client'

// Leaflet map for the Radio tab. Same pattern as TvMap but with smaller,
// less obtrusive markers because radio station density is much higher
// (cluster a single big city = hundreds of pins).

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import type { RadioStation } from './page'

const RADIO_COLOR = '#22C55E'

const ICON = L.divIcon({
  className: 'radio-pin',
  html: `<div style="
    width:10px;height:10px;border-radius:50%;
    background:${RADIO_COLOR};border:1.5px solid #020D14;
    box-shadow:0 0 0 1px ${RADIO_COLOR}55, 0 0 8px ${RADIO_COLOR}99;
  "></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
})

export default function RadioMap({
  stations,
  onPick,
}: {
  stations: RadioStation[]
  onPick: (s: RadioStation) => void
}) {
  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      minZoom={2}
      maxZoom={12}
      worldCopyJump
      className="h-full w-full"
      style={{ background: '#020D14' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &middot; <a href="https://carto.com">CARTO</a> &middot; <a href="https://www.radio-browser.info">radio-browser.info</a>'
        url="https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png"
      />
      <MarkerClusterGroup
        chunkedLoading
        showCoverageOnHover={false}
        spiderfyOnMaxZoom
        maxClusterRadius={50}
      >
        {stations.map((s) => (
          <Marker
            key={s.id}
            position={[s.lat, s.lng]}
            icon={ICON}
            eventHandlers={{ click: () => onPick(s) }}
          >
            <Popup>
              <div className="min-w-[180px] text-[12px]">
                <div className="font-bold">{s.name}</div>
                <div className="text-[10px] text-gray-500">
                  {s.country}
                  {s.language && ` · ${s.language}`}
                  {s.bitrate ? ` · ${s.bitrate}kbps ${s.codec}` : ''}
                </div>
                {s.tags.length > 0 && (
                  <div className="mt-1 truncate text-[10px] text-gray-700">{s.tags.slice(0, 4).join(', ')}</div>
                )}
                <button
                  onClick={() => onPick(s)}
                  className="mt-2 rounded bg-green-600 px-2 py-1 text-[10px] font-bold text-white"
                >
                  ▶ TUNE IN
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  )
}
