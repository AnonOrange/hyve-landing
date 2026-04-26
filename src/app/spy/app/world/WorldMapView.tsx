'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster/dist/leaflet.markercluster.js'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { CameraOverlay, type Camera } from '../CameraOverlay'

const API_BASE = 'https://hyve-api.vercel.app'

function lat(o: any) { return o?.lat ?? o?.latitude }
function lng(o: any) { return o?.lng ?? o?.longitude }

export default function WorldMapView() {
  const [cameras, setCameras] = useState<Camera[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Camera | null>(null)
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/cameras/world`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((arr: Camera[]) => {
        if (cancelled) return
        const valid = (Array.isArray(arr) ? arr : []).filter((c) => lat(c) != null && lng(c) != null)
        setCameras(valid)
        setCount(valid.length)
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [])

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#020D14] text-[#E2E8F0]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex items-center justify-between px-4 py-3"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="pointer-events-auto rounded-lg border border-[#0D2235] bg-[#020D14]/90 px-3 py-1.5 backdrop-blur">
          <div className="text-[10px] font-black tracking-[0.4em] text-[#22C55E]">GLOBAL · PRO</div>
          <div className="font-mono text-[10px] text-[#94A3B8]">
            {loading ? 'loading…' : `${count.toLocaleString()} live cameras worldwide`}
          </div>
        </div>
      </div>

      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxZoom={18}
        worldCopyJump
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://basemaps.cartocdn.com/dark_matter/{z}/{x}/{y}{r}.png"
          attribution="© CARTO © OpenStreetMap"
          maxZoom={20}
        />

        {!loading && (
          <MarkerClusterGroup
            chunkedLoading
            chunkInterval={50}
            chunkDelay={20}
            maxClusterRadius={70}
            disableClusteringAtZoom={13}
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
        )}
      </MapContainer>

      {selected && <CameraOverlay cam={selected} onClose={() => setSelected(null)} />}
    </main>
  )
}
