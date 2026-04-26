'use client'

import { useState } from 'react'

export default function SpyLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'signing' | 'error'>('idle')
  const [err, setErr] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setStatus('signing')
    setErr('')
    try {
      const res = await fetch('/api/spy/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Invalid email or password')
      window.location.href = '/spy/app'
    } catch (e: any) {
      setErr(e?.message || 'Sign-in failed')
      setStatus('error')
    }
  }

  return (
    <main className="min-h-screen bg-[#020D14] text-[#E2E8F0] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-lg border border-[#0D2235] bg-black/40 p-8">
        <div className="mb-1 text-[10px] font-black tracking-[0.4em] text-[#00D4FF]">HYVE SPY</div>
        <h1 className="mb-6 text-2xl font-black tracking-tight text-white">Sign in</h1>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-[#0D2235] bg-black/60 px-3 py-2 text-sm text-white placeholder-[#334155] outline-none focus:border-[#00D4FF]"
          />
          <input
            type="password"
            autoComplete="current-password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-[#0D2235] bg-black/60 px-3 py-2 text-sm text-white placeholder-[#334155] outline-none focus:border-[#00D4FF]"
          />
          <button
            type="submit"
            disabled={status === 'signing'}
            className="w-full rounded bg-[#00D4FF] px-4 py-2 text-xs font-black tracking-widest text-[#020D14] transition hover:bg-white disabled:opacity-50"
          >
            {status === 'signing' ? 'SIGNING IN…' : 'SIGN IN →'}
          </button>
          {err && <p className="font-mono text-xs text-[#FF2D2D]">{err}</p>}
        </form>

        <p className="mt-6 text-[11px] text-[#475569]">
          No account? <a href="/spy#pricing" className="text-[#00D4FF] hover:text-white">Start the 72-hour free trial →</a>
        </p>
      </div>
    </main>
  )
}
