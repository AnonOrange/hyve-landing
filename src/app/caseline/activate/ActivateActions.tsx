// Client-side actions for /caseline/activate: copy-to-clipboard for the
// license key + a deep-link to open the desktop app (if registered).

'use client'

import { useState } from 'react'
import Link from 'next/link'

const ACCENT = '#00B4D8'

export default function ActivateActions({ licenseKey }: { licenseKey: string }) {
  const [copied, setCopied] = useState(false)

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(licenseKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // fall through — selection already works via select-all
    }
  }

  return (
    <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
      <button
        type="button"
        onClick={copyKey}
        className="rounded border-2 px-6 py-3 font-mono text-xs font-bold tracking-[0.3em] transition hover:bg-white/5"
        style={{ borderColor: ACCENT, color: ACCENT }}
      >
        {copied ? 'COPIED ✓' : 'COPY KEY'}
      </button>
      <Link
        href="/caseline/download"
        className="rounded px-7 py-3 font-mono text-xs font-bold tracking-[0.3em] text-black transition hover:scale-[1.02]"
        style={{ background: ACCENT, boxShadow: `0 0 18px ${ACCENT}66` }}
      >
        DOWNLOAD CASELINE →
      </Link>
    </div>
  )
}
