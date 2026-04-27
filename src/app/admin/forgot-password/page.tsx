'use client'

import { useState } from 'react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/admin/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
      <div style={{ color: '#FFB800', fontSize: 11, letterSpacing: '0.4em', fontWeight: 900, marginBottom: 32 }}>
        HYVE · ADMIN
      </div>
      <div style={{ background: '#131313', border: '1px solid #2a2a2a', borderRadius: 4, padding: '32px 28px', width: 380 }}>
        {sent ? (
          <>
            <div style={{ color: '#39FF14', fontSize: 12, letterSpacing: '0.1em', marginBottom: 12 }}>✓ CHECK YOUR INBOX</div>
            <div style={{ color: '#888', fontSize: 11, lineHeight: 1.6, marginBottom: 20 }}>
              If that email is on the admin list, a reset link is on its way. Check spam too.
            </div>
            <a href="/admin/login" style={{ fontSize: 10, color: '#444', textDecoration: 'none' }}>← back to sign in</a>
          </>
        ) : (
          <form onSubmit={submit}>
            <div style={{ color: '#888', fontSize: 11, lineHeight: 1.5, marginBottom: 20 }}>
              Enter your admin email and we'll send a reset link if it's on file.
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.2em', color: '#666', marginBottom: 6 }}>EMAIL</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                style={{ width: '100%', background: '#0d0d0d', border: '1px solid #2a2a2a', color: '#e0e0e0', padding: '9px 12px', fontFamily: 'monospace', fontSize: 13, boxSizing: 'border-box', outline: 'none', borderRadius: 2 }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', background: '#FFB800', color: '#000', border: 'none', padding: '10px 0', fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', fontWeight: 900, cursor: 'pointer', borderRadius: 2 }}
            >
              {loading ? 'SENDING…' : 'SEND RESET LINK'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <a href="/admin/login" style={{ fontSize: 10, color: '#444', textDecoration: 'none' }}>← back to sign in</a>
            </div>
          </form>
        )}
      </div>
    </main>
  )
}
