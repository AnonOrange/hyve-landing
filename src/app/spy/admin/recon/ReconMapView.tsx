'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet'
import L from 'leaflet'
// Leaflet base stylesheet is required for tile positioning + container layout.
// /spy/admin/recon doesn't inherit the /spy/app layout that imports it globally,
// so we MUST import it here directly or the map renders blank.
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/leaflet.markercluster.js'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { CameraOverlay, type Camera } from '../../app/CameraOverlay'
import MapHeader from '../../app/MapHeader'

function MapInvalidator() {
  const map = useMap()
  useEffect(() => {
    const id = setTimeout(() => map.invalidateSize(), 100)
    return () => clearTimeout(id)
  }, [map])
  return null
}

function lat(o: any) { return o?.lat ?? o?.latitude }
function lng(o: any) { return o?.lng ?? o?.longitude }

export default function ReconMapView({ initial }: { initial: Camera[] }) {
  const [cams, setCams] = useState<Camera[]>(initial)
  const [selected, setSelected] = useState<Camera | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ url: '', label: '', lat: '', lng: '', type: 'snapshot' })
  const [adding, setAdding] = useState(false)
  const [addErr, setAddErr] = useState<string | null>(null)

  const refresh = async () => {
    try {
      const r = await fetch('/api/spy/admin/recon', { cache: 'no-store' })
      if (r.ok) {
        const j = await r.json()
        setCams((j.cameras || []).filter((c: any) => lat(c) != null && lng(c) != null))
      }
    } catch {}
  }

  useEffect(() => {
    const i = setInterval(refresh, 60_000)
    return () => clearInterval(i)
  }, [])

  const submitAdd = async (e: FormEvent) => {
    e.preventDefault()
    setAdding(true)
    setAddErr(null)
    try {
      const r = await fetch('/api/spy/admin/recon/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: form.url,
          label: form.label,
          lat: parseFloat(form.lat),
          lng: parseFloat(form.lng),
          type: form.type,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'failed')
      setForm({ url: '', label: '', lat: '', lng: '', type: 'snapshot' })
      setFormOpen(false)
      await refresh()
    } catch (e: any) {
      setAddErr(e.message || 'failed')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="flex h-[85vh] w-full flex-col overflow-hidden rounded-lg border border-[#FF2D2D]/40">
      <MapHeader
        accent="#FF2D2D"
        subtitle="RECON · INTERNAL"
        rightSlot={
          <>
            <div className="hidden text-right font-mono text-[10px] leading-tight text-[#94A3B8] sm:block">
              <div><span className="font-bold text-[#FF2D2D]">{cams.length.toLocaleString()}</span> cams</div>
              <div className="text-[#475569]">DO NOT SHARE</div>
            </div>
            <button
              onClick={() => setFormOpen((v) => !v)}
              className="rounded border border-[#FF2D2D] px-3 py-1.5 text-[10px] font-black tracking-widest text-[#FF2D2D] hover:bg-[#FF2D2D]/10"
            >
              {formOpen ? '✕ CLOSE' : '+ ADD'}
            </button>
          </>
        }
      />
      <div className="relative flex-1">

      {formOpen && (
        <form
          onSubmit={submitAdd}
          className="absolute right-3 top-16 z-[1100] w-80 space-y-2 rounded-lg border border-[#FF2D2D] bg-[#020D14]/95 p-3 backdrop-blur"
        >
          <div className="text-[10px] font-black tracking-widest text-[#FF2D2D]">ADD RECON CAMERA</div>
          <input
            required
            placeholder="snapshot URL (jpg / mjpg / hls)"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            className="w-full rounded border border-[#0D2235] bg-black/60 px-2 py-1.5 font-mono text-xs text-white outline-none focus:border-[#FF2D2D]"
          />
          <input
            placeholder="label (optional)"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="w-full rounded border border-[#0D2235] bg-black/60 px-2 py-1.5 text-xs text-white outline-none focus:border-[#FF2D2D]"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              required
              placeholder="lat"
              value={form.lat}
              onChange={(e) => setForm({ ...form, lat: e.target.value })}
              className="w-full rounded border border-[#0D2235] bg-black/60 px-2 py-1.5 font-mono text-xs text-white outline-none focus:border-[#FF2D2D]"
            />
            <input
              required
              placeholder="lng"
              value={form.lng}
              onChange={(e) => setForm({ ...form, lng: e.target.value })}
              className="w-full rounded border border-[#0D2235] bg-black/60 px-2 py-1.5 font-mono text-xs text-white outline-none focus:border-[#FF2D2D]"
            />
          </div>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full rounded border border-[#0D2235] bg-black/60 px-2 py-1.5 text-xs text-white outline-none focus:border-[#FF2D2D]"
          >
            <option value="snapshot">snapshot (jpg/mjpg)</option>
            <option value="hls">hls (.m3u8)</option>
            <option value="webview">webview (iframe)</option>
            <option value="youtube">youtube</option>
          </select>
          <button
            type="submit"
            disabled={adding}
            className="w-full rounded bg-[#FF2D2D] py-1.5 text-[10px] font-black tracking-widest text-white hover:bg-[#FF5555] disabled:opacity-50"
          >
            {adding ? 'ADDING…' : 'ADD'}
          </button>
          {addErr && <div className="font-mono text-[10px] text-[#FF2D2D]">{addErr}</div>}
        </form>
      )}
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxZoom={20}
        worldCopyJump
        zoomControl={true}
        scrollWheelZoom
        doubleClickZoom
        touchZoom
        dragging
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
          maxClusterRadius={70}
          disableClusteringAtZoom={15}
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
    </div>
  )
}
