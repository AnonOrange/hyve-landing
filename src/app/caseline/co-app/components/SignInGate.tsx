// Shown when no user exists. In practice this rarely fires because
// AuthProvider auto-creates an anonymous user — but it's the fallback
// when anonymous sign-in itself fails (e.g. Firebase Auth domain
// misconfig, network blocking).

'use client'

import { useState } from 'react'
import { useAuth } from '../lib/auth'

export default function SignInGate() {
  const { signInWithGoogle } = useAuth()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function go() {
    setErr(null)
    setBusy(true)
    try { await signInWithGoogle() }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }

  return (
    <main className="co-app-gate">
      <div className="co-app-gate-card">
        <div className="co-app-gate-brand">CASELINE / CO-APP</div>
        <h1 className="co-app-gate-title">Sign in to sync.</h1>
        <p className="co-app-gate-help">
          Your phone needs to talk to the same account as your desktop CaseLine so cases stay in sync.
        </p>
        <button type="button" className="co-app-gate-btn" onClick={go} disabled={busy}>
          {busy ? 'OPENING…' : 'SIGN IN WITH GOOGLE'}
        </button>
        {err && <p className="co-app-gate-err">{err}</p>}
      </div>
      <style jsx>{`
        .co-app-gate {
          min-height: 100svh;
          display: grid; place-items: center;
          padding: 24px;
          background: var(--co-bg, #08070a);
          color: var(--co-text, #ede8d8);
        }
        .co-app-gate-card {
          max-width: 360px; width: 100%;
          border: 2px solid var(--co-accent, #00B4D8);
          background: rgba(0,180,216,0.08);
          padding: 28px;
          border-radius: 12px;
          text-align: center;
        }
        .co-app-gate-brand {
          font-family: 'Courier New', monospace;
          letter-spacing: 0.4em;
          font-size: 10px;
          color: var(--co-accent, #00B4D8);
        }
        .co-app-gate-title {
          margin: 12px 0 16px;
          font-size: 28px; font-weight: 900;
        }
        .co-app-gate-help {
          color: var(--co-muted, #9e8a55);
          font-size: 14px; line-height: 1.5;
          margin: 0 0 28px;
        }
        .co-app-gate-btn {
          width: 100%;
          padding: 14px;
          background: var(--co-accent, #00B4D8);
          color: #000;
          font-family: 'Courier New', monospace;
          font-weight: 800;
          letter-spacing: 0.2em;
          font-size: 13px;
          border: none; border-radius: 6px;
          cursor: pointer;
        }
        .co-app-gate-btn:disabled { opacity: 0.6; cursor: wait; }
        .co-app-gate-err {
          color: #fca5a5;
          font-size: 12px;
          margin-top: 12px;
        }
      `}</style>
    </main>
  )
}
