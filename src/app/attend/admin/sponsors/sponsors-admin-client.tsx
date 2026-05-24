'use client'

import { useState } from 'react'

const inputClass =
  'rounded border border-[#2a2135] bg-[#111111] px-3 py-2 text-sm text-[#ede8d8] outline-none focus:border-[#E8C456]'
const btn = 'rounded px-3 py-1.5 text-xs font-bold transition disabled:opacity-50'

const TIERS = ['PLATINUM', 'GOLD', 'SILVER', 'COMMUNITY']

type Sponsor = { id: string; name: string; url: string; tier: string; isActive: boolean }

export default function SponsorsAdminClient({ sponsors }: { sponsors: Sponsor[] }) {
  return (
    <div className="mt-5 flex flex-col gap-6">
      <AddSponsor />
      {sponsors.length === 0 ? (
        <p className="text-sm text-[#9e8a55]">No sponsors yet — add one above.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sponsors.map((s) => (
            <SponsorRow key={s.id} sponsor={s} />
          ))}
        </ul>
      )}
    </div>
  )
}

function AddSponsor() {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [tier, setTier] = useState('COMMUNITY')
  const [blurb, setBlurb] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/attend/admin/sponsors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url, logoUrl, tier, blurb }),
      })
      if (res.ok) {
        window.location.reload()
        return
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? 'Could not add the sponsor')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={add}
      className="flex flex-col gap-3 rounded-lg border border-[#2a2135] bg-[#0E1E3A] p-5"
    >
      <h3 className="text-xs font-black tracking-[0.2em] text-[#E8C456]">ADD A SPONSOR</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <input required placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        <input required placeholder="Website (https://…)" value={url} onChange={(e) => setUrl(e.target.value)} className={inputClass} />
        <input placeholder="Logo image URL (optional)" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className={inputClass} />
        <select value={tier} onChange={(e) => setTier(e.target.value)} className={inputClass}>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <input
        placeholder="Blurb (optional — e.g. age/responsibility notice for an alcohol sponsor)"
        value={blurb}
        onChange={(e) => setBlurb(e.target.value)}
        className={inputClass}
      />
      <button type="submit" disabled={busy} className={`${btn} self-start bg-[#E8C456] text-black hover:brightness-110`}>
        {busy ? 'Adding…' : 'Add sponsor'}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </form>
  )
}

function SponsorRow({ sponsor }: { sponsor: Sponsor }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function call(method: 'PATCH' | 'DELETE', body?: object) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/attend/admin/sponsors/${sponsor.id}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      if (res.ok) {
        window.location.reload()
        return
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? 'Action failed')
    } catch {
      setError('Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded border border-[#2a2135] bg-[#111111] px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-bold">{sponsor.name}</span>
          <span className="shrink-0 font-mono text-[9px] tracking-widest text-[#9e8a55]">{sponsor.tier}</span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest ${
              sponsor.isActive ? 'bg-[#39FF14]/15 text-[#39FF14]' : 'bg-[#2a2135] text-[#9e8a55]'
            }`}
          >
            {sponsor.isActive ? 'LIVE' : 'OFF'}
          </span>
        </div>
        <a href={sponsor.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-[#9e8a55] hover:text-[#E8C456]">
          {sponsor.url}
        </a>
        {error && <p className="text-[10px] text-red-400">{error}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          onClick={() => call('PATCH', { isActive: !sponsor.isActive })}
          disabled={busy}
          className={`${btn} border border-[#2a2135] text-[#9e8a55] hover:text-[#E8C456]`}
        >
          {sponsor.isActive ? 'Turn off' : 'Turn on'}
        </button>
        <button
          onClick={() => call('DELETE')}
          disabled={busy}
          className={`${btn} border border-[#2a2135] text-[#9e8a55] hover:text-red-400`}
        >
          Delete
        </button>
      </div>
    </li>
  )
}
