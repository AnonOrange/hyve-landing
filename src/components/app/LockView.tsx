'use client'

import { useState } from 'react'
import { unlockVault } from '@/lib/hyve/storage/vault'
import { Identity } from '@/lib/hyve/identity'

interface Props {
  onUnlock: (identity: Identity, pin: string) => void
}

export default function LockView({ onUnlock }: Props) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function tryUnlock() {
    if (!pin) return
    setLoading(true)
    setError('')
    const identity = await unlockVault(pin)
    setLoading(false)
    if (!identity) {
      setError('Incorrect PIN')
      setPin('')
      return
    }
    onUnlock(identity as Identity, pin)
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <img src="/HYVEComIcon.png" alt="HYVE" className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-white">Welcome Back</h1>
          <p className="text-white/40 text-sm mt-1">Enter your PIN to unlock HYVE</p>
        </div>

        <div className="space-y-4">
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={e => { setPin(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && tryUnlock()}
            placeholder="PIN"
            autoFocus
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-gold/50 transition-colors text-center text-xl tracking-widest"
          />
          {error && <p className="text-xs text-red-400 text-center">{error}</p>}
          <button
            onClick={tryUnlock}
            disabled={loading || !pin}
            className="btn-primary w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50"
          >
            {loading ? 'Unlocking…' : 'Unlock'}
          </button>
        </div>
      </div>
    </div>
  )
}
