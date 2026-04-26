'use client';

// Landing page for Sentinel (camera audit) + Scout (pen test).
// Both run the same flow: pay → sign → register → scan → report.
// User picks scope_type at checkout.

import { useState } from 'react';

const SCOPES = {
  cameras: {
    label: 'CAMERA EXPOSURE AUDIT',
    accent: '#A855F7',
    icon: '📹',
    tagline: 'Find every camera you own that\'s exposed to the internet — and fix it.',
    sample: [
      { sev: 'critical', title: 'Hikvision DVR exposed without authentication',  vendor: 'Hikvision' },
      { sev: 'high',     title: 'Foscam camera using default admin password',     vendor: 'Foscam' },
      { sev: 'medium',   title: 'RTSP stream accessible without authentication',  vendor: 'Generic' },
    ],
    tiers: [
      { tier: 'personal', name: 'Personal',   quota: 5,   cents:  999, blurb: 'Up to 5 assets' },
      { tier: 'family',   name: 'Family',     quota: 20,  cents: 1999, blurb: 'Up to 20 assets' },
      { tier: 'business', name: 'Business',   quota: 100, cents: 4999, blurb: 'Up to 100 assets' },
    ],
  },
  pentest: {
    label: 'INFRASTRUCTURE PEN TEST',
    accent: '#FF2D2D',
    icon: '🛡',
    tagline: 'Same idea, broader scope: DNS, SSL, ports, headers, subdomains, default credentials.',
    sample: [
      { sev: 'critical', title: 'Database port exposed to public internet',       vendor: 'Network' },
      { sev: 'high',     title: 'No DMARC policy — domain spoofable in email',    vendor: 'DNS' },
      { sev: 'high',     title: 'Weak TLS configuration · TLS 1.0/1.1 enabled',   vendor: 'SSL/TLS' },
    ],
    tiers: [
      { tier: 'personal', name: 'Personal',       quota: 3,   cents:  4999, blurb: 'Up to 3 assets' },
      { tier: 'family',   name: 'Small Business', quota: 10,  cents:  9999, blurb: 'Up to 10 assets' },
      { tier: 'business', name: 'Enterprise',     quota: 50,  cents: 29999, blurb: 'Up to 50 assets' },
    ],
  },
} as const;

const SEV_COLOR: Record<string, string> = {
  critical: '#FF2D2D', high: '#F59E0B', medium: '#FBBF24', low: '#22D3EE',
};

export default function SentinelLanding() {
  const [scope, setScope] = useState<'cameras' | 'pentest'>('cameras');
  const [busy, setBusy] = useState<string | null>(null);
  const meta = SCOPES[scope];

  const startCheckout = async (tier: string) => {
    setBusy(tier);
    try {
      const r = await fetch('/api/spy/sentinel/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, scope }),
      });
      const j = await r.json();
      if (j.url) window.location.href = j.url;
      else alert(j.error || 'Checkout failed');
    } catch (e: any) {
      alert(String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#020D14] pb-24 text-[#E2E8F0]">
      <div className="border-b border-[#0D2235] px-4 py-4">
        <div className="font-mono text-[10px] tracking-[0.4em]" style={{ color: meta.accent }}>HYVE SENTINEL</div>
        <div className="text-2xl font-black text-white">Pay once. Get a real security audit.</div>
        <div className="mt-1 text-xs text-[#94A3B8]">
          Same legal model as professional pen-testing firms — authorization captured up-front, scoped to assets you own.
        </div>
      </div>

      {/* Scope tabs */}
      <div className="mx-auto flex max-w-3xl gap-2 px-4 py-4">
        {(['cameras', 'pentest'] as const).map((s) => {
          const m = SCOPES[s];
          const active = scope === s;
          return (
            <button
              key={s}
              onClick={() => setScope(s)}
              className="flex-1 rounded-lg border-2 p-4 text-left transition"
              style={{
                borderColor: active ? m.accent : '#0D2235',
                background: active ? `${m.accent}1A` : 'transparent',
              }}
            >
              <div className="mb-1 flex items-center gap-2 font-mono text-[10px] tracking-widest" style={{ color: active ? m.accent : '#64748B' }}>
                <span>{m.icon}</span>
                <span>{m.label}</span>
              </div>
              <div className="text-xs leading-relaxed text-[#E2E8F0]">{m.tagline}</div>
            </button>
          );
        })}
      </div>

      {/* Sample findings preview */}
      <section className="mx-auto max-w-3xl px-4 py-4">
        <div className="mb-2 font-mono text-[10px] tracking-widest text-[#94A3B8]">SAMPLE FINDINGS YOU MIGHT GET</div>
        <div className="space-y-2">
          {meta.sample.map((f, i) => (
            <div key={i} className="flex items-center gap-3 rounded border border-[#0D2235] bg-black/30 p-3">
              <span className="rounded px-2 py-0.5 text-[9px] font-black tracking-widest text-white" style={{ background: SEV_COLOR[f.sev] }}>
                {f.sev.toUpperCase()}
              </span>
              <span className="flex-1 text-xs text-white">{f.title}</span>
              <span className="font-mono text-[10px] text-[#64748B]">{f.vendor}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 font-mono text-[10px] text-[#64748B]">
          Real reports include: vendor signature, port, endpoint path, severity, and 6-8 click-by-click remediation steps per finding.
        </div>
      </section>

      {/* Pricing tiers */}
      <section className="mx-auto max-w-3xl px-4 py-4">
        <div className="mb-3 font-mono text-[10px] tracking-widest text-[#94A3B8]">PICK A TIER · PAY ONCE</div>
        <div className="grid gap-3 md:grid-cols-3">
          {meta.tiers.map((t) => (
            <button
              key={t.tier}
              onClick={() => startCheckout(t.tier)}
              disabled={!!busy}
              className="rounded-lg border-2 p-5 text-left transition hover:scale-[1.01] disabled:opacity-50"
              style={{ borderColor: meta.accent, background: `${meta.accent}0F` }}
            >
              <div className="mb-1 font-mono text-[10px] tracking-widest" style={{ color: meta.accent }}>{t.name.toUpperCase()}</div>
              <div className="text-3xl font-black text-white">${(t.cents / 100).toFixed(2)}</div>
              <div className="mt-1 text-xs text-[#94A3B8]">{t.blurb}</div>
              <div className="mt-3 font-mono text-[10px]" style={{ color: meta.accent }}>
                {busy === t.tier ? 'OPENING CHECKOUT…' : 'START AUDIT →'}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Legal posture */}
      <section className="mx-auto max-w-3xl px-4 py-6">
        <div className="rounded border border-[#0D2235] bg-black/30 p-5">
          <div className="mb-2 font-mono text-[10px] tracking-widest text-[#94A3B8]">HOW THIS IS LEGAL</div>
          <ul className="space-y-1.5 text-xs text-[#E2E8F0]">
            <li>▸ <strong>You authorize us</strong> to scan only the specific assets you list.</li>
            <li>▸ Authorization is captured with your typed name, IP, and timestamp — same legal record professional pen-testing firms use.</li>
            <li>▸ Scope is locked to your listed assets only — we don\'t scan anything else.</li>
            <li>▸ For domains, we verify ownership via DNS TXT record before scanning.</li>
            <li>▸ Findings are stored against your audit ID and never shared with third parties.</li>
            <li>▸ Audits are one-shot. We don\'t monitor or rescan unless you explicitly request another audit.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
