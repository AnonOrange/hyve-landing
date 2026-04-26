'use client';

// After Stripe redirects with ?session=cs_xxx, we activate the audit, then
// walk the user through agreement → asset registration → trigger scan.

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

const AGREEMENT = `By signing below I represent that I am the owner of (or hold authorization to test)
each of the assets I will list in the next step. I authorize Hyve Spy to perform
non-disruptive network scans (port probes, banner grabs, HTTP/HTTPS GET requests
to common camera endpoints) against the assets I list, for the sole purpose of
identifying exposure risks and producing a remediation report.

I understand that:
  · This authorization is limited to the assets I list.
  · Scans are one-shot, lasting up to 60 minutes total.
  · No content from my cameras is recorded or kept beyond the report.
  · Findings are stored against my audit ID and not disclosed to third parties.
  · This authorization is recorded with my typed name, IP, and timestamp as the
    legal record of consent (same model used by professional pen-testing firms).

I agree.`;

type Audit = {
  id: string;
  user_email: string;
  tier: string;
  asset_quota: number;
  status: string;
  agreement_signed_at: string | null;
};

type Asset = {
  id: string;
  asset_type: string;
  identifier: string;
  display_label: string | null;
  verification_status: string;
  verification_token: string | null;
};

function SetupInner() {
  const search = useSearchParams();
  const router = useRouter();
  const sessionId = search.get('session');

  const [audit, setAudit] = useState<Audit | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Sign agreement state
  const [signedName, setSignedName] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [signing, setSigning] = useState(false);

  // Asset add state
  const [newType, setNewType] = useState<'domain' | 'ip' | 'cidr' | 'camera_serial'>('domain');
  const [newIdentifier, setNewIdentifier] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);

  // Activate audit (idempotent — server checks for existing record by session_id)
  useEffect(() => {
    if (!sessionId) {
      setError('Missing session id. Did you complete checkout?');
      return;
    }
    fetch('/api/spy/sentinel/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.error) { setError(j.error); return; }
        setAudit(j.audit);
        if (j.audit?.agreement_signed_at) setStep(2);
        if (j.audit?.status === 'complete') {
          router.replace(`/spy/app/sentinel/report/${j.audit.id}`);
        }
      })
      .catch((e) => setError(String(e)));
  }, [sessionId, router]);

  // Refresh assets list after step 2
  useEffect(() => {
    if (!audit?.id || step !== 2) return;
    fetch(`/api/spy/sentinel/assets?audit=${audit.id}`)
      .then((r) => r.json())
      .then((j) => setAssets(j.assets || []))
      .catch(() => {});
  }, [audit?.id, step]);

  const sign = async () => {
    if (!signedName.trim() || !accepted || !audit) return;
    setSigning(true);
    try {
      const r = await fetch('/api/spy/sentinel/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditId: audit.id, signedName }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'Sign failed');
      setAudit({ ...audit, agreement_signed_at: new Date().toISOString() });
      setStep(2);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setSigning(false);
    }
  };

  const addAsset = async () => {
    if (!newIdentifier.trim() || !audit) return;
    setAdding(true);
    try {
      const r = await fetch('/api/spy/sentinel/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditId: audit.id,
          assetType: newType,
          identifier: newIdentifier,
          displayLabel: newLabel || null,
        }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setAssets((a) => [j.asset, ...a]);
      setNewIdentifier('');
      setNewLabel('');
    } catch (e: any) {
      alert(e.message || String(e));
    } finally {
      setAdding(false);
    }
  };

  const triggerScan = async () => {
    if (!audit) return;
    setStep(3);
    try {
      const r = await fetch('/api/spy/sentinel/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditId: audit.id }),
      });
      const j = await r.json();
      if (j.reportUrl) {
        // Brief delay so user sees the "scanning..." state
        setTimeout(() => router.push(j.reportUrl), 2000);
      } else {
        alert(j.error || 'Scan failed');
      }
    } catch (e: any) {
      alert(String(e));
    }
  };

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020D14] p-6">
        <div className="max-w-sm rounded border border-[#FF2D2D] bg-[#FF2D2D]/10 p-5 text-center">
          <div className="mb-2 text-[10px] font-black tracking-widest text-[#FF2D2D]">ERROR</div>
          <div className="text-sm text-white">{error}</div>
          <a href="/spy/app/sentinel" className="mt-4 inline-block rounded border border-[#0D2235] px-3 py-1.5 text-[10px] font-bold text-[#94A3B8]">
            ← BACK
          </a>
        </div>
      </main>
    );
  }

  if (!audit) {
    return <div className="flex min-h-screen items-center justify-center bg-[#020D14] text-xs text-[#94A3B8]">Activating audit…</div>;
  }

  return (
    <main className="min-h-screen bg-[#020D14] pb-24 text-[#E2E8F0]">
      <div className="border-b border-[#0D2235] px-4 py-3">
        <div className="font-mono text-[10px] tracking-[0.4em] text-[#A855F7]">SENTINEL · SETUP</div>
        <div className="text-sm font-bold text-white">{audit.tier.toUpperCase()} · up to {audit.asset_quota} assets</div>
        <div className="mt-1 font-mono text-[10px] text-[#64748B]">Audit ID: {audit.id.slice(0, 8)}</div>
      </div>

      {/* Step indicators */}
      <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-4">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`h-1 flex-1 rounded-full ${step >= s ? 'bg-[#A855F7]' : 'bg-[#0D2235]'}`} />
        ))}
      </div>

      {/* Step 1: Agreement */}
      {step === 1 && (
        <section className="mx-auto max-w-2xl px-4 py-4">
          <div className="mb-3 font-mono text-[10px] tracking-widest text-[#A855F7]">STEP 1 · AUTHORIZATION AGREEMENT</div>
          <pre className="mb-4 max-h-72 overflow-y-auto rounded border border-[#0D2235] bg-black/40 p-4 font-mono text-[11px] leading-relaxed text-[#E2E8F0] whitespace-pre-wrap">{AGREEMENT}</pre>

          <label className="mb-3 flex cursor-pointer items-start gap-2">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 accent-[#A855F7]" />
            <span className="text-xs text-[#E2E8F0]">I have read and agree to the authorization terms above.</span>
          </label>

          <label className="mb-1 block font-mono text-[10px] tracking-widest text-[#94A3B8]">YOUR FULL NAME (typed signature)</label>
          <input
            type="text"
            value={signedName}
            onChange={(e) => setSignedName(e.target.value)}
            placeholder="Jane Q. Public"
            className="mb-3 w-full rounded border border-[#0D2235] bg-black/60 px-3 py-2 font-mono text-sm text-white placeholder-[#475569] outline-none focus:border-[#A855F7]"
          />

          <button
            onClick={sign}
            disabled={!accepted || !signedName.trim() || signing}
            className="w-full rounded bg-[#A855F7] px-4 py-3 text-xs font-black tracking-widest text-white disabled:opacity-40"
          >
            {signing ? 'SIGNING…' : 'SIGN + CONTINUE →'}
          </button>
        </section>
      )}

      {/* Step 2: Asset registration */}
      {step === 2 && (
        <section className="mx-auto max-w-2xl px-4 py-4">
          <div className="mb-3 font-mono text-[10px] tracking-widest text-[#A855F7]">STEP 2 · LIST ASSETS TO SCAN</div>
          <p className="mb-4 text-xs text-[#94A3B8]">
            List up to {audit.asset_quota} assets you own. Domain assets will need a one-time DNS TXT record to verify ownership.
            IP/CIDR/camera assets are auto-verified by your signed agreement.
          </p>

          {/* Add asset form */}
          <div className="mb-4 rounded border border-[#0D2235] bg-black/30 p-4">
            <div className="mb-2 font-mono text-[10px] tracking-widest text-[#94A3B8]">+ ADD ASSET</div>
            <select value={newType} onChange={(e) => setNewType(e.target.value as any)} className="mb-2 w-full rounded border border-[#0D2235] bg-black/60 px-3 py-2 text-xs text-white">
              <option value="domain">Domain (e.g. home.example.com)</option>
              <option value="ip">Static IP (e.g. 73.110.198.200)</option>
              <option value="cidr">IP range / CIDR (e.g. 192.0.2.0/28)</option>
              <option value="camera_serial">Camera by brand+model+serial</option>
            </select>
            <input
              type="text"
              value={newIdentifier}
              onChange={(e) => setNewIdentifier(e.target.value)}
              placeholder={newType === 'domain' ? 'home.example.com' : newType === 'ip' ? '73.110.198.200' : newType === 'cidr' ? '192.0.2.0/28' : 'Hikvision DS-2CD2042 · serial DS123456'}
              className="mb-2 w-full rounded border border-[#0D2235] bg-black/60 px-3 py-2 font-mono text-xs text-white placeholder-[#475569]"
            />
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Display label (optional) · e.g. Front porch cam"
              className="mb-2 w-full rounded border border-[#0D2235] bg-black/60 px-3 py-2 text-xs text-white placeholder-[#475569]"
            />
            <button
              onClick={addAsset}
              disabled={!newIdentifier.trim() || adding}
              className="w-full rounded border border-[#A855F7] bg-[#A855F7]/10 px-3 py-2 text-[10px] font-black tracking-widest text-[#A855F7] disabled:opacity-40"
            >
              {adding ? 'ADDING…' : 'ADD'}
            </button>
          </div>

          {/* Existing assets list */}
          {assets.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="font-mono text-[10px] tracking-widest text-[#94A3B8]">{assets.length} OF {audit.asset_quota} REGISTERED</div>
              {assets.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded border border-[#0D2235] bg-black/30 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold text-white">{a.display_label || a.identifier}</div>
                    <div className="font-mono text-[10px] text-[#64748B]">{a.asset_type} · {a.identifier}</div>
                    {a.verification_status === 'pending' && a.verification_token && (
                      <div className="mt-1 rounded border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-2 font-mono text-[10px] text-[#F59E0B]">
                        Add this DNS TXT record to {a.identifier}:<br />
                        <code className="break-all text-[#FBBF24]">{a.verification_token}</code>
                      </div>
                    )}
                  </div>
                  <div className="ml-3 shrink-0 rounded bg-black/60 px-2 py-0.5 font-mono text-[9px] tracking-widest" style={{ color: a.verification_status === 'verified' ? '#22C55E' : '#F59E0B' }}>
                    {a.verification_status.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={triggerScan}
            disabled={assets.length === 0}
            className="w-full rounded bg-[#A855F7] px-4 py-3 text-xs font-black tracking-widest text-white disabled:opacity-40"
          >
            🔍 START SCAN ({assets.length} asset{assets.length === 1 ? '' : 's'})
          </button>
        </section>
      )}

      {/* Step 3: Scanning */}
      {step === 3 && (
        <section className="mx-auto flex min-h-[400px] max-w-md flex-col items-center justify-center px-4">
          <div className="mb-4 text-4xl">🔍</div>
          <div className="mb-2 font-mono text-[10px] tracking-widest text-[#A855F7]">SCANNING…</div>
          <div className="mb-4 text-sm text-white">Probing your registered assets</div>
          <div className="font-mono text-[10px] text-[#64748B]">Redirecting to your report momentarily…</div>
        </section>
      )}
    </main>
  );
}

export default function SetupPage() {
  return (
    <Suspense>
      <SetupInner />
    </Suspense>
  );
}
