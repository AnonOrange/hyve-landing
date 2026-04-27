'use client'

// Pro-tier global cameras map. Surveillance moved to /spy/app/surveillance,
// offenders to /spy/app/offenders, crime to /spy/app/crime — this view is
// strictly worldwide live cameras (Windy + EarthCam + community sources).

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/leaflet.markercluster.js'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { CameraOverlay, type Camera } from '../CameraOverlay'
import MapHeader from '../MapHeader'
import MapLoadingOverlay from '../MapLoadingOverlay'

// Now hits /api/realtime/world-cams (Supabase-cached). Was 10MB direct download.

function lat(o: any) { return o?.lat ?? o?.latitude }
function lng(o: any) { return o?.lng ?? o?.longitude }

function MapInvalidator() {
  const map = useMap()
  useEffect(() => {
    const id = setTimeout(() => map.invalidateSize(), 100)
    return () => clearTimeout(id)
  }, [map])
  return null
}

export default function WorldMapView() {
  const [cameras, setCameras] = useState<Camera[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Camera | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/realtime/world-cams?limit=5000`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        const arr: Camera[] = j.cameras ?? []
        const valid = arr.filter((c) => lat(c) != null && lng(c) != null)
        setCameras(valid)
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [])

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-[#020D14] text-[#E2E8F0]">
      <MapHeader
        accent="#22C55E"
        subtitle="GLOBAL CAMERAS · PRO"
        rightSlot={
          <div className="text-right font-mono text-[10px] leading-tight text-[#94A3B8] sm:text-xs">
            {loading ? 'loading…' : (
              <div><span className="font-bold text-[#22C55E]">{cameras.length.toLocaleString()}</span> cams</div>
            )}
          </div>
        }
      />

      <div className="relative flex-1">
        <MapLoadingOverlay visible={loading} expectedCount={24410} layerName="worldwide camera" accent="#22C55E" />
        <MapContainer
          center={[20, 0]}
          zoom={2}
          minZoom={2}
          maxZoom={20}
          worldCopyJump
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
            maxClusterRadius={70}
            disableClusteringAtZoom={15}
            spiderfyOnMaxZoom
            removeOutsideVisibleBounds
            iconCreateFunction={(cluster: any) => {
              const c = cluster.getChildCount()
              const size = c < 100 ? 32 : c < 1000 ? 40 : 52
              return L.divIcon({
                html: `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:rgba(34,197,94,0.85);color:#020D14;font-weight:900;font-family:'Courier New',monospace;font-size:${c < 100 ? 11 : c < 1000 ? 13 : 14}px;border:2px solid #22C55E;border-radius:50%;box-shadow:0 0 12px rgba(34,197,94,0.6)">${c.toLocaleString()}</div>`,
                className: 'hyve-cam-cluster',
                iconSize: [size, size],
              })
            }}
          >
            {cameras.map((c, i) => (
              <CircleMarker
                key={`wc-${i}-${lat(c)}-${lng(c)}`}
                center={[lat(c)!, lng(c)!]}
                radius={4}
                pathOptions={{ color: '#22C55E', fillColor: '#22C55E', fillOpacity: 0.75, weight: 0 }}
                eventHandlers={{ click: () => setSelected(c) }}
              />
            ))}
          </MarkerClusterGroup>
        </MapContainer>
      </div>

      {selected && <CameraOverlay cam={selected} onClose={() => setSelected(null)} />}
    </main>
  )
}
