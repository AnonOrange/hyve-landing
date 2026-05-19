'use client'

import { useEffect, useRef, useState } from 'react'
import { attendBrowserClient } from '@/lib/attend/identity/supabase-browser'
import { energyLevel } from '@/lib/attend/live/energy'

interface ChatMsg {
  id: string
  name: string
  body: string
}

// UI reaction list — kept local (the server validates against its own set).
const REACTIONS = [
  { kind: 'CLAP', label: 'Clap' },
  { kind: 'FIRE', label: 'Fire' },
  { kind: 'HEART', label: 'Heart' },
  { kind: 'WOW', label: 'Wow' },
]

interface BacklogMessage {
  id: string
  body: string
  attend_profiles?: { display_name: string } | null
}

export default function LivePanel({ eventId }: { eventId: string }) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [draft, setDraft] = useState('')
  const [reactionCount, setReactionCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  // Load the chat backlog, then subscribe to the room's broadcast channel.
  useEffect(() => {
    let active = true
    fetch(`/api/attend/events/${eventId}/chat`)
      .then((res) => (res.ok ? res.json() : { messages: [] }))
      .then((data: { messages?: BacklogMessage[] }) => {
        if (!active) return
        setMessages(
          (data.messages ?? []).map((m) => ({
            id: m.id,
            name: m.attend_profiles?.display_name ?? 'Guest',
            body: m.body,
          })),
        )
      })
      .catch(() => {})

    const supabase = attendBrowserClient()
    const channel = supabase
      .channel(`attend-room-${eventId}`)
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        const p = payload as { id: string; displayName: string; body: string }
        setMessages((m) => [...m, { id: p.id, name: p.displayName, body: p.body }])
      })
      .on('broadcast', { event: 'reaction' }, () => {
        // Cap the counter so the meter falls responsively after a burst.
        setReactionCount((c) => Math.min(40, c + 1))
      })
      .subscribe()

    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [eventId])

  // Decay the reaction counter so the energy meter falls when reactions stop.
  useEffect(() => {
    const t = setInterval(() => setReactionCount((c) => Math.max(0, c - 2)), 2500)
    return () => clearInterval(t)
  }, [])

  // Keep the chat pinned to the newest message.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  async function send() {
    const body = draft.trim()
    if (!body || busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/attend/events/${eventId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (res.ok) setDraft('')
    } catch {
      /* a failed send leaves the draft for a retry */
    } finally {
      setBusy(false)
    }
  }

  async function react(kind: string) {
    await fetch(`/api/attend/events/${eventId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind }),
    }).catch(() => {})
  }

  const energy = energyLevel(reactionCount)

  return (
    <section className="flex flex-col rounded border border-[#2a2135] bg-[#111111]">
      <div className="border-b border-[#2a2135] px-3 py-2">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#9e8a55]">
          <span>Energy</span>
          <span>{energy}%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded bg-[#2a2135]">
          <div
            className="h-full rounded bg-[#E8C456] transition-all duration-500"
            style={{ width: `${energy}%` }}
          />
        </div>
      </div>

      <div
        ref={listRef}
        className="flex max-h-80 min-h-40 flex-col gap-2 overflow-y-auto px-3 py-3"
      >
        {messages.length === 0 ? (
          <p className="text-xs text-[#9e8a55]">No messages yet — say hello.</p>
        ) : (
          messages.map((m) => (
            <p key={m.id} className="text-sm">
              <span className="font-bold text-[#E8C456]">{m.name}</span>{' '}
              <span className="text-[#ede8d8]">{m.body}</span>
            </p>
          ))
        )}
      </div>

      <div className="flex flex-wrap gap-1 border-t border-[#2a2135] px-3 py-2">
        {REACTIONS.map((r) => (
          <button
            key={r.kind}
            onClick={() => react(r.kind)}
            className="rounded border border-[#2a2135] px-2 py-1 text-xs font-bold text-[#9e8a55] transition hover:text-[#E8C456]"
          >
            {r.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
        className="flex gap-2 border-t border-[#2a2135] px-3 py-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Say something…"
          maxLength={500}
          className="flex-1 rounded border border-[#2a2135] bg-[#08070a] px-3 py-1.5 text-sm text-[#ede8d8] outline-none focus:border-[#E8C456]"
        />
        <button
          type="submit"
          disabled={busy || draft.trim().length === 0}
          className="rounded bg-[#E8C456] px-3 py-1.5 text-xs font-bold text-black transition hover:brightness-110 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </section>
  )
}
