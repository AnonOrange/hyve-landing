'use client'

import { useState, FormEvent } from 'react'

type Status = 'idle' | 'loading' | 'success' | 'error'

const CATEGORIES = [
  'Bug Report',
  'Crash / App Not Starting',
  'Security Concern',
  'Feature Request',
  'Other',
]

export default function ReportForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('loading')

    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, category, message }),
      })

      if (!res.ok) throw new Error('Server error')
      setStatus('success')
      setName('')
      setEmail('')
      setCategory(CATEGORIES[0])
      setMessage('')
    } catch {
      setStatus('error')
    }
  }

  return (
    <section id="report" className="py-20 px-6">
      <div className="section-divider max-w-6xl mx-auto mb-20" />

      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="inline-block px-4 py-1.5 rounded-full border border-gold/30 bg-gold/5 text-gold text-xs font-semibold tracking-widest uppercase mb-4">
            Beta Feedback
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-3">
            Report a Problem
          </h2>
          <p className="text-white/50 text-base">
            Found a bug, crash, or security issue? Tell us. Every report helps make HYVE better.
          </p>
        </div>

        {/* Form card */}
        <div className="hyve-card rounded-2xl p-8">
          {status === 'success' ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-neon/10 border border-neon/30 flex items-center justify-center mx-auto mb-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="#39FF14" strokeWidth="2" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Report Sent</h3>
              <p className="text-white/50 text-sm mb-6">
                Thanks for helping improve HYVE. We&apos;ll review your report at{' '}
                <span className="text-gold">vibesoftwaresolutions@gmail.com</span>.
              </p>
              <button
                onClick={() => setStatus('idle')}
                className="btn-outline px-6 py-2 rounded-xl text-sm"
              >
                Send Another
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name + Email row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="hyve-input w-full rounded-xl px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="hyve-input w-full rounded-xl px-4 py-3 text-sm"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="hyve-input w-full rounded-xl px-4 py-3 text-sm appearance-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} className="bg-surface">
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                  Description
                </label>
                <textarea
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  placeholder="Describe the issue in detail. Include steps to reproduce if it's a bug."
                  className="hyve-input w-full rounded-xl px-4 py-3 text-sm resize-none"
                />
              </div>

              {/* Error message */}
              {status === 'error' && (
                <p className="text-red-400 text-sm">
                  Something went wrong. Please try again or email us directly at{' '}
                  <a href="mailto:vibesoftwaresolutions@gmail.com" className="underline">
                    vibesoftwaresolutions@gmail.com
                  </a>
                </p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={status === 'loading'}
                className="btn-primary w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {status === 'loading' ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                      <path d="M22 12A10 10 0 0012 2" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    Sending…
                  </>
                ) : (
                  'Send Report'
                )}
              </button>

              <p className="text-center text-xs text-white/30">
                Reports are sent to{' '}
                <span className="text-white/50">vibesoftwaresolutions@gmail.com</span>
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
