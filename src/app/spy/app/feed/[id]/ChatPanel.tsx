'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Msg = {
  id: number
  user_id: string
  email: string
  display: string | null
  body: string
  created_at: string
}

const POLL_OPEN_MS = 4000
const POLL_CLOSED_MS = 15000

function shortName(m: Msg) {
  if (m.display) return m.display
  return (m.email || '?').split('@')[0]
}

function relTime(iso: string) {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`
  return `${Math.floor(sec / 86400)}d`
}

export default function ChatPanel({ feedId, feedName }: { feedId: string; feedName?: string }) {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [unread, setUnread] = useState(0)
  const lastIdRef = useRef<number>(0)
  const seenIdRef = useRef<number>(0)
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  // Detect sign-in by probing the accounts /api/me endpoint (cookie shared on .hyveapp.co)
  useEffect(() => {
    fetch('https://hyve-spy-accounts.vercel.app/api/me', { credentials: 'include', cache: 'no-store' })
      .then((r) => setSignedIn(r.ok))
      .catch(() => setSignedIn(false))
  }, [])

  const fetchMessages = useCallback(async () => {
    try {
      const url = lastIdRef.current
        ? `/api/spy/feeds/${encodeURIComponent(feedId)}/messages?since=${lastIdRef.current}`
        : `/api/spy/feeds/${encodeURIComponent(feedId)}/messages`
      const r = await fetch(url, { credentials: 'include', cache: 'no-store' })
      if (!r.ok) return
      const j = await r.json()
      const incoming: Msg[] = j.messages || []
      if (incoming.length === 0) return
      setMsgs((prev) => {
        // Merge by id (incoming may overlap on initial load)
        const seen = new Set(prev.map((m) => m.id))
        const merged = [...prev, ...incoming.filter((m) => !seen.has(m.id))]
        return merged.slice(-200) // cap memory
      })
      const newest = incoming[incoming.length - 1]
      if (newest && newest.id > lastIdRef.current) lastIdRef.current = newest.id
    } catch {}
  }, [feedId])

  // Poll
  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, open ? POLL_OPEN_MS : POLL_CLOSED_MS)
    return () => clearInterval(interval)
  }, [fetchMessages, open])

  // Unread tracking + autoscroll
  useEffect(() => {
    if (open) {
      seenIdRef.current = lastIdRef.current
      setUnread(0)
      // scroll to bottom on next paint
      requestAnimationFrame(() => {
        const el = scrollerRef.current
        if (el) el.scrollTop = el.scrollHeight
      })
    } else {
      const newer = msgs.filter((m) => m.id > seenIdRef.current).length
      setUnread(newer)
    }
  }, [msgs, open])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = body.trim()
    if (!text) return
    setPosting(true)
    setErr(null)
    try {
      const r = await fetch(`/api/spy/feeds/${encodeURIComponent(feedId)}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        if (r.status === 401) setErr('Sign in to chat')
        else if (r.status === 429) setErr('Slow down — wait a sec')
        else setErr(j.error || 'Failed to send')
        return
      }
      setBody('')
      // Optimistic append; the next poll will reconcile
      if (j.message) {
        setMsgs((prev) => [...prev, j.message].slice(-200))
        if (j.message.id > lastIdRef.current) lastIdRef.current = j.message.id
      }
    } finally {
      setPosting(false)
    }
  }

  return (
    <>
      {/* Toggle button — fixed bottom-right, above the bottom nav */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close chat' : 'Open chat'}
        className="fixed bottom-20 right-4 z-[1500] flex h-12 w-12 items-center justify-center rounded-full border border-[#00D4FF] bg-[#020D14] text-[#00D4FF] shadow-lg transition hover:bg-[#0D2235]"
        style={{ boxShadow: '0 0 30px -10px rgba(0,212,255,0.6)' }}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF2D2D] px-1 font-mono text-[10px] font-bold text-white">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </>
        )}
      </button>

      {/* Slide-up panel */}
      <div
        className={`fixed inset-x-0 bottom-0 z-[1400] transition-transform duration-200 ${
          open ? 'translate-y-0' : 'translate-y-full pointer-events-none'
        }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex h-[60vh] max-w-3xl flex-col rounded-t-xl border-x border-t border-[#0D2235] bg-[#020D14] sm:h-[55vh]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#0D2235] px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#00D4FF]">CHANNEL CHAT</div>
              <div className="truncate text-xs font-bold text-white">{feedName || feedId}</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded border border-[#0D2235] px-2 py-0.5 text-[10px] font-bold text-[#64748B] hover:text-[#E2E8F0]"
            >
              ▼ COLLAPSE
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-3">
            {msgs.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-xs text-[#475569]">
                No messages yet. Be the first to chat with other listeners on this feed.
              </div>
            ) : (
              <ul className="space-y-2">
                {msgs.map((m) => (
                  <li key={m.id} className="rounded border border-[#0D2235]/50 bg-black/40 px-3 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold text-[#00D4FF]">
                        {shortName(m)}
                      </span>
                      <span className="font-mono text-[10px] text-[#475569]">{relTime(m.created_at)}</span>
                    </div>
                    <div className="mt-0.5 break-words text-sm text-[#E2E8F0]">{m.body}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Composer */}
          <form onSubmit={submit} className="border-t border-[#0D2235] p-3">
            {signedIn === false ? (
              <div className="rounded border border-[#FF2D2D]/40 bg-[#FF2D2D]/10 px-3 py-2 text-center text-xs text-[#FF2D2D]">
                <a href="/spy/login" className="font-bold hover:underline">
                  Sign in
                </a>{' '}
                to chat with other listeners
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Send a message…"
                    maxLength={500}
                    disabled={posting || signedIn === null}
                    className="flex-1 rounded border border-[#0D2235] bg-black/60 px-3 py-2 text-sm text-white placeholder-[#334155] outline-none focus:border-[#00D4FF] disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!body.trim() || posting}
                    className="rounded bg-[#00D4FF] px-4 py-2 text-xs font-black tracking-widest text-[#020D14] transition hover:bg-white disabled:opacity-50"
                  >
                    {posting ? '…' : 'SEND'}
                  </button>
                </div>
                {err && <div className="mt-1 font-mono text-[10px] text-[#FF2D2D]">{err}</div>}
                <div className="mt-1 font-mono text-[10px] text-[#475569]">
                  {body.length}/500 · be civil — admins can revoke access
                </div>
              </>
            )}
          </form>
        </div>
      </div>
    </>
  )
}
