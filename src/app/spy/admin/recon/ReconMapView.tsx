'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster/dist/leaflet.markercluster.js'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { CameraOverlay, type Camera } from '../../app/CameraOverlay'

function lat(o: any) { return o?.lat ?? o?.latitude }
function lng(o: any) { return o?.lng ?? o?.longitude }

export default function ReconMapView({ initial }: { initial: Camera[] }) {
  const [cams, setCams] = useState<Camera[]>(initial)
  const [selected, setSelected] = useState<Camera | null>(null)

  useEffect(() => {
    // Refresh every 60s while page open
    const i = setInterval(async () => {
      try {
        const r = await fetch('/api/spy/admin/recon', { cache: 'no-store' })
        if (r.ok) {
          const j = await r.json()
          setCams((j.cameras || []).filter((c: any) => lat(c) != null && lng(c) != null))
        }
      } catch {}
    }, 60_000)
    return () => clearInterval(i)
  }, [])

  return (
    <div className="relative h-[80vh] w-full overflow-hidden rounded-lg border border-[#FF2D2D]/40">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex items-center justify-between px-4 py-3">
        <div className="pointer-events-auto rounded-lg border border-[#FF2D2D] bg-[#020D14]/95 px-3 py-1.5 backdrop-blur">
          <div className="text-[10px] font-black tracking-[0.4em] text-[#FF2D2D]">RECON · INTERNAL</div>
          <div className="font-mono text-[10px] text-[#94A3B8]">
            {cams.length.toLocaleString()} unsecured cams · DO NOT SHARE
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
          attribution="© CARTO"
          maxZoom={20}
        />
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={70}
          disableClusteringAtZoom={13}
          spiderfyOnMaxZoom
          iconCreateFunction={(cluster: any) => {
            const c = cluster.getChildCount()
            const size = c < 50 ? 30 : c < 500 ? 38 : 48
            return L.divIcon({
              html: `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:rgba(255,45,45,0.85);color:#020D14;font-weight:900;font-family:'Courier New',monospace;font-size:${c < 50 ? 11 : 13}px;border:2px solid #FF2D2D;border-radius:50%;box-shadow:0 0 12px rgba(255,45,45,0.6)">${c.toLocaleString()}</div>`,
              className: 'hyve-recon-cluster',
              iconSize: [size, size],
            })
          }}
        >
          {cams.map((c, i) => (
            <CircleMarker
              key={`recon-${i}-${lat(c)}-${lng(c)}`}
              center={[lat(c)!, lng(c)!]}
              radius={4}
              pathOptions={{ color: '#FF2D2D', fillColor: '#FF2D2D', fillOpacity: 0.75, weight: 0 }}
              eventHandlers={{ click: () => setSelected(c) }}
            />
          ))}
        </MarkerClusterGroup>
      </MapContainer>
      {selected && <CameraOverlay cam={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
