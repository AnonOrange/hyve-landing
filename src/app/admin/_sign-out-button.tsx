'use client'

import { useState } from 'react'

export default function SignOutButton() {
  const [loading, setLoading] = useState(false)

  async function signOut() {
    setLoading(true)
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => undefined)
    window.location.href = '/admin/login'
  }

  return (
    <button
      onClick={signOut}
      disabled={loading}
      style={{ background: 'none', border: '1px solid #2a2a2a', color: '#555', padding: '3px 10px', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', cursor: 'pointer' }}
    >
      {loading ? '…' : 'SIGN OUT'}
    </button>
  )
}
