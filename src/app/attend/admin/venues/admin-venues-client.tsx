'use client'

import { useState } from 'react'

const inputClass =
  'rounded border border-[#2a2135] bg-[#111111] px-3 py-2 text-sm text-[#ede8d8] outline-none focus:border-[#E8C456]'
const btn = 'rounded px-3 py-1.5 text-xs font-bold transition disabled:opacity-50'

type Venue = { id: string; slug: string; name: string }

export default function AdminVenuesClient({ venues }: { venues: Venue[] }) {
  return (
    <div className="mt-5 flex flex-col gap-4">
      {venues.length === 0 ? (
        <p className="text-sm text-[#9e8a55]">No venues yet.</p>
      ) : (
        venues.map((v) => <MeshUpload key={v.id} venue={v} />)
      )}
    </div>
  )
}

function MeshUpload({ venue }: { venue: Venue }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [stageNode, setStageNode] = useState('ANCHOR_stage_screen')
  const [w, setW] = useState(8)
  const [h, setH] = useState(4.5)
  const [sx, setSx] = useState(0)
  const [sy, setSy] = useState(1.6)
  const [sz, setSz] = useState(8)
  const [yaw, setYaw] = useState(0)
  const [scaleDesc, setScaleDesc] = useState('main door')
  const [scaleMeters, setScaleMeters] = useState(2.03)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function submit() {
    if (!file) {
      setMsg('Choose a .glb file first')
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('stageNode', stageNode)
      fd.append('stageWidthM', String(w))
      fd.append('stageHeightM', String(h))
      fd.append('spawnX', String(sx))
      fd.append('spawnY', String(sy))
      fd.append('spawnZ', String(sz))
      fd.append('spawnYawDeg', String(yaw))
      fd.append('scaleDescription', scaleDesc)
      fd.append('scaleMeters', String(scaleMeters))
      const res = await fetch(`/api/attend/admin/venues/${venue.id}/mesh`, {
        method: 'POST',
        body: fd,
      })
      const data = (await res.json().catch(() => ({}))) as {
        status?: string
        validation?: { errors?: string[] }
        error?: string
      }
      if (!res.ok) {
        setMsg(data.error ?? 'Upload failed')
        return
      }
      setMsg(
        data.status === 'VALIDATED'
          ? '✓ Mesh saved and validated'
          : `✗ Rejected: ${data.validation?.errors?.join(', ') ?? 'invalid'}`,
      )
    } catch {
      setMsg('Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-lg border border-[#2a2135] bg-[#0E1E3A] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold">{venue.name}</span>
        <button
          onClick={() => setOpen((o) => !o)}
          className={`${btn} border border-[#2a2135] text-[#9e8a55] hover:text-[#E8C456]`}
        >
          {open ? 'Cancel' : 'Upload mesh'}
        </button>
      </div>
      {open && (
        <div className="mt-4 flex flex-col gap-3">
          <input
            type="file"
            accept=".glb,model/gltf-binary"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-[#9e8a55] file:mr-3 file:rounded file:border-0 file:bg-[#E8C456] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-black"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Labeled label="Stage node">
              <input value={stageNode} onChange={(e) => setStageNode(e.target.value)} className={`${inputClass} w-full`} />
            </Labeled>
            <Labeled label="Stage W (m)">
              <input type="number" step="0.1" value={w} onChange={(e) => setW(Number(e.target.value))} className={`${inputClass} w-full`} />
            </Labeled>
            <Labeled label="Stage H (m)">
              <input type="number" step="0.1" value={h} onChange={(e) => setH(Number(e.target.value))} className={`${inputClass} w-full`} />
            </Labeled>
            <Labeled label="Spawn X">
              <input type="number" step="0.1" value={sx} onChange={(e) => setSx(Number(e.target.value))} className={`${inputClass} w-full`} />
            </Labeled>
            <Labeled label="Spawn Y">
              <input type="number" step="0.1" value={sy} onChange={(e) => setSy(Number(e.target.value))} className={`${inputClass} w-full`} />
            </Labeled>
            <Labeled label="Spawn Z">
              <input type="number" step="0.1" value={sz} onChange={(e) => setSz(Number(e.target.value))} className={`${inputClass} w-full`} />
            </Labeled>
            <Labeled label="Spawn yaw°">
              <input type="number" step="1" value={yaw} onChange={(e) => setYaw(Number(e.target.value))} className={`${inputClass} w-full`} />
            </Labeled>
            <Labeled label="Scale ref">
              <input value={scaleDesc} onChange={(e) => setScaleDesc(e.target.value)} className={`${inputClass} w-full`} />
            </Labeled>
            <Labeled label="Scale (m)">
              <input type="number" step="0.01" value={scaleMeters} onChange={(e) => setScaleMeters(Number(e.target.value))} className={`${inputClass} w-full`} />
            </Labeled>
          </div>
          <button
            onClick={submit}
            disabled={busy}
            className={`${btn} self-start bg-[#E8C456] text-black hover:brightness-110`}
          >
            {busy ? 'Uploading…' : 'Save contracted mesh'}
          </button>
          {msg && <p className="text-xs text-[#9e8a55]">{msg}</p>}
        </div>
      )}
    </section>
  )
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-[10px] font-bold tracking-widest text-[#9e8a55]">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  )
}
