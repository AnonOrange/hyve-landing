'use client'

import { useRef, useState } from 'react'
import { equirectClickToAngles } from '@/lib/attend/venues/equirect'

const inputClass =
  'rounded border border-[#2a2135] bg-[#111111] px-3 py-2 text-sm text-[#ede8d8] outline-none focus:border-[#E8C456]'
const primaryBtn =
  'rounded bg-[#E8C456] px-4 py-2 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-50'
const card = 'rounded-lg border border-[#2a2135] bg-[#0E1E3A] p-5'

type Venue = { id: string; slug: string; name: string }

export default function VenuesClient({ venues }: { venues: Venue[] }) {
  return (
    <div className="py-8">
      <NewVenue />
      {venues.length === 0 ? (
        <p className="mt-8 text-sm text-[#9e8a55]">
          No venues yet — create one above, then upload its 360° scan.
        </p>
      ) : (
        <div className="mt-8 flex flex-col gap-5">
          {venues.map((v) => (
            <VenueUploader key={v.id} venue={v} />
          ))}
        </div>
      )}
    </div>
  )
}

function NewVenue() {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/attend/venues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        window.location.reload()
        return
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? 'Could not create the venue')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={create} className={`${card} flex flex-col gap-3 sm:flex-row sm:items-end`}>
      <div className="flex-1">
        <label className="text-xs font-bold tracking-[0.2em] text-[#9e8a55]">NEW VENUE</label>
        <input
          required
          placeholder="Venue name (e.g. The Fillmore)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${inputClass} mt-1 w-full`}
        />
      </div>
      <button type="submit" disabled={busy} className={primaryBtn}>
        {busy ? 'Creating…' : 'Add venue'}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </form>
  )
}

type Placement = { xPct: number; yPct: number; azimuthDeg: number; elevationDeg: number }
type UploadResult = { status: string; warnings: string[]; errors: string[] }

function VenueUploader({ venue }: { venue: Venue }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [placement, setPlacement] = useState<Placement | null>(null)
  const [hFov, setHFov] = useState(60)
  const [scaleDesc, setScaleDesc] = useState('main entry door')
  const [scaleMeters, setScaleMeters] = useState(2.03)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<UploadResult | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setPlacement(null)
    setResult(null)
    setError(null)
    setPreviewUrl(f ? URL.createObjectURL(f) : null)
  }

  // Map a click on the flat equirectangular image to spherical angles. The
  // mapping is ratio-based, so rendered size vs natural size doesn't matter.
  function onImageClick(e: React.MouseEvent<HTMLImageElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const { azimuthDeg, elevationDeg } = equirectClickToAngles(x, y, rect.width, rect.height)
    setPlacement({
      xPct: (x / rect.width) * 100,
      yPct: (y / rect.height) * 100,
      azimuthDeg,
      elevationDeg,
    })
  }

  async function submit() {
    if (!file || !placement) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('azimuthDeg', String(placement.azimuthDeg))
      fd.append('elevationDeg', String(placement.elevationDeg))
      fd.append('hFovDeg', String(hFov))
      fd.append('scaleDescription', scaleDesc)
      fd.append('scaleMeters', String(scaleMeters))
      const res = await fetch(`/api/attend/venues/${venue.id}/assets`, {
        method: 'POST',
        body: fd,
      })
      const data = (await res.json().catch(() => ({}))) as {
        status?: string
        validation?: { warnings?: string[]; errors?: string[] }
        error?: string
      }
      if (!res.ok) {
        setError(data.error ?? 'Upload failed')
        return
      }
      setResult({
        status: data.status ?? 'UNKNOWN',
        warnings: data.validation?.warnings ?? [],
        errors: data.validation?.errors ?? [],
      })
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={card}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-black">{venue.name}</h2>
        <span className="font-mono text-[10px] tracking-widest text-[#9e8a55]">{venue.slug}</span>
      </div>

      <label className="mt-4 block text-xs font-bold tracking-[0.2em] text-[#9e8a55]">
        360° PANO (equirectangular 2:1)
      </label>
      <input
        type="file"
        accept="image/*"
        onChange={onPickFile}
        className="mt-1 block w-full text-sm text-[#9e8a55] file:mr-3 file:rounded file:border-0 file:bg-[#E8C456] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-black"
      />

      {previewUrl && (
        <>
          <p className="mt-4 text-xs text-[#9e8a55]">
            Click where the <span className="font-bold text-[#E8C456]">stage / screen</span> sits
            in the room. Centre of the image is &ldquo;straight ahead.&rdquo;
          </p>
          <div className="relative mt-2 overflow-hidden rounded border border-[#2a2135]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={previewUrl}
              alt="360 pano preview"
              onClick={onImageClick}
              className="block w-full cursor-crosshair"
            />
            {placement && (
              <span
                className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black bg-[#E8C456]"
                style={{ left: `${placement.xPct}%`, top: `${placement.yPct}%` }}
              />
            )}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold tracking-[0.2em] text-[#9e8a55]">
                STAGE WIDTH (FOV {hFov}°)
              </label>
              <input
                type="range"
                min={20}
                max={120}
                value={hFov}
                onChange={(e) => setHFov(Number(e.target.value))}
                className="mt-2 w-full accent-[#E8C456]"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-bold tracking-[0.2em] text-[#9e8a55]">
                  SCALE REF
                </label>
                <input
                  value={scaleDesc}
                  onChange={(e) => setScaleDesc(e.target.value)}
                  className={`${inputClass} mt-1 w-full`}
                />
              </div>
              <div className="w-24">
                <label className="text-xs font-bold tracking-[0.2em] text-[#9e8a55]">METRES</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  value={scaleMeters}
                  onChange={(e) => setScaleMeters(Number(e.target.value))}
                  className={`${inputClass} mt-1 w-full`}
                />
              </div>
            </div>
          </div>

          <button
            onClick={submit}
            disabled={busy || !placement}
            className={`${primaryBtn} mt-4`}
          >
            {busy ? 'Uploading…' : placement ? 'Save 360° scan' : 'Place the stage first'}
          </button>
        </>
      )}

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      {result && (
        <div className="mt-3 text-xs">
          <p
            className={
              result.status === 'VALIDATED'
                ? 'font-bold text-[#39FF14]'
                : 'font-bold text-red-400'
            }
          >
            {result.status === 'VALIDATED' ? '✓ Scan saved and validated' : '✗ Scan rejected'}
          </p>
          {result.warnings.length > 0 && (
            <p className="mt-1 text-[#E8C456]">Warnings: {result.warnings.join(', ')}</p>
          )}
          {result.errors.length > 0 && (
            <p className="mt-1 text-red-400">Errors: {result.errors.join(', ')}</p>
          )}
        </div>
      )}
    </section>
  )
}
