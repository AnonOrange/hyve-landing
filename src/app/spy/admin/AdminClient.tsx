'use client'

import { useState } from 'react'

type Dashboard = {
  counts: {
    cameras: { active: number; total: number; hidden: number }
    feeds: { active: number; total: number }
    discovery_pending: number
  }
  by_state: { state: string; n: number }[]
  by_type: { type: string; n: number }[]
  recent_additions: any[]
  dead_pile: any[]
  agents: {
    agent: string
    last_status: string
    last_started: string
    age_minutes: number
    stale: boolean
    last_error?: string
  }[]
  recent_runs: any[]
  generated_at: string
}

type Candidate = {
  id: string
  source: string
  candidate_url: string
  candidate_name: string | null
  candidate_type: string | null
  candidate_lat: number | null
  candidate_lng: number | null
  created_at: string
}

export default function AdminClient({ initial, queue: initialQueue }: { initial: Dashboard; queue: Candidate[] }) {
  const [data, setData] = useState<Dashboard>(initial)
  const [queue, setQueue] = useState<Candidate[]>(initialQueue)
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = async () => {
    setBusy('refresh')
    try {
      const [d, q] = await Promise.all([
        fetch('/api/spy/admin/dashboard', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/spy/admin/queue', { cache: 'no-store' }).then((r) => r.json()),
      ])
      setData(d)
      setQueue(q.candidates || [])
    } finally {
      setBusy(null)
    }
  }

  const approve = async (id: string) => {
    setBusy(`approve:${id}`)
    try {
      const cand = queue.find((c) => c.id === id)
      const res = await fetch(`/api/spy/admin/queue/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: cand?.candidate_lat ?? null,
          lng: cand?.candidate_lng ?? null,
        }),
      })
      if (res.ok) setQueue((q) => q.filter((c) => c.id !== id))
    } finally {
      setBusy(null)
    }
  }

  const reject = async (id: string) => {
    setBusy(`reject:${id}`)
    try {
      const res = await fetch(`/api/spy/admin/queue/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'manual_reject' }),
      })
      if (res.ok) setQueue((q) => q.filter((c) => c.id !== id))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase tracking-widest text-[#475569]">
          generated {new Date(data.generated_at).toLocaleString()}
        </div>
        <button
          onClick={refresh}
          disabled={busy === 'refresh'}
          className="rounded border border-[#00D4FF] bg-[#00D4FF]/10 px-3 py-1 text-[10px] font-black tracking-widest text-[#00D4FF] hover:bg-[#00D4FF]/20 disabled:opacity-50"
        >
          {busy === 'refresh' ? 'REFRESHING…' : '↻ REFRESH'}
        </button>
      </div>

      {/* TOP COUNTS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Active cameras" value={data.counts.cameras.active.toLocaleString()} accent="#00D4FF" />
        <Stat label="Hidden (dead pile)" value={data.counts.cameras.hidden.toLocaleString()} accent="#FF2D2D" />
        <Stat label="Active feeds" value={data.counts.feeds.active.toLocaleString()} accent="#22C55E" />
        <Stat label="Pending review" value={data.counts.discovery_pending.toLocaleString()} accent="#F59E0B" />
      </div>

      {/* AGENT HEALTH */}
      <Section title="Agent health" accent="#A855F7">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-[#0D2235] text-[10px] uppercase tracking-widest text-[#475569]">
              <th className="px-2 py-1 text-left">Agent</th>
              <th className="px-2 py-1 text-left">Status</th>
              <th className="px-2 py-1 text-left">Last run</th>
              <th className="px-2 py-1 text-left">Age</th>
            </tr>
          </thead>
          <tbody>
            {data.agents.map((a) => (
              <tr key={a.agent} className="border-b border-[#0D2235]/50">
                <td className="px-2 py-1 font-mono">{a.agent}</td>
                <td className="px-2 py-1">
                  <span className={a.last_status === 'success' ? 'text-[#22C55E]' : 'text-[#FF2D2D]'}>
                    {a.last_status}
                  </span>
                </td>
                <td className="px-2 py-1 font-mono text-[#94A3B8]">
                  {new Date(a.last_started).toLocaleString()}
                </td>
                <td className={`px-2 py-1 font-mono ${a.stale ? 'text-[#FF2D2D]' : 'text-[#94A3B8]'}`}>
                  {a.age_minutes}m {a.stale ? '· STALE' : ''}
                </td>
              </tr>
            ))}
            {data.agents.length === 0 && (
              <tr>
                <td colSpan={4} className="px-2 py-3 text-center text-[#475569]">
                  No agent runs yet — give the cron 30 minutes
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      {/* APPROVAL QUEUE */}
      <Section title={`Approval queue · ${queue.length} pending`} accent="#F59E0B">
        {queue.length === 0 ? (
          <div className="text-xs text-[#475569]">Queue empty — discovery hasn't surfaced anything that needs human review.</div>
        ) : (
          <ul className="space-y-2">
            {queue.map((c) => (
              <li key={c.id} className="rounded border border-[#0D2235] bg-black/30 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-white">
                      {c.candidate_name || c.candidate_url}
                    </div>
                    <div className="truncate font-mono text-[10px] text-[#64748B]">
                      {c.source} · {c.candidate_type || '?'} · {c.candidate_lat ? `${c.candidate_lat.toFixed(2)}, ${c.candidate_lng?.toFixed(2)}` : 'no coords'}
                    </div>
                    <a href={c.candidate_url} target="_blank" rel="noreferrer" className="truncate font-mono text-[10px] text-[#475569] hover:text-[#00D4FF]">
                      {c.candidate_url}
                    </a>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => approve(c.id)}
                      disabled={!!busy}
                      className="rounded border border-[#22C55E] bg-[#22C55E]/10 px-3 py-1 text-[10px] font-black tracking-widest text-[#22C55E] hover:bg-[#22C55E]/20 disabled:opacity-50"
                    >
                      APPROVE
                    </button>
                    <button
                      onClick={() => reject(c.id)}
                      disabled={!!busy}
                      className="rounded border border-[#FF2D2D] bg-[#FF2D2D]/10 px-3 py-1 text-[10px] font-black tracking-widest text-[#FF2D2D] hover:bg-[#FF2D2D]/20 disabled:opacity-50"
                    >
                      REJECT
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* RECENT ADDITIONS */}
      <Section title={`Recent additions · last 7 days`} accent="#22C55E">
        {data.recent_additions.length === 0 ? (
          <div className="text-xs text-[#475569]">No new cameras in the last 7 days.</div>
        ) : (
          <ul className="divide-y divide-[#0D2235]">
            {data.recent_additions.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-[11px]">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-white">{c.label}</div>
                  <div className="font-mono text-[10px] text-[#64748B]">
                    {c.source} · {c.feed_type} · {c.state || '?'} · conf {c.confidence?.toFixed(2)}
                  </div>
                </div>
                <div className="font-mono text-[10px] text-[#475569]">
                  {new Date(c.created_at).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* SOURCE BREAKDOWN */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Section title="Cameras by state · top 20" accent="#00D4FF">
          <div className="space-y-1">
            {data.by_state.slice(0, 20).map((s) => (
              <div key={s.state} className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-[#94A3B8]">{s.state || 'unknown'}</span>
                <span className="text-white">{s.n.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Cameras by feed type" accent="#A855F7">
          <div className="space-y-1">
            {data.by_type.map((t) => (
              <div key={t.type} className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-[#94A3B8]">{t.type}</span>
                <span className="text-white">{t.n.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* DEAD PILE */}
      <Section title={`Dead pile · ${data.counts.cameras.hidden} hidden, deleted after 14 days dead`} accent="#FF2D2D">
        {data.dead_pile.length === 0 ? (
          <div className="text-xs text-[#475569]">No dead cameras 🎉</div>
        ) : (
          <ul className="divide-y divide-[#0D2235]">
            {data.dead_pile.slice(0, 25).map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-[11px]">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[#94A3B8]">{c.label}</div>
                  <div className="font-mono text-[10px] text-[#475569]">
                    {c.source} · {c.dead_strikes} strikes · last alive {c.last_seen_alive ? new Date(c.last_seen_alive).toLocaleDateString() : 'never'}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded border border-[#0D2235] bg-black/30 p-4">
      <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: accent }}>
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl font-bold text-white">{value}</div>
    </div>
  )
}

function Section({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#0D2235] bg-black/30">
      <div className="border-b border-[#0D2235] px-4 py-2 font-mono text-[10px] uppercase tracking-widest" style={{ color: accent }}>
        {title}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}
