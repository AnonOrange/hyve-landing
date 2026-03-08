'use client'

import { useState } from 'react'
import { createIdentity, buildPublicBundle } from '@/lib/hyve/identity'
import { createVault } from '@/lib/hyve/storage/vault'
import { publishBundle, hyveIdExists } from '@/lib/hyve/network/hyve_id'
import { Identity } from '@/lib/hyve/identity'

interface Props {
  onComplete: (identity: Identity, pin: string) => void
}

type Step = 'id' | 'pin' | 'working'

export default function SetupView({ onComplete }: Props) {
  const [step, setStep] = useState<Step>('id')
  const [hyveId, setHyveId] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  function validateId(): boolean {
    const clean = hyveId.trim().replace(/^@/, '')
    if (!/^[a-z0-9_]{3,32}$/i.test(clean)) {
      setError('HYVE ID must be 3–32 characters (letters, numbers, underscores)')
      return false
    }
    setError('')
    return true
  }

  async function checkId() {
    if (!validateId()) return
    const clean = hyveId.trim().replace(/^@/, '')
    setStatus('Checking availability…')
    const taken = await hyveIdExists(clean)
    setStatus('')
    if (taken) {
      setError('That HYVE ID is already taken')
      return
    }
    setStep('pin')
  }

  async function finishSetup() {
    if (pin.length < 4) { setError('PIN must be at least 4 digits'); return }
    if (pin !== pinConfirm) { setError('PINs do not match'); return }
    setError('')
    setStep('working')

    setStatus('Generating identity keys…')
    const identity = createIdentity(hyveId)

    setStatus('Securing vault…')
    await createVault(identity, pin)

    setStatus('Publishing to HYVE network…')
    const bundle = buildPublicBundle(identity)
    await publishBundle(bundle)

    setStatus('')
    onComplete(identity, pin)
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <img src="/HYVEComIcon.png" alt="HYVE" className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-white">Create Your Identity</h1>
          <p className="text-white/40 text-sm mt-1">Your keys are generated on this device only</p>
        </div>

        {step === 'id' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-2 block">
                Choose a HYVE ID
              </label>
              <input
                type="text"
                value={hyveId}
                onChange={e => { setHyveId(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && checkId()}
                placeholder="@username"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-gold/50 transition-colors"
              />
              {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
              {status && <p className="text-xs text-white/40 mt-1">{status}</p>}
            </div>
            <button
              onClick={checkId}
              className="btn-primary w-full py-3 rounded-xl font-bold text-sm"
            >
              Continue →
            </button>
          </div>
        )}

        {step === 'pin' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-2 block">
                Set a PIN (locks your keys)
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={e => { setPin(e.target.value); setError('') }}
                placeholder="PIN"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-gold/50 transition-colors"
              />
            </div>
            <div>
              <input
                type="password"
                inputMode="numeric"
                value={pinConfirm}
                onChange={e => { setPinConfirm(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && finishSetup()}
                placeholder="Confirm PIN"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-gold/50 transition-colors"
              />
              {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
            </div>
            <button
              onClick={finishSetup}
              className="btn-primary w-full py-3 rounded-xl font-bold text-sm"
            >
              Create Identity
            </button>
            <button
              onClick={() => setStep('id')}
              className="w-full text-center text-xs text-white/30 hover:text-white/60 transition-colors mt-1"
            >
              ← Back
            </button>
          </div>
        )}

        {step === 'working' && (
          <div className="text-center space-y-4">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-white/60 text-sm">{status || 'Please wait…'}</p>
          </div>
        )}

        <p className="text-center text-xs text-white/20 mt-8">
          Your identity keys never leave this device
        </p>
      </div>
    </div>
  )
}
