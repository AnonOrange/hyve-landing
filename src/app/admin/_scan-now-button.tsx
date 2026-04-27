'use client'

import { useState } from 'react'

export default function ScanNowButton() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle')

  async function scan() {
    if (status !== 'idle') return
    setStatus('running')
    try {
      await fetch('/api/admin/scan', { method: 'POST' })
      setStatus('done')
      setTimeout(() => { setStatus('idle'); window.location.reload() }, 1200)
    } catch {
      setStatus('idle')
    }
  }

  return (
    <button
      onClick={scan}
      disabled={status !== 'idle'}
      style={{
        background: status === 'running' ? '#131313' : '#1a1a08',
        border: `1px solid ${status === 'running' ? '#333' : '#FFB800'}`,
        color: status === 'running' ? '#555' : '#FFB800',
        padding: '4px 14px',
        fontFamily: 'monospace',
        fontSize: 10,
        letterSpacing: '0.15em',
        cursor: status !== 'idle' ? 'default' : 'pointer',
      }}
    >
      {status === 'running' ? '● SCANNING…' : status === 'done' ? '✓ DONE' : '▶ SCAN NOW'}
    </button>
  )
}
