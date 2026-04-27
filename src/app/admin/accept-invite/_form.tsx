'use client'

import { useState } from 'react'

const INPUT: React.CSSProperties = {
  width: '100%',
  background: '#0d0d0d',
  border: '1px solid #2a2a2a',
  color: '#e0e0e0',
  padding: '9px 12px',
  fontFamily: 'monospace',
  fontSize: 13,
  boxSizing: 'border-box',
  outline: 'none',
  borderRadius: 2,
}

export default function AcceptInviteForm({ token, email, role }: { token: string; email: string; role: string }) {
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 12) { setError('Password must be at least 12 characters.'); return }
    if (!/^\d{6}$/.test(pin)) { setError('PIN must be exactly 6 digits.'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, pin }),
      })
      if (res.ok) {
        setDone(true)
        setTimeout(() => { window.location.href = '/admin/login' }, 2000)
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'Failed — the invite link may have expired.')
      }
    } catch {
      setError('Network error, please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
      <div style={{ color: '#FFB800', fontSize: 11, letterSpacing: '0.4em', fontWeight: 900, marginBottom: 32 }}>HYVE · ADMIN</div>
      <div style={{ background: '#131313', border: '1px solid #2a2a2a', borderRadius: 4, padding: '32px 28px', width: 380 }}>
        {done ? (
          <>
            <div style={{ color: '#39FF14', fontSize: 12, letterSpacing: '0.1em', marginBottom: 12 }}>✓ ACCOUNT ACTIVATED</div>
            <div style={{ color: '#888', fontSize: 11 }}>Redirecting to sign in…</div>
          </>
        ) : (
          <form onSubmit={submit}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#666', marginBottom: 4 }}>INVITED AS</div>
              <div style={{ color: '#e0e0e0', fontSize: 12 }}>{email}</div>
              <div style={{ color: '#FFB800', fontSize: 10, letterSpacing: '0.2em', marginTop: 4 }}>{role.toUpperCase()}</div>
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.2em', color: '#666', marginBottom: 6 }}>
                PASSWORD <span style={{ color: '#444' }}>(≥12 chars)</span>
              </label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoFocus autoComplete="new-password" style={INPUT} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.2em', color: '#666', marginBottom: 6 }}>
                PIN <span style={{ color: '#444' }}>(6 digits)</span>
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                autoComplete="new-password"
                style={{ ...INPUT, letterSpacing: '0.3em' }}
              />
            </div>
            {error && <div style={{ color: '#ff5555', fontSize: 11, marginBottom: 16, lineHeight: 1.4 }}>{error}</div>}
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', background: '#FFB800', color: '#000', border: 'none', padding: '10px 0', fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', fontWeight: 900, cursor: loading ? 'not-allowed' : 'pointer', borderRadius: 2 }}
            >
              {loading ? 'ACTIVATING…' : 'ACTIVATE ACCOUNT'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
