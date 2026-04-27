'use client'

// Comp-access management — admin UI for granting/revoking free lifetime
// Pro access. Posts to /api/admin/comp-access. Renders below the admin
// management table on /admin/users.
//
// Layout matches the rest of the admin panel: dark bg, gold accents,
// monospace labels, rectangular boxes.

import { useEffect, useState } from 'react'

interface CompRow {
  email: string
  granted_by: string
  granted_at: string
  notes: string | null
  active: boolean
  hardcoded?: boolean
}

function fmtTime(iso: string) {
  if (iso === '0001-01-01T00:00:00Z') return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

const INPUT: React.CSSProperties = {
  width: '100%', background: '#0a0a0a', border: '1px solid #2a2a2a', color: '#e0e0e0',
  padding: '7px 10px', fontFamily: 'monospace', fontSize: 11, borderRadius: 2,
}

const BTN = (primary = false, danger = false): React.CSSProperties => ({
  background: danger ? '#3a0a0a' : primary ? '#FFB800' : 'transparent',
  border: `1px solid ${danger ? '#ff5555' : primary ? '#FFB800' : '#2a2a2a'}`,
  color: danger ? '#ff5555' : primary ? '#000' : '#e0e0e0',
  padding: '6px 14px', fontFamily: 'monospace', fontSize: 10,
  letterSpacing: '0.2em', cursor: 'pointer', borderRadius: 2,
})

export default function CompAccessClient() {
  const [rows, setRows] = useState<CompRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showGrant, setShowGrant] = useState(false)
  const [grantEmail, setGrantEmail] = useState('')
  const [grantNotes, setGrantNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null)

  async function fetchList() {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/comp-access', { cache: 'no-store' })
      const d = await r.json()
      setRows(d.comp_emails || [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { fetchList() }, [])

  async function doGrant() {
    setSubmitting(true)
    setError(null)
    try {
      const r = await fetch('/api/admin/comp-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: grantEmail, notes: grantNotes }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'grant_failed')
      setShowGrant(false)
      setGrantEmail('')
      setGrantNotes('')
      await fetchList()
    } catch (e: any) {
      setError(e?.message || 'grant_failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function doRevoke(email: string) {
    setSubmitting(true)
    try {
      const r = await fetch(`/api/admin/comp-access?email=${encodeURIComponent(email)}`, {
        method: 'DELETE',
      })
      if (!r.ok) {
        const d = await r.json()
        setError(d.detail || d.error || 'revoke_failed')
        return
      }
      setConfirmRevoke(null)
      await fetchList()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ marginTop: 40, borderTop: '1px solid #1a1a1a', paddingTop: 30 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#888' }}>
            COMP ACCESS · LIFETIME PRO
          </div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
            Emails granted free Pro access — bypasses Stripe entirely.
          </div>
        </div>
        <button onClick={() => setShowGrant(true)} style={BTN(true)}>+ GRANT</button>
      </div>

      <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 2 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#0e0e0e' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#666', fontWeight: 'normal', fontSize: 9, letterSpacing: '0.2em' }}>EMAIL</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#666', fontWeight: 'normal', fontSize: 9, letterSpacing: '0.2em' }}>GRANTED BY</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#666', fontWeight: 'normal', fontSize: 9, letterSpacing: '0.2em' }}>GRANTED AT</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#666', fontWeight: 'normal', fontSize: 9, letterSpacing: '0.2em' }}>NOTES</th>
              <th style={{ padding: '8px 12px', textAlign: 'right', color: '#666', fontWeight: 'normal', fontSize: 9, letterSpacing: '0.2em' }}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#555' }}>loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#555' }}>No comp emails yet — click GRANT to add one.</td></tr>
            ) : rows.map(r => (
              <tr key={r.email} style={{ borderTop: '1px solid #1a1a1a', opacity: r.active ? 1 : 0.4 }}>
                <td style={{ padding: '10px 12px', color: '#e0e0e0', fontFamily: 'monospace' }}>
                  {r.email}
                  {r.hardcoded && (
                    <span style={{ marginLeft: 8, fontSize: 8, padding: '1px 6px', background: '#3a2a0a', color: '#FFB800', borderRadius: 2, letterSpacing: '0.15em' }}>OWNER</span>
                  )}
                </td>
                <td style={{ padding: '10px 12px', color: '#888', fontFamily: 'monospace' }}>{r.granted_by}</td>
                <td style={{ padding: '10px 12px', color: '#888', fontFamily: 'monospace' }}>{fmtTime(r.granted_at)}</td>
                <td style={{ padding: '10px 12px', color: '#666', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.notes || ''}>
                  {r.notes || '—'}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  {!r.active ? (
                    <span style={{ fontSize: 9, color: '#666', letterSpacing: '0.2em' }}>REVOKED</span>
                  ) : r.hardcoded ? (
                    <span style={{ fontSize: 9, color: '#FFB800', letterSpacing: '0.2em' }}>PERMANENT</span>
                  ) : (
                    <button
                      onClick={() => setConfirmRevoke(r.email)}
                      style={{ ...BTN(false, true), padding: '4px 10px', fontSize: 9 }}
                    >
                      REVOKE
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Grant modal */}
      {showGrant && (
        <div style={MODAL_BG} onClick={e => { if (e.target === e.currentTarget) setShowGrant(false) }}>
          <div style={MODAL}>
            <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#FFB800', marginBottom: 20 }}>
              GRANT COMP ACCESS · LIFETIME PRO
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 9, letterSpacing: '0.2em', color: '#555', marginBottom: 5 }}>EMAIL</label>
              <input
                type="email"
                value={grantEmail}
                onChange={e => setGrantEmail(e.target.value)}
                autoFocus
                placeholder="user@example.com"
                style={INPUT}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 9, letterSpacing: '0.2em', color: '#555', marginBottom: 5 }}>
                NOTES <span style={{ color: '#333' }}>(optional)</span>
              </label>
              <input
                type="text"
                value={grantNotes}
                onChange={e => setGrantNotes(e.target.value)}
                placeholder='e.g. "podcast guest", "early beta tester"'
                style={INPUT}
              />
            </div>
            {error && <div style={{ color: '#ff5555', fontSize: 10, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowGrant(false)} style={BTN()}>CANCEL</button>
              <button
                onClick={doGrant}
                disabled={submitting || !grantEmail}
                style={BTN(true)}
              >
                {submitting ? 'GRANTING…' : 'GRANT LIFETIME PRO'}
              </button>
            </div>
            <div style={{ marginTop: 16, fontSize: 10, color: '#444', lineHeight: 1.6 }}>
              Once granted, this email gets free Pro access for life on every device they sign in
              with. They bypass Stripe entirely. Revocable any time from this page.
            </div>
          </div>
        </div>
      )}

      {/* Revoke confirm */}
      {confirmRevoke && (
        <div style={MODAL_BG} onClick={e => { if (e.target === e.currentTarget) setConfirmRevoke(null) }}>
          <div style={MODAL}>
            <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#ff5555', marginBottom: 16 }}>CONFIRM REVOKE</div>
            <div style={{ color: '#888', fontSize: 11, lineHeight: 1.6, marginBottom: 20 }}>
              Revoke comp access for <span style={{ color: '#e0e0e0' }}>{confirmRevoke}</span>?
              They will lose Pro features on next sign-in (existing sessions stay until they re-auth).
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmRevoke(null)} style={BTN()}>CANCEL</button>
              <button onClick={() => doRevoke(confirmRevoke!)} disabled={submitting} style={BTN(false, true)}>
                {submitting ? 'REVOKING…' : 'REVOKE ACCESS'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const MODAL_BG: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
}
const MODAL: React.CSSProperties = {
  background: '#0a0a0a', border: '1px solid #1a1a1a',
  padding: 30, minWidth: 420, maxWidth: 520, borderRadius: 2,
}
