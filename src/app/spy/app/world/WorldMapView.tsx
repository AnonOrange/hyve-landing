'use client'

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

const API_BASE = 'https://hyve-api.vercel.app'

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

type SurvCam = Camera & { surveillance_type?: string }

// Each surveillance type gets its own color so layered clusters are distinguishable.
const SURV_LAYERS: { key: string; label: string; color: string; group: 'alpr' | 'cameras' | 'sensors' | 'people' | 'aerial' | 'fusion' }[] = [
  // ALPR family
  { key: 'alpr-flock',           label: 'Flock ALPR',                color: '#F59E0B', group: 'alpr' },
  { key: 'alpr',                 label: 'Other ALPR (EFF)',          color: '#FB923C', group: 'alpr' },
  { key: 'alpr-other',           label: 'OSM ALPR',                  color: '#FBBF24', group: 'alpr' },
  // Camera networks
  { key: 'public-cctv',          label: 'Public CCTV (OSM)',         color: '#22D3EE', group: 'cameras' },
  { key: 'camera-registry',      label: 'Camera Registries',         color: '#06B6D4', group: 'cameras' },
  { key: 'guard-camera',         label: 'Guard Cameras',             color: '#0EA5E9', group: 'cameras' },
  // Sensors
  { key: 'gunshot-detection',    label: 'ShotSpotter',               color: '#EF4444', group: 'sensors' },
  { key: 'cell-site-simulator',  label: 'Stingrays',                 color: '#DC2626', group: 'sensors' },
  // People-watching tech
  { key: 'face-recognition',     label: 'Face Recognition',          color: '#A855F7', group: 'people' },
  { key: 'body-worn-cameras',    label: 'Body-worn Cameras',         color: '#9333EA', group: 'people' },
  { key: 'video-analytics',      label: 'Video Analytics',           color: '#7C3AED', group: 'people' },
  // Aerial
  { key: 'drones',               label: 'Drones',                    color: '#10B981', group: 'aerial' },
  // Fusion / analytics
  { key: 'real-time-crime-center', label: 'Real-Time Crime Centers', color: '#F472B6', group: 'fusion' },
  { key: 'fusion-center',        label: 'Fusion Centers',            color: '#EC4899', group: 'fusion' },
  { key: 'third-party-platforms',label: 'Third-Party Platforms',     color: '#DB2777', group: 'fusion' },
  { key: 'predictive-policing',  label: 'Predictive Policing',       color: '#BE185D', group: 'fusion' },
]

const GROUPS: { key: string; label: string }[] = [
  { key: 'alpr', label: 'License-Plate Readers' },
  { key: 'cameras', label: 'Camera Networks' },
  { key: 'sensors', label: 'Sensors' },
  { key: 'people', label: 'Identity & Bio' },
  { key: 'aerial', label: 'Aerial' },
  { key: 'fusion', label: 'Fusion / Analytics' },
]

export default function WorldMapView() {
  const [cameras, setCameras] = useState<Camera[]>([])
  const [surv, setSurv] = useState<SurvCam[]>([])
  const [loadingCams, setLoadingCams] = useState(true)
  const [loadingSurv, setLoadingSurv] = useState(true)
  const [selected, setSelected] = useState<Camera | null>(null)
  const [selectedSurv, setSelectedSurv] = useState<SurvCam | null>(null)
  const [camCount, setCamCount] = useState(0)
  const [showCams, setShowCams] = useState(true)
  const [survVisible, setSurvVisible] = useState<Record<string, boolean>>({})
  const [panelOpen, setPanelOpen] = useState(false)

  // Cameras
  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/cameras/world`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((arr: Camera[]) => {
        if (cancelled) return
        const valid = (Array.isArray(arr) ? arr : []).filter((c) => lat(c) != null && lng(c) != null)
        setCameras(valid); setCamCount(valid.length)
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoadingCams(false))
    return () => { cancelled = true }
  }, [])

  // Surveillance is lazy-loaded — only fetched the first time the user opens the
  // LAYERS panel. 164k records is too much to ship at first paint. Once loaded,
  // toggling individual sub-types just filters the cached array (instant).
  const [survLoaded, setSurvLoaded] = useState(false)
  const ensureSurvLoaded = () => {
    if (survLoaded) return
    setSurvLoaded(true)
    fetch(`${API_BASE}/cameras/surveillance`)
      .then((r) => r.json())
      .then((arr: SurvCam[]) => {
        const valid = (Array.isArray(arr) ? arr : []).filter((c) => lat(c) != null && lng(c) != null)
        setSurv(valid)
      })
      .catch(() => {})
      .finally(() => setLoadingSurv(false))
  }

  const survCounts: Record<string, number> = {}
  for (const c of surv) survCounts[c.surveillance_type || 'unknown'] = (survCounts[c.surveillance_type || 'unknown'] || 0) + 1

  const toggle = (key: string) => setSurvVisible((v) => ({ ...v, [key]: !v[key] }))
  const enableGroup = (g: string) =>
    setSurvVisible((v) => {
      const next = { ...v }
      for (const l of SURV_LAYERS) if (l.group === g) next[l.key] = true
      return next
    })
  const clearAll = () => setSurvVisible({})

  // Pre-bucket surv by type so we render N MarkerClusterGroups, one per visible type.
  const survByType: Record<string, SurvCam[]> = {}
  for (const c of surv) {
    const t = c.surveillance_type || 'unknown'
    if (!survVisible[t]) continue
    if (!survByType[t]) survByType[t] = []
    survByType[t].push(c)
  }
  const totalSurvOn = Object.values(survByType).reduce((s, a) => s + a.length, 0)

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-[#020D14] text-[#E2E8F0]">
      <MapHeader
        accent="#22C55E"
        subtitle="GLOBAL · PRO"
        rightSlot={
          <div className="flex items-center gap-3">
            <div className="text-right font-mono text-[10px] leading-tight text-[#94A3B8] sm:text-xs">
              {loadingCams ? (
                'loading…'
              ) : (
                <>
                  <div><span className="font-bold text-[#22C55E]">{camCount.toLocaleString()}</span> cams</div>
                  <div><span className="font-bold text-[#F59E0B]">{totalSurvOn.toLocaleString()}</span> surv on</div>
                </>
              )}
            </div>
            <button
              onClick={() => { ensureSurvLoaded(); setPanelOpen((v) => !v) }}
              className="rounded border border-[#F59E0B] bg-[#F59E0B]/10 px-3 py-1.5 text-[10px] font-black tracking-widest text-[#F59E0B] hover:bg-[#F59E0B]/20"
            >
              {panelOpen ? '✕' : '☰ LAYERS'}
            </button>
          </div>
        }
      />

      <div className="relative flex-1">
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

          {/* Cameras (green) */}
          {showCams && !loadingCams && (
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
          )}

          {/* Surveillance layers — one MarkerClusterGroup per enabled type */}
          {Object.entries(survByType).map(([type, cams]) => {
            const layer = SURV_LAYERS.find((l) => l.key === type)
            const color = layer?.color || '#FFFFFF'
            const label = layer?.label || type
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
                  const c = cluster.getChildCount()
                  const size = c < 100 ? 28 : c < 1000 ? 36 : 46
                  // hex → rgba
                  const r = parseInt(color.slice(1, 3), 16)
                  const g = parseInt(color.slice(3, 5), 16)
                  const b = parseInt(color.slice(5, 7), 16)
                  return L.divIcon({
                    html: `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:rgba(${r},${g},${b},0.85);color:#020D14;font-weight:900;font-family:'Courier New',monospace;font-size:${c < 100 ? 10 : 12}px;border:2px solid ${color};border-radius:4px;box-shadow:0 0 10px rgba(${r},${g},${b},0.6)">${c.toLocaleString()}</div>`,
                    className: 'hyve-surv-cluster',
                    iconSize: [size, size],
                  })
                }}
              >
                {cams.map((c, i) => (
                  <CircleMarker
                    key={`surv-${type}-${i}`}
                    center={[lat(c)!, lng(c)!]}
                    radius={3}
                    pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 0 }}
                    eventHandlers={{ click: () => setSelectedSurv(c) }}
                  />
                ))}
              </MarkerClusterGroup>
            )
          })}
        </MapContainer>

        {/* Layer toggle panel */}
        {panelOpen && (
          <div className="absolute right-3 top-3 z-[1000] max-h-[calc(100vh-140px)] w-72 overflow-y-auto rounded-lg border border-[#0D2235] bg-[#020D14]/95 p-3 backdrop-blur">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10px] font-black tracking-[0.4em] text-[#F59E0B]">SURVEILLANCE LAYERS</div>
              <button onClick={clearAll} className="rounded border border-[#0D2235] px-2 py-0.5 text-[10px] font-bold text-[#64748B] hover:text-[#FF2D2D]">CLEAR</button>
            </div>
            <div className="mb-3 font-mono text-[10px] text-[#475569]">
              {loadingSurv ? 'loading…' : `${surv.length.toLocaleString()} total markers · ${totalSurvOn.toLocaleString()} on`}
            </div>

            <div className="mb-3 border-b border-[#0D2235] pb-2">
              <label className="flex cursor-pointer items-center justify-between gap-2 py-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showCams}
                    onChange={(e) => setShowCams(e.target.checked)}
                    className="accent-[#22C55E]"
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: '#22C55E' }} />
                    <span className="text-xs text-white">Live cameras</span>
                  </div>
                </div>
                <span className="font-mono text-[10px] text-[#475569]">{camCount.toLocaleString()}</span>
              </label>
            </div>

            {GROUPS.map((g) => {
              const layers = SURV_LAYERS.filter((l) => l.group === g.key)
              return (
                <div key={g.key} className="mb-3">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="text-[10px] font-black tracking-widest text-[#94A3B8]">{g.label.toUpperCase()}</div>
                    <button onClick={() => enableGroup(g.key)} className="text-[9px] font-bold text-[#475569] hover:text-[#00D4FF]">+ ALL</button>
                  </div>
                  {layers.map((l) => (
                    <label key={l.key} className="flex cursor-pointer items-center justify-between gap-2 py-0.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!survVisible[l.key]}
                          onChange={() => toggle(l.key)}
                          className="accent-[#F59E0B]"
                        />
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-sm" style={{ background: l.color }} />
                          <span className="text-xs text-[#E2E8F0]">{l.label}</span>
                        </div>
                      </div>
                      <span className="font-mono text-[10px] text-[#475569]">{(survCounts[l.key] || 0).toLocaleString()}</span>
                    </label>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Camera popout (live feeds) */}
      {selected && <CameraOverlay cam={selected} onClose={() => setSelected(null)} />}

      {/* Surveillance info modal — these aren't watchable; show context */}
      {selectedSurv && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 p-4 backdrop-blur" onClick={() => setSelectedSurv(null)}>
          <div className="w-full max-w-md rounded-lg border border-[#F59E0B] bg-[#020D14] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10px] font-black tracking-[0.4em] text-[#F59E0B]">⚠ SURVEILLANCE</div>
              <button onClick={() => setSelectedSurv(null)} className="rounded border border-[#0D2235] px-2 py-0.5 text-xs text-[#64748B] hover:text-[#E2E8F0]">✕</button>
            </div>
            <div className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: SURV_LAYERS.find((l) => l.key === selectedSurv.surveillance_type)?.color || '#F59E0B' }}>
              {SURV_LAYERS.find((l) => l.key === selectedSurv.surveillance_type)?.label || selectedSurv.surveillance_type}
            </div>
            <div className="mb-4 text-base font-bold text-white">{selectedSurv.label}</div>
            <div className="mb-4 space-y-1 font-mono text-xs text-[#94A3B8]">
              <div>Lat/Lng: <span className="text-white">{selectedSurv.lat?.toFixed(5)}, {selectedSurv.lng?.toFixed(5)}</span></div>
              <div>Operator: <span className="text-white">{selectedSurv.agency || '—'}</span></div>
              <div>Source: <span className="text-white">{(selectedSurv as any).source || 'community'}</span></div>
            </div>
            <p className="mb-3 text-xs text-[#94A3B8]">
              Surveillance infrastructure documented by EFF Atlas of Surveillance, DeFlock community DB,
              or OpenStreetMap. There is no live feed available — these are surveillance locations only.
            </p>
            {selectedSurv.feedUrl && (
              <a
                href={selectedSurv.feedUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block rounded bg-[#F59E0B] px-3 py-1.5 text-[10px] font-black tracking-widest text-[#020D14] hover:bg-white"
              >
                LEARN MORE ↗
              </a>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
