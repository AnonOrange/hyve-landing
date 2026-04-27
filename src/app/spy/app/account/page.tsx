'use client'

// Account management page — accessible from the mobile app's Settings tab
// (which routes here via WebView) and directly from /spy/app/account on web.
//
// Surfaces three capabilities:
//   1. Subscription summary — current tier + status from /api/spy/verify-session
//   2. Manage billing — opens Stripe Customer Portal (cancel / update card / etc.)
//   3. Delete account — destructive, double-confirmed, calls /api/spy/account/delete
//
// Everything else (notification prefs, AI key, watchlist) stays in the
// existing /spy/app/settings page; this is the dedicated account-control surface.

import { useEffect, useState } from 'react'

type VerifyResponse = {
  active: boolean
  status?: string
  tier?: 'pro' | 'basic' | null
  currentPeriodEnd?: number | null
  cancelAtPeriodEnd?: boolean
}

export default function AccountPage() {
  const [verify, setVerify] = useState<VerifyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  // Delete-account flow state
  const [confirmStep, setConfirmStep] = useState<0 | 1 | 2>(0)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteResult, setDeleteResult] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/spy/verify-session', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: VerifyResponse) => setVerify(d))
      .catch((e) => setErr(e?.message || 'Failed to load subscription'))
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete() {
    if (confirmText !== 'DELETE') {
      setErr('Type DELETE to confirm')
      return
    }
    setDeleting(true)
    setErr(null)
    try {
      const r = await fetch('/api/spy/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error || 'Delete failed')
      setDeleteResult(
        `Account deleted. Subscription canceled${data.canceled ? ` (${data.canceled})` : ''}, ${data.detachedPaymentMethods} payment method(s) detached, ${data.supabaseRows} data rows removed.`,
      )
      // Cookies are cleared by the response — redirect to home after a beat
      setTimeout(() => {
        window.location.href = '/spy'
      }, 4000)
    } catch (e: any) {
      setErr(e?.message || 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#08070a] pb-32 text-[#ede8d8]">
      <div className="sticky top-0 z-20 border-b border-[#2a2135] bg-[#08070a]/95 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="text-[10px] font-black tracking-[0.4em] text-[#E8C456]">ACCOUNT</div>
          <div className="font-mono text-[10px] text-[#9e8a55]">Subscription · billing · data</div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 pt-6">
        {/* ───── Subscription summary ───── */}
        <Section label="SUBSCRIPTION">
          {loading ? (
            <div className="font-mono text-[11px] text-[#6b5e3a]">loading…</div>
          ) : verify == null ? (
            <div className="font-mono text-[11px] text-[#FF2D2D]">Failed to load subscription.</div>
          ) : (
            <SubscriptionSummary v={verify} />
          )}
        </Section>

        {/* ───── Billing portal ───── */}
        <Section label="BILLING">
          <p className="text-[12px] leading-relaxed text-[#9e8a55]">
            Open the Stripe billing portal to update your payment method, switch tiers, view
            invoices, or cancel your subscription.
          </p>
          <a
            href="/api/spy/portal-session"
            className="mt-3 inline-block rounded border border-[#E8C456] bg-[#E8C456]/10 px-4 py-2 text-[11px] font-bold tracking-widest text-[#E8C456] transition hover:bg-[#E8C456]/20"
          >
            MANAGE BILLING ↗
          </a>
        </Section>

        {/* ───── Data + privacy ───── */}
        <Section label="DATA & PRIVACY">
          <p className="text-[12px] leading-relaxed text-[#9e8a55]">
            Your account data is stored across Stripe (subscription) and Supabase (alerts,
            watchlist, sentinel audits). You can request a full export by emailing{' '}
            <a href="mailto:support@hyveapp.co" className="text-[#E8C456] underline-offset-4 hover:underline">
              support@hyveapp.co
            </a>
            .
          </p>
        </Section>

        {/* ───── Delete account (destructive) ───── */}
        <div className="mt-8 rounded-lg border-2 border-[#FF2D2D]/40 bg-[#FF2D2D]/05 p-5" style={{ background: 'rgba(255,45,45,0.05)' }}>
          <div className="text-[10px] font-black tracking-[0.3em] text-[#FF2D2D]">DELETE ACCOUNT</div>
          <p className="mt-2 text-[12px] leading-relaxed text-[#9e8a55]">
            This is permanent. We immediately cancel your active subscription, detach payment methods,
            delete your alert subscriptions / watchlist / Sentinel audit history, and clear all session
            cookies. There is no undo and no grace period — once deleted, you'd need to sign up again to
            return.
          </p>

          {confirmStep === 0 && (
            <button
              onClick={() => setConfirmStep(1)}
              className="mt-4 rounded border border-[#FF2D2D] bg-[#FF2D2D]/10 px-4 py-2 text-[11px] font-bold tracking-widest text-[#FF2D2D] transition hover:bg-[#FF2D2D]/20"
            >
              I UNDERSTAND, START DELETION
            </button>
          )}

          {confirmStep >= 1 && deleteResult == null && (
            <div className="mt-4 space-y-3">
              <p className="text-[11px] text-[#FF2D2D]">
                Type <strong>DELETE</strong> below to confirm.
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full max-w-xs rounded border border-[#FF2D2D]/40 bg-black/60 px-3 py-2 font-mono text-sm text-white placeholder-[#475569] outline-none focus:border-[#FF2D2D]"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={deleting || confirmText !== 'DELETE'}
                  className="rounded bg-[#FF2D2D] px-4 py-2 text-[11px] font-black tracking-widest text-white transition hover:bg-red-700 disabled:opacity-40"
                >
                  {deleting ? 'DELETING…' : 'PERMANENTLY DELETE'}
                </button>
                <button
                  onClick={() => {
                    setConfirmStep(0)
                    setConfirmText('')
                    setErr(null)
                  }}
                  className="rounded border border-[#0D2235] bg-transparent px-4 py-2 text-[11px] font-bold tracking-widest text-[#9e8a55] hover:border-[#9e8a55]"
                >
                  CANCEL
                </button>
              </div>
              {err && <p className="text-[11px] text-[#FF2D2D]">{err}</p>}
            </div>
          )}

          {deleteResult && (
            <div className="mt-4 rounded border border-[#22C55E]/40 bg-[#22C55E]/05 p-3 text-[11px] text-[#22C55E]" style={{ background: 'rgba(34,197,94,0.05)' }}>
              {deleteResult} Redirecting…
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-lg border border-[#2a2135] bg-black/30 p-5">
      <div className="text-[10px] font-black tracking-[0.3em] text-[#E8C456]">{label}</div>
      <div className="mt-3">{children}</div>
    </div>
  )
}

function SubscriptionSummary({ v }: { v: VerifyResponse }) {
  if (!v.active) {
    return (
      <div>
        <div className="font-mono text-[12px] text-[#FF2D2D]">No active subscription</div>
        <p className="mt-2 text-[11px] text-[#9e8a55]">
          You'll need to subscribe to use Hyve Spy.
        </p>
        <a
          href="/spy#pricing"
          className="mt-3 inline-block rounded border border-[#E8C456] bg-[#E8C456]/10 px-4 py-2 text-[11px] font-bold tracking-widest text-[#E8C456]"
        >
          SEE PLANS
        </a>
      </div>
    )
  }
  const tier = v.tier ? v.tier.toUpperCase() : 'BASIC'
  const renew = v.currentPeriodEnd ? new Date(v.currentPeriodEnd * 1000).toLocaleDateString() : null
  return (
    <div>
      <div className="flex items-baseline gap-3">
        <div className="text-2xl font-black text-[#E8C456]">{tier}</div>
        <div
          className="rounded border px-2 py-0.5 text-[9px] font-bold tracking-widest"
          style={{
            borderColor: v.status === 'trialing' ? '#22C55E' : v.status === 'active' ? '#E8C456' : '#F59E0B',
            color: v.status === 'trialing' ? '#22C55E' : v.status === 'active' ? '#E8C456' : '#F59E0B',
          }}
        >
          {(v.status || 'active').toUpperCase()}
        </div>
      </div>
      <div className="mt-2 font-mono text-[11px] text-[#9e8a55]">
        {v.cancelAtPeriodEnd ? (
          <>Will not renew. Access continues through {renew}.</>
        ) : renew ? (
          <>Renews {renew}.</>
        ) : (
          <>—</>
        )}
      </div>
    </div>
  )
}
