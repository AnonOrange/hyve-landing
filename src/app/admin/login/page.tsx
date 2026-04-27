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

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, pin }),
      })
      if (res.ok) {
        window.location.href = '/admin'
        return
      }
      const d = await res.json().catch(() => ({}))
      setError(res.status === 429 ? 'Too many attempts — wait 15 minutes.' : (d.error ?? 'Invalid credentials'))
    } catch {
      setError('Network error, please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
      <div style={{ color: '#FFB800', fontSize: 11, letterSpacing: '0.4em', fontWeight: 900, marginBottom: 32 }}>
        HYVE · ADMIN
      </div>
      <form
        onSubmit={submit}
        style={{ background: '#131313', border: '1px solid #2a2a2a', borderRadius: 4, padding: '32px 28px', width: 380 }}
      >
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.2em', color: '#666', marginBottom: 6 }}>EMAIL</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus autoComplete="email" style={INPUT} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.2em', color: '#666', marginBottom: 6 }}>PASSWORD</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" style={INPUT} />
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
            autoComplete="one-time-code"
            style={{ ...INPUT, letterSpacing: '0.3em' }}
          />
        </div>
        {error && <div style={{ color: '#ff5555', fontSize: 11, marginBottom: 16, lineHeight: 1.4 }}>{error}</div>}
        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', background: loading ? '#2a2a0a' : '#FFB800', color: '#000', border: 'none', padding: '10px 0', fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', fontWeight: 900, cursor: loading ? 'not-allowed' : 'pointer', borderRadius: 2 }}
        >
          {loading ? 'SIGNING IN…' : 'SIGN IN'}
        </button>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <a href="/admin/forgot-password" style={{ fontSize: 10, color: '#444', textDecoration: 'none' }}>forgot password</a>
        </div>
      </form>
    </main>
  )
}
