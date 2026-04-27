'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-[#020D14] text-[#64748B]">
      <div className="text-center">
        <div className="mb-3 text-xs font-bold tracking-[0.4em] text-[#00D4FF]">HYVE SPY</div>
        <div className="text-sm">Loading tactical map…</div>
      </div>
    </div>
  ),
});

type GateState =
  | { kind: 'loading' }
  | { kind: 'active' }
  | { kind: 'inactive'; status?: string };

export default function SpyAppPage() {
  const [gate, setGate] = useState<GateState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/spy/verify-session', { cache: 'no-store', credentials: 'same-origin' })
      .then((r) => r.json())
      .then((j: { active: boolean; status?: string }) => {
        if (cancelled) return;
        setGate(j.active ? { kind: 'active' } : { kind: 'inactive', status: j.status });
      })
      .catch(() => {
        if (!cancelled) setGate({ kind: 'inactive' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (gate.kind === 'loading') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#020D14] text-[#64748B]">
        <div className="text-center">
          <div className="mb-3 text-xs font-bold tracking-[0.4em] text-[#00D4FF]">HYVE SPY</div>
          <div className="text-sm">Verifying subscription…</div>
        </div>
      </div>
    );
  }

  if (gate.kind === 'inactive') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#020D14] px-6 text-[#E2E8F0]">
        <div className="w-full max-w-md rounded-2xl border border-[#0D2235] bg-black/60 p-8 text-center">
          <div className="mb-3 font-mono text-[10px] font-bold tracking-[0.4em] text-[#FF2D2D]">
            ◆ ACCESS LOCKED
          </div>
          <h1 className="mb-3 text-2xl font-black">Account required</h1>
          <p className="mb-6 text-sm text-[#64748B]">
            Hyve Spy needs an account to stream live scanner audio and cameras.
            {gate.status ? ` (status: ${gate.status})` : ''}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="/spy/sign-up-free"
              className="inline-block rounded bg-[#22C55E] px-6 py-3 text-sm font-black uppercase tracking-widest text-[#020D14] transition hover:bg-[#16A34A]"
            >
              Start Free with Ads
            </a>
            <a
              href="/spy#pricing"
              className="inline-block rounded border border-[#00D4FF] bg-[#00D4FF]/10 px-6 py-3 text-sm font-black uppercase tracking-widest text-[#00D4FF] transition hover:bg-[#00D4FF]/20"
            >
              Subscribe — Remove Ads
            </a>
          </div>
          <p className="mt-4 text-[11px] text-[#334155]">
            Already paid on another device? Re-open your Stripe receipt link to re-bind this
            browser.
          </p>
        </div>
      </div>
    );
  }

  return <MapView />;
}
