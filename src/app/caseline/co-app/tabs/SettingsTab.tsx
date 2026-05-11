// Settings — sign-in/out, license activation, PWA install hint, sign-out.

'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'

const ACCENT = '#00B4D8'
const LICENSE_KEY_STORE = 'caseline-co-app-license-v1'
const VALIDATE_ENDPOINT = 'https://www.hyveapp.co/api/caseline/validate'

interface ValidateResult {
  valid: boolean
  reason?: string
  tier?: string
  maxSeats?: number
  expiresAt?: number
  stripeStatus?: string
}

export default function SettingsTab() {
  const { user, signInWithGoogle, signOut } = useAuth()
  const [licenseKey, setLicenseKey] = useState('')
  const [validation, setValidation] = useState<ValidateResult | null>(null)
  const [validating, setValidating] = useState(false)
  const [installable, setInstallable] = useState(false)
  const [installEvent, setInstallEvent] = useState<{ prompt: () => void } | null>(null)

  useEffect(() => {
    const stored = window.localStorage.getItem(LICENSE_KEY_STORE)
    if (stored) {
      setLicenseKey(stored)
      void validate(stored)
    }
  }, [])

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault()
      setInstallEvent(e as unknown as { prompt: () => void })
      setInstallable(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  async function validate(key: string) {
    if (!key) { setValidation(null); return }
    setValidating(true)
    try {
      const r = await fetch(`${VALIDATE_ENDPOINT}?key=${encodeURIComponent(key.trim().toUpperCase())}`)
      const data = (await r.json()) as ValidateResult
      setValidation(data)
    } catch (e) {
      setValidation({ valid: false, reason: e instanceof Error ? e.message : 'unreachable' })
    } finally {
      setValidating(false)
    }
  }

  function save() {
    const k = licenseKey.trim().toUpperCase()
    if (k) {
      window.localStorage.setItem(LICENSE_KEY_STORE, k)
      void validate(k)
    } else {
      window.localStorage.removeItem(LICENSE_KEY_STORE)
      setValidation(null)
    }
  }

  function install() {
    if (installEvent) {
      installEvent.prompt()
    }
  }

  return (
    <div className="co-settings">
      <Section title="ACCOUNT">
        {user ? (
          <>
            <div className="co-row">
              <span className="co-label">Signed in as</span>
              <span className="co-val">{user.isAnonymous ? '(anonymous)' : user.email ?? '(no email)'}</span>
            </div>
            <div className="co-row">
              <span className="co-label">User ID</span>
              <span className="co-val co-mono">{user.uid.slice(0, 12)}…</span>
            </div>
            {user.isAnonymous ? (
              <button type="button" className="co-btn" onClick={() => void signInWithGoogle()}>
                LINK GOOGLE ACCOUNT
              </button>
            ) : (
              <button type="button" className="co-btn co-btn--ghost" onClick={() => void signOut()}>
                SIGN OUT
              </button>
            )}
          </>
        ) : (
          <button type="button" className="co-btn" onClick={() => void signInWithGoogle()}>
            SIGN IN WITH GOOGLE
          </button>
        )}
      </Section>

      <Section title="LICENSE">
        <input
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={19}
          className="co-input"
          placeholder="HYVE-XXXX-XXXX-XXXX"
          value={licenseKey}
          onChange={(e) => setLicenseKey(e.currentTarget.value.toUpperCase())}
        />
        <button type="button" className="co-btn" onClick={save}>
          {validating ? 'CHECKING…' : 'SAVE & VALIDATE'}
        </button>
        {validation && (
          <div className={`co-validation ${validation.valid ? 'ok' : 'bad'}`}>
            {validation.valid
              ? `✓ Active · ${validation.tier === '10' ? 'FIRM' : 'STARTER'} · expires ${validation.expiresAt ? new Date(validation.expiresAt).toLocaleDateString() : '—'}`
              : `✗ ${humanReason(validation.reason)}`}
          </div>
        )}
        <p className="co-hint">
          The Co-App is free to use as long as your firm has a valid CaseLine license. Buy at{' '}
          <a href="https://www.hyveapp.co/caseline/buy" target="_blank" rel="noopener noreferrer">hyveapp.co/caseline/buy</a>.
        </p>
      </Section>

      <Section title="INSTALL">
        {installable ? (
          <>
            <button type="button" className="co-btn" onClick={install}>INSTALL TO HOME SCREEN</button>
            <p className="co-hint">After installing, launch from the home screen icon for fullscreen access.</p>
          </>
        ) : (
          <p className="co-hint">
            On iPhone: tap <strong>Share → Add to Home Screen</strong>.<br />
            On Android: tap the browser menu → <strong>Install app</strong>.
          </p>
        )}
      </Section>

      <Section title="ABOUT">
        <div className="co-row"><span className="co-label">Version</span><span className="co-val co-mono">1.0.0</span></div>
        <div className="co-row"><span className="co-label">Backend</span><span className="co-val co-mono">hyveapp.co</span></div>
        <p className="co-hint">
          © 2026 Hyve · Anthony S. Owens c/o{' '}
          <a href="https://www.vibesoftwaresolutions.com" target="_blank" rel="noopener noreferrer">Vibe Software Solutions</a>.
        </p>
      </Section>

      <style jsx>{`
        .co-settings { display: grid; gap: 14px; }
        .co-input {
          width: 100%;
          background: var(--co-panel);
          border: 1px solid var(--co-border);
          color: var(--co-text);
          font-family: 'Courier New', monospace;
          letter-spacing: 0.1em;
          padding: 12px 14px;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
        }
        .co-input:focus { border-color: ${ACCENT}; }
        .co-btn {
          width: 100%;
          background: ${ACCENT}; color: #000;
          border: none; border-radius: 8px;
          padding: 12px;
          font-family: 'Courier New', monospace;
          font-weight: 800; letter-spacing: 0.2em; font-size: 12px;
          cursor: pointer;
        }
        .co-btn--ghost {
          background: transparent;
          color: var(--co-muted);
          border: 1px solid var(--co-border);
        }
        .co-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 8px 0;
          font-size: 13px;
          border-bottom: 1px dashed var(--co-border);
        }
        .co-row:last-of-type { border-bottom: none; }
        .co-label { color: var(--co-muted); font-size: 11px; letter-spacing: 0.15em; font-family: 'Courier New', monospace; }
        .co-val { color: var(--co-text); }
        .co-mono { font-family: 'Courier New', monospace; font-size: 11px; }
        .co-hint {
          color: var(--co-muted);
          font-size: 12px; line-height: 1.5;
          margin-top: 10px;
        }
        .co-hint a { color: ${ACCENT}; }
        .co-validation {
          font-family: 'Courier New', monospace;
          font-size: 11px; letter-spacing: 0.1em;
          padding: 8px 10px; border-radius: 6px; margin-top: 8px;
        }
        .co-validation.ok { color: ${ACCENT}; background: rgba(0,180,216,0.1); }
        .co-validation.bad { color: #fca5a5; background: rgba(239,68,68,0.1); }
      `}</style>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="co-section">
      <div className="co-section-title">{title}</div>
      <div>{children}</div>
      <style jsx>{`
        .co-section {
          background: var(--co-panel);
          border: 1px solid var(--co-border);
          border-radius: 10px;
          padding: 14px 16px;
        }
        .co-section-title {
          font-family: 'Courier New', monospace;
          font-size: 10px; letter-spacing: 0.3em;
          color: var(--co-accent);
          margin-bottom: 10px;
        }
      `}</style>
    </section>
  )
}

function humanReason(reason?: string): string {
  if (reason === 'not-found') return 'License key not found.'
  if (reason === 'expired') return 'License expired.'
  if (reason === 'malformed-key') return 'Key format is HYVE-XXXX-XXXX-XXXX.'
  if (reason === 'missing-key') return 'Enter a key first.'
  if (reason?.startsWith('stripe-status-')) return `Stripe status: ${reason.replace('stripe-status-', '')}.`
  return reason ? `Invalid (${reason}).` : 'Invalid.'
}
