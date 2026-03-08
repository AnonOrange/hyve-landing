'use client'

import { useState } from 'react'
import { createIdentity, buildPublicBundle, identityFromExport } from '@/lib/hyve/identity'
import { createVault, importIdentityBundle } from '@/lib/hyve/storage/vault'
import { publishBundle, hyveIdExists } from '@/lib/hyve/network/hyve_id'
import { Identity } from '@/lib/hyve/identity'

interface Props {
  onComplete: (identity: Identity, pin: string) => void
}

type Mode = 'new' | 'link'
type Step = 'id' | 'pin' | 'link-code' | 'link-pin' | 'working'

export default function SetupView({ onComplete }: Props) {
  const [mode, setMode] = useState<Mode>('new')
  const [step, setStep] = useState<Step>('id')
  const [hyveId, setHyveId] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [linkCode, setLinkCode] = useState('')
  const [linkPin, setLinkPin] = useState('')
  const [linkPinConfirm, setLinkPinConfirm] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  // ── New identity flow ──────────────────────────────────────────────────────

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

  // ── Link from phone flow ───────────────────────────────────────────────────

  async function finishLink() {
    const code = linkCode.trim()
    if (!code) { setError('Paste your link code from the HYVE app'); return }
    if (linkPin.length < 4) { setError('PIN must be at least 4 digits'); return }
    if (linkPin !== linkPinConfirm) { setError('PINs do not match'); return }
    setError('')
    setStep('working')

    try {
      setStatus('Importing identity…')
      await importIdentityBundle(code, linkPin)

      setStatus('Reconstructing keys…')
      const identity = identityFromExport(code)

      setStatus('')
      onComplete(identity, linkPin)
    } catch {
      setError('Invalid link code — copy it again from the HYVE app')
      setStep('link-pin')
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/HYVEComIcon.png" alt="HYVE" className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-white">
            {mode === 'new' ? 'Create Your Identity' : 'Link from Phone'}
          </h1>
          <p className="text-white/40 text-sm mt-1">
            {mode === 'new'
              ? 'Your keys are generated on this device only'
              : 'Share your identity across devices'}
          </p>
        </div>

        {/* Mode switcher — only show on first step */}
        {(step === 'id' || step === 'link-code') && (
          <div className="flex rounded-xl overflow-hidden border border-white/10 mb-6">
            <button
              onClick={() => { setMode('new'); setStep('id'); setError('') }}
              className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
                mode === 'new'
                  ? 'bg-[#FFB800] text-black'
                  : 'bg-white/5 text-white/40 hover:text-white/60'
              }`}
            >
              New Identity
            </button>
            <button
              onClick={() => { setMode('link'); setStep('link-code'); setError('') }}
              className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
                mode === 'link'
                  ? 'bg-[#39FF14] text-black'
                  : 'bg-white/5 text-white/40 hover:text-white/60'
              }`}
            >
              Link from Phone
            </button>
          </div>
        )}

        {/* ── New identity steps ── */}
        {mode === 'new' && step === 'id' && (
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
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#FFB800]/50 transition-colors"
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

        {mode === 'new' && step === 'pin' && (
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
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#FFB800]/50 transition-colors"
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
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#FFB800]/50 transition-colors"
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

        {/* ── Link from Phone steps ── */}
        {mode === 'link' && step === 'link-code' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-2 block">
                On your phone: Settings → Link Web Browser → Copy Code
              </label>
              <textarea
                value={linkCode}
                onChange={e => { setLinkCode(e.target.value); setError('') }}
                placeholder="Paste link code here…"
                rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#39FF14]/50 transition-colors text-xs font-mono resize-none"
              />
              {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
            </div>
            <button
              onClick={() => {
                if (!linkCode.trim()) { setError('Paste your link code first'); return }
                setError('')
                setStep('link-pin')
              }}
              className="w-full py-3 rounded-xl font-bold text-sm text-black"
              style={{ background: 'linear-gradient(135deg, #39FF14 0%, #00cc00 100%)' }}
            >
              Continue →
            </button>
          </div>
        )}

        {mode === 'link' && step === 'link-pin' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-2 block">
                Set a PIN for this browser vault
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={linkPin}
                onChange={e => { setLinkPin(e.target.value); setError('') }}
                placeholder="PIN"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#39FF14]/50 transition-colors"
              />
            </div>
            <div>
              <input
                type="password"
                inputMode="numeric"
                value={linkPinConfirm}
                onChange={e => { setLinkPinConfirm(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && finishLink()}
                placeholder="Confirm PIN"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#39FF14]/50 transition-colors"
              />
              {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
            </div>
            <button
              onClick={finishLink}
              className="w-full py-3 rounded-xl font-bold text-sm text-black"
              style={{ background: 'linear-gradient(135deg, #39FF14 0%, #00cc00 100%)' }}
            >
              Link Device
            </button>
            <button
              onClick={() => setStep('link-code')}
              className="w-full text-center text-xs text-white/30 hover:text-white/60 transition-colors mt-1"
            >
              ← Back
            </button>
          </div>
        )}

        {step === 'working' && (
          <div className="text-center space-y-4">
            <div className="w-8 h-8 border-2 border-[#FFB800] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-white/60 text-sm">{status || 'Please wait…'}</p>
          </div>
        )}

        <p className="text-center text-xs text-white/20 mt-8">
          {mode === 'link'
            ? 'Link code contains private keys — keep it secure'
            : 'Your identity keys never leave this device'}
        </p>
      </div>
    </div>
  )
}
