'use client'

import { useState } from 'react'
import { attendBrowserClient } from '@/lib/attend/identity/supabase-browser'

const inputClass =
  'rounded border border-[#2a2135] bg-[#111111] px-3 py-2 text-sm text-[#ede8d8] outline-none focus:border-[#E8C456]'

export default function SignupForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setLoading(true)
    try {
      const supabase = attendBrowserClient()
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) {
        setError(signUpError.message)
        return
      }
      // If the project requires email confirmation, no session is returned yet.
      if (!data.session) {
        setNotice('Account created. Check your email to confirm, then log in.')
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
        minLength={8}
        placeholder="Password (8+ characters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={inputClass}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {notice && <p className="text-xs text-[#E8C456]">{notice}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-[#E8C456] px-3 py-2 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-50"
      >
        {loading ? 'Creating account…' : 'Create account'}
      </button>
      <p className="text-center text-xs text-[#9e8a55]">
        Already have an account?{' '}
        <a href="/attend/login" className="text-[#E8C456] hover:underline">Log in</a>
      </p>
    </form>
  )
}
