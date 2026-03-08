'use client'

import { useState } from 'react'

export default function ActivateForm({
  sessionId,
  prefillHyveId,
}: {
  sessionId: string
  prefillHyveId: string | null
}) {
  const [hyveId, setHyveId] = useState(prefillHyveId ? `@${prefillHyveId}` : '')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function activate() {
    const clean = hyveId.trim()
    if (!clean) { setErrorMsg('Enter your HYVE ID'); return }
    setStatus('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, hyve_id: clean }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (data.ok) {
        setStatus('success')
      } else {
        setErrorMsg(data.error || 'Activation failed')
        setStatus('error')
      }
    } catch {
      setErrorMsg('Network error — please try again')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="bg-neon/10 border border-neon/30 rounded-2xl p-6 mb-8 text-center">
        <div className="w-12 h-12 rounded-full bg-neon/20 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="font-bold text-white mb-1">HYVE Pro Activated!</p>
        <p className="text-sm text-white/50">
          Open the app, unlock with your PIN, and Pro features will be enabled.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white/5 border border-gold/20 rounded-2xl p-6 mb-8 text-left">
      <p className="text-xs font-semibold text-gold uppercase tracking-wider mb-4">
        Activate HYVE Pro
      </p>
      <p className="text-sm text-white/60 mb-4">
        Enter the HYVE ID you created in the app to unlock Pro features on your account.
      </p>
      <input
        type="text"
        value={hyveId}
        onChange={(e) => setHyveId(e.target.value)}
        placeholder="@yourusername"
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-gold/50 transition-colors mb-3"
      />
      {errorMsg && <p className="text-xs text-red-400 mb-3">{errorMsg}</p>}
      <button
        onClick={activate}
        disabled={status === 'loading'}
        className="btn-primary w-full px-6 py-3 rounded-xl font-bold text-sm disabled:opacity-50"
      >
        {status === 'loading' ? 'Activating…' : 'Activate Pro'}
      </button>
      <p className="text-xs text-white/30 mt-3 text-center">
        Don&apos;t have a HYVE ID yet? Download the app and set one up first.
      </p>
    </div>
  )
}
