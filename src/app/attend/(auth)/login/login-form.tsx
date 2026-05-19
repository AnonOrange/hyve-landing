'use client'

import { useState } from 'react'
import { attendBrowserClient } from '@/lib/attend/identity/supabase-browser'

const inputClass =
  'rounded border border-[#2a2135] bg-[#111111] px-3 py-2 text-sm text-[#ede8d8] outline-none focus:border-[#E8C456]'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const supabase = attendBrowserClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError(signInError.message)
        return
      }
      await fetch('/api/attend/auth/sync', { method: 'POST' })
      window.location.href = '/attend/creator'
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
      <input
        type="email"
        required
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={inputClass}
      />
      <input
        type="password"
        required
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={inputClass}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-[#E8C456] px-3 py-2 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-50"
      >
        {loading ? 'Logging in…' : 'Log in'}
      </button>
      <p className="text-center text-xs text-[#9e8a55]">
        New to HYVE Attend?{' '}
        <a href="/attend/signup" className="text-[#E8C456] hover:underline">Create an account</a>
      </p>
    </form>
  )
}
