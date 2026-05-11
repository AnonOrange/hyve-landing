// CaseLine comp-key admin panel.
//
// One-screen workflow: pick tier (STARTER 5 / FIRM 10 / CUSTOM N) + an
// optional label, click GENERATE, key shows at the top with a one-tap
// COPY button. The table below lists every key ever issued — active +
// revoked — with REVOKE buttons that prompt for an optional reason.
//
// The freshly-minted key is shown ONCE at issuance (highlighted) and
// also appears in the table; admins should copy + send before navigating
// away. (The key is also stored in the table forever, so navigating
// away isn't catastrophic — but UX-wise it's nice to highlight the
// just-created key.)

'use client'

import { useCallback, useEffect, useState } from 'react'

interface CompKeyRow {
  key: string
  tier: '5' | '10' | 'custom'
  max_seats: number
  label: string | null
  issued_by: string
  issued_at: string
  revoked_at: string | null
  revoked_by: string | null
  revoked_reason: string | null
  last_validated_at: string | null
}

const FRAME = { background: '#0d0d0d', border: '1px solid #1e1e1e', padding: 20, marginBottom: 20 }
const LABEL = { color: '#888', fontSize: 10, letterSpacing: '0.25em', fontWeight: 900 }
const INPUT: React.CSSProperties = {
  background: '#000', color: '#d0d0d0', border: '1px solid #2a2a2a',
  padding: '8px 10px', fontFamily: 'monospace', fontSize: 13, outline: 'none',
}
const BTN: React.CSSProperties = {
  background: '#FFB800', color: '#000', border: 'none', padding: '9px 16px',
  fontFamily: 'monospace', fontWeight: 900, fontSize: 11, letterSpacing: '0.2em', cursor: 'pointer',
}
const BTN_GHOST: React.CSSProperties = {
  background: 'transparent', color: '#888', border: '1px solid #2a2a2a',
  padding: '6px 10px', fontFamily: 'monospace', fontWeight: 900, fontSize: 10,
  letterSpacing: '0.2em', cursor: 'pointer',
}
const BTN_DANGER: React.CSSProperties = {
  ...BTN_GHOST, color: '#ff5555', borderColor: '#3a1a1a',
}

export default function CompKeysClient() {
  const [keys, setKeys] = useState<CompKeyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  // Issuance form
  const [tier, setTier] = useState<'5' | '10' | 'custom'>('5')
  const [customSeats, setCustomSeats] = useState<string>('25')
  const [label, setLabel] = useState('')
  const [issuing, setIssuing] = useState(false)
  const [justIssued, setJustIssued] = useState<CompKeyRow | null>(null)
  const [copyState, setCopyState] = useState<string | null>(null)

  const reload = useCallback(() => setRefreshTick((t) => t + 1), [])

  useEffect(() => {
    let aborted = false
    setLoading(true)
    fetch('/api/admin/caseline/comp-keys', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (aborted) return
        if (data.error) { setError(data.error); setKeys([]); }
        else { setKeys(data.keys || []); setError(null); }
      })
      .catch((e) => !aborted && setError(String(e)))
      .finally(() => !aborted && setLoading(false))
    return () => { aborted = true }
  }, [refreshTick])

  async function issue() {
    setIssuing(true)
    setError(null)
    try {
      const body: { tier: string; label?: string; max_seats?: number } = { tier }
      if (label.trim()) body.label = label.trim()
      if (tier === 'custom') {
        const n = parseInt(customSeats, 10)
        if (!Number.isFinite(n) || n < 1 || n > 9999) {
          setError('Custom seats must be between 1 and 9999')
          return
        }
        body.max_seats = n
      }
      const res = await fetch('/api/admin/caseline/comp-keys', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error || `Issuance failed (${res.status})`)
        return
      }
      setJustIssued(data.row)
      setLabel('')
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setIssuing(false)
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopyState(text)
      setTimeout(() => setCopyState(null), 1600)
    } catch { /* ignored */ }
  }

  async function revoke(key: string) {
    const reason = window.prompt(
      `Revoke ${key}?\n\nOptional reason (free-form, stored in audit log):`,
      '',
    )
    // Null means user clicked Cancel. Empty string is "yes but no reason".
    if (reason === null) return
    try {
      const params = new URLSearchParams({ key })
      if (reason.trim()) params.set('reason', reason.trim())
      const res = await fetch(`/api/admin/caseline/comp-keys?${params}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        alert(data.error || `Revoke failed (${res.status})`)
        return
      }
      reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    }
  }

  const activeCount  = keys.filter((k) => !k.revoked_at).length
  const revokedCount = keys.filter((k) => k.revoked_at).length

  return (
    <div style={{ maxWidth: 1100, padding: '24px 28px', color: '#d0d0d0', fontFamily: 'monospace' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ color: '#FFB800', fontSize: 18, letterSpacing: '0.3em', fontWeight: 900, margin: 0 }}>
          CASELINE · COMP KEYS
        </h1>
        <div style={{ color: '#555', fontSize: 11, letterSpacing: '0.15em' }}>
          {activeCount} ACTIVE · {revokedCount} REVOKED · {keys.length} TOTAL
        </div>
      </div>

      {/* ── Issuance ──────────────────────── */}
      <section style={FRAME}>
        <div style={{ ...LABEL, marginBottom: 12 }}>// ISSUE NEW COMP KEY</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center' }}>
          <select value={tier} onChange={(e) => setTier(e.currentTarget.value as '5' | '10' | 'custom')} style={INPUT}>
            <option value="5">STARTER · 5 seats</option>
            <option value="10">FIRM · 10 seats</option>
            <option value="custom">CUSTOM · pick seats</option>
          </select>
          {tier === 'custom' ? (
            <input
              type="number"
              value={customSeats}
              onChange={(e) => setCustomSeats(e.currentTarget.value)}
              min={1}
              max={9999}
              placeholder="seats"
              style={INPUT}
            />
          ) : (
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.currentTarget.value)}
              placeholder='Optional label (e.g. "Bar Association beta", "Internal QA")'
              maxLength={255}
              style={INPUT}
            />
          )}
          <button onClick={issue} disabled={issuing} style={{ ...BTN, opacity: issuing ? 0.5 : 1 }}>
            {issuing ? 'GENERATING…' : 'GENERATE'}
          </button>
        </div>
        {tier === 'custom' && (
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.currentTarget.value)}
            placeholder='Optional label (e.g. "Bar Association beta")'
            maxLength={255}
            style={{ ...INPUT, marginTop: 10, width: '100%', boxSizing: 'border-box' }}
          />
        )}

        {error && (
          <div style={{ marginTop: 12, color: '#ff5555', fontSize: 12 }}>
            ⚠ {error}
          </div>
        )}

        {justIssued && (
          <div style={{ marginTop: 16, padding: 14, background: '#1a1a0a', border: '1px solid #FFB800' }}>
            <div style={{ ...LABEL, color: '#FFB800', marginBottom: 6 }}>// NEW KEY MINTED — COPY IT NOW</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <code style={{ fontSize: 18, color: '#FFB800', letterSpacing: 2, fontWeight: 900 }}>{justIssued.key}</code>
              <button onClick={() => copy(justIssued.key)} style={BTN_GHOST}>
                {copyState === justIssued.key ? 'COPIED ✓' : 'COPY'}
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: '#888' }}>
              {justIssued.tier === 'custom' ? `Custom · ${justIssued.max_seats} seats` :
               justIssued.tier === '10' ? 'FIRM · 10 seats' : 'STARTER · 5 seats'}
              {justIssued.label ? ` · ${justIssued.label}` : ''}
            </div>
          </div>
        )}

        <div style={{ marginTop: 14, fontSize: 11, color: '#555', lineHeight: 1.6 }}>
          Comp keys never expire on their own — they stay valid until you revoke them here.
          When you revoke, any running desktop app shows a "your trial has been revoked" banner but the
          current session continues until the user closes the app (soft-revoke). New launches are
          blocked at the license-validate poll.
        </div>
      </section>

      {/* ── Key list ──────────────────────── */}
      <section style={FRAME}>
        <div style={{ ...LABEL, marginBottom: 14 }}>// ALL COMP KEYS</div>
        {loading ? (
          <div style={{ color: '#555', fontSize: 12 }}>Loading…</div>
        ) : keys.length === 0 ? (
          <div style={{ color: '#555', fontSize: 12 }}>
            No comp keys yet. Generate your first above.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ color: '#666', borderBottom: '1px solid #1e1e1e' }}>
                <th style={{ textAlign: 'left', padding: '8px 6px', fontSize: 10, letterSpacing: '0.2em' }}>STATUS</th>
                <th style={{ textAlign: 'left', padding: '8px 6px', fontSize: 10, letterSpacing: '0.2em' }}>KEY</th>
                <th style={{ textAlign: 'left', padding: '8px 6px', fontSize: 10, letterSpacing: '0.2em' }}>TIER</th>
                <th style={{ textAlign: 'left', padding: '8px 6px', fontSize: 10, letterSpacing: '0.2em' }}>LABEL</th>
                <th style={{ textAlign: 'left', padding: '8px 6px', fontSize: 10, letterSpacing: '0.2em' }}>ISSUED</th>
                <th style={{ textAlign: 'left', padding: '8px 6px', fontSize: 10, letterSpacing: '0.2em' }}>LAST USED</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 10, letterSpacing: '0.2em' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const revoked = !!k.revoked_at
                return (
                  <tr key={k.key} style={{ borderBottom: '1px solid #1a1a1a', opacity: revoked ? 0.55 : 1 }}>
                    <td style={{ padding: '8px 6px' }}>
                      {revoked
                        ? <span style={{ color: '#ff5555' }}>REVOKED</span>
                        : <span style={{ color: '#39FF14' }}>ACTIVE</span>}
                    </td>
                    <td style={{ padding: '8px 6px' }}>
                      <code style={{ color: revoked ? '#666' : '#FFB800', fontWeight: 700 }}>{k.key}</code>
                      <button onClick={() => copy(k.key)} style={{ ...BTN_GHOST, marginLeft: 8, padding: '3px 8px' }}>
                        {copyState === k.key ? '✓' : 'COPY'}
                      </button>
                    </td>
                    <td style={{ padding: '8px 6px' }}>
                      {k.tier === 'custom' ? `${k.max_seats} seats` :
                       k.tier === '10' ? 'FIRM · 10' : 'STARTER · 5'}
                    </td>
                    <td style={{ padding: '8px 6px', color: '#aaa', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {k.label || <span style={{ color: '#444' }}>—</span>}
                    </td>
                    <td style={{ padding: '8px 6px', color: '#888', whiteSpace: 'nowrap' }}>
                      {timeAgo(k.issued_at)}
                      <div style={{ fontSize: 10, color: '#555' }}>{k.issued_by}</div>
                    </td>
                    <td style={{ padding: '8px 6px', color: '#888', whiteSpace: 'nowrap' }}>
                      {k.last_validated_at ? timeAgo(k.last_validated_at) : <span style={{ color: '#444' }}>never</span>}
                    </td>
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                      {revoked ? (
                        <span style={{ color: '#555', fontSize: 10 }} title={k.revoked_reason || ''}>
                          {timeAgo(k.revoked_at!)} by {k.revoked_by}
                        </span>
                      ) : (
                        <button onClick={() => revoke(k.key)} style={BTN_DANGER}>REVOKE</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}
