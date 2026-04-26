'use client'

// Leaflet renderer for PANOPTICON. Click anywhere on the map to drop a pin
// — that becomes the search center for the 1mi surveillance density score.
//
// Markers within 1mi of the active pin are highlighted; outside ones stay
// dim. Clustering at zoom-out keeps render perf reasonable across 164k
// markers (without it the page hangs on every pan).

import { MapContainer, TileLayer, Circle, CircleMarker, Marker, useMapEvents } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import type { Surveillance } from './page'

const PIN_ICON = L.divIcon({
  className: 'panop-pin',
  html: `<div style="
    width:22px;height:22px;border-radius:50%;
    background:#A855F7;border:3px solid #020D14;
    box-shadow:0 0 0 3px #A855F7AA, 0 0 16px #A855F7;
  "></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export default function PanopMap({
  markers,
  pin,
  radiusMi,
  onClick,
}: {
  markers: Surveillance[]
  pin: [number, number] | null
  radiusMi: number
  onClick: (lat: number, lng: number) => void
}) {
  const radiusM = radiusMi * 1609.34

  return (
    <MapContainer
      center={pin || [39.8, -98.5]}
      zoom={pin ? 14 : 4}
      minZoom={3}
      maxZoom={18}
      worldCopyJump
      className="h-full w-full"
      style={{ background: '#020D14' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &middot; CARTO'
        url="https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png"
      />
      <ClickHandler onClick={onClick} />

      {pin && (
        <>
          <Circle
            center={pin}
            radius={radiusM}
            pathOptions={{ color: '#A855F7', weight: 2, fillColor: '#A855F7', fillOpacity: 0.07 }}
          />
          <Marker position={pin} icon={PIN_ICON} />
        </>
      )}

      {/*
        interactive:false on the dots so map clicks pass through to the
        ClickHandler — without this the user can only set a pin in the
        gaps between markers, which feels like the click "isn't working".
      */}
      <MarkerClusterGroup chunkedLoading showCoverageOnHover={false} maxClusterRadius={45}>
        {markers.map((m) => (
          <CircleMarker
            key={m.id}
            center={[m.lat, m.lng]}
            radius={3}
            interactive={false}
            pathOptions={{
              color: '#94A3B8',
              weight: 1,
              fillColor: '#94A3B8',
              fillOpacity: 0.55,
              interactive: false,
            }}
          />
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  )
}
