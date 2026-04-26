'use client';

// Sentinel + Scout one-shot audit — production landing page.
// Two products, one chassis. Pay → sign → register → scan → report.

import { useState } from 'react';

const SCOPES = {
  cameras: {
    label: 'CAMERA EXPOSURE AUDIT',
    headline: 'Find every camera you own that’s exposed to the internet.',
    subheadline: 'We scan the cameras you list, flag the ones leaking video or admin access, and hand you click-by-click instructions to lock each one down. Pay once. Get a real report. No subscription.',
    accent: '#A855F7',
    badge: 'SENTINEL',
    icon: '📹',
    detectionsTitle: 'Detections covered',
    detections: [
      'Hikvision DVR/NVR exposed without authentication',
      'Dahua cameras using default admin credentials',
      'Foscam devices with weak passwords or open CGI',
      'Axis cameras streaming video without auth',
      'Generic IP cameras with open RTSP (port 554)',
      'Bonus: any database ports exposed alongside your cameras',
    ],
    sampleFindings: [
      { sev: 'critical', title: 'Hikvision DVR exposed without authentication',  vendor: 'Hikvision' },
      { sev: 'high',     title: 'Foscam camera using default admin password',     vendor: 'Foscam' },
      { sev: 'medium',   title: 'RTSP stream accessible without authentication',  vendor: 'Generic' },
    ],
    tiers: [
      { tier: 'personal', name: 'Personal',   quota: 5,   cents:  999, blurb: 'Up to 5 assets', best: false },
      { tier: 'family',   name: 'Family',     quota: 20,  cents: 1999, blurb: 'Up to 20 assets', best: true  },
      { tier: 'business', name: 'Business',   quota: 100, cents: 4999, blurb: 'Up to 100 assets', best: false },
    ],
  },
  pentest: {
    label: 'INFRASTRUCTURE PEN TEST',
    headline: 'Real pen-test audit, plain-English remediation, one fixed price.',
    subheadline: 'We probe your domains and IPs for the same vulnerabilities a $5,000 consultant would find: missing email auth, weak TLS, exposed databases, dangling DNS, missing security headers. You get a deliverable report with vendor-specific fix steps.',
    accent: '#FF2D2D',
    badge: 'SCOUT',
    icon: '🛡',
    detectionsTitle: 'Checks performed',
    detections: [
      'DNS — missing SPF + DMARC, dangling CNAMEs (subdomain takeover risk)',
      'SSL/TLS — expired/expiring certs, weak protocols (TLS 1.0/1.1), untrusted chains',
      'HTTP — missing security headers (HSTS, CSP, X-Frame, etc.) + server version leaks',
      'Network — exposed admin panels (routers, NAS, IoT controllers)',
      'Database — public-facing MySQL, Postgres, Redis, Mongo, Elasticsearch, CouchDB, Memcached',
      'Each finding includes vendor + port + endpoint + exact remediation steps',
    ],
    sampleFindings: [
      { sev: 'critical', title: 'PostgreSQL port exposed to public internet',     vendor: 'Network' },
      { sev: 'high',     title: 'No DMARC policy — domain spoofable in email',    vendor: 'DNS' },
      { sev: 'high',     title: 'Weak TLS configuration · TLS 1.0/1.1 enabled',   vendor: 'SSL/TLS' },
    ],
    tiers: [
      { tier: 'personal', name: 'Personal',       quota: 3,   cents:  4999, blurb: 'Up to 3 assets', best: false },
      { tier: 'family',   name: 'Small Business', quota: 10,  cents:  9999, blurb: 'Up to 10 assets', best: true  },
      { tier: 'business', name: 'Enterprise',     quota: 50,  cents: 29999, blurb: 'Up to 50 assets', best: false },
    ],
  },
} as const;

const SEV_COLOR: Record<string, string> = {
  critical: '#FF2D2D', high: '#F59E0B', medium: '#FBBF24', low: '#22D3EE',
};

const FAQ = [
  {
    q: 'Is this legal?',
    a: 'Yes. You authorize us to scan only the specific assets you list — same legal model professional pen-testing firms use under CFAA. We capture your typed name, IP address, and timestamp as the legal record of authorization. Scope is locked to your assets only; we never touch anyone else’s.',
  },
  {
    q: 'How does the scan know what’s mine?',
    a: 'For domains, you prove ownership by adding a DNS TXT record we generate. For IPs / CIDR ranges / camera serials, your signed authorization is the legal attestation that you own the asset. False attestation voids the audit and may have legal consequences for you, not us.',
  },
  {
    q: 'How long does it take?',
    a: 'Most audits complete in 30 seconds to 5 minutes. You’ll see a "scanning…" screen, then auto-redirect to your report. We also email the report URL to your address so you don’t need to bookmark anything.',
  },
  {
    q: 'What if I find more than X exposures?',
    a: 'Every finding ships with click-by-click remediation. Most are fixable in under 10 minutes (change a password, disable UPnP, add a TXT record). For complex cases, the report links to the relevant CVE / vendor advisory.',
  },
  {
    q: 'What if you find nothing?',
    a: 'You get a clean-bill-of-health report. That’s a legitimate outcome — well-configured infrastructure is rarer than people think. Either way, you have a documented audit timestamped against your name.',
  },
  {
    q: 'Refunds?',
    a: 'Full refund within 24 hours of purchase if you haven’t completed the scan. No refunds after the scan runs because we’ve incurred the compute cost and delivered the report. Contact support@hyveapp.co to request.',
  },
  {
    q: 'Will this disrupt my services?',
    a: 'No. Every probe is a single non-disruptive request — DNS lookups, one TLS handshake, one HTTP GET, one TCP connect (no SYN scan, no flood). Indistinguishable from any normal user hitting your site.',
  },
  {
    q: 'Do you store my data?',
    a: 'We store the encrypted audit record (asset identifiers, findings, your typed signature) for 7 days post-scan, then auto-purge sensitive details. The audit metadata (severity counts, timestamps, your signature) is kept for 90 days for your compliance trail. We never store camera footage, response bodies, or default credentials we discover.',
  },
  {
    q: 'How is my data encrypted?',
    a: 'Hyve Encryption uses AES-256-GCM (NIST-standard authenticated encryption) with per-audit keys derived via HKDF-SHA256 from a master key that lives in our environment, never in the database. Even if our database is breached, an attacker gets ciphertext blobs they can\'t decrypt without our master key — and they\'d need each audit\'s UUID to derive its specific key.',
  },
  {
    q: 'What happens after the 7-day purge?',
    a: 'On day 7 after your scan completes, every sensitive field is deleted: all findings rows are removed, asset identifiers are nulled, verification tokens cleared. What remains is just the audit metadata (severity counts, your signature, timestamps) for your compliance trail. The report page shows a "purged" notice with the date. Save or print your report within 7 days if you need a longer-term record.',
  },
  {
    q: 'Can you audit a system you can\'t see remotely?',
    a: 'No. Sentinel/Scout probe externally — they look at your assets the way an attacker on the internet would. If your camera lives only on your home LAN with no port-forward, we can\'t reach it (which is exactly the point — that means it\'s not exposed). For internal-only audits, you\'d need on-premise scanning tools, not a remote service.',
  },
];

export default function SentinelLanding() {
  const [scope, setScope] = useState<'cameras' | 'pentest'>('cameras');
  const [busy, setBusy] = useState<string | null>(null);
  const [recoverEmail, setRecoverEmail] = useState('');
  const [recoverMsg, setRecoverMsg] = useState<string | null>(null);
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

  const recoverAudits = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoverMsg(null);
    try {
      const r = await fetch('/api/spy/sentinel/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoverEmail }),
      });
      const j = await r.json();
      setRecoverMsg(j.message || 'If we have audits for that email, we’ve sent the URLs.');
    } catch {
      setRecoverMsg('Lookup failed. Try again or email support@hyveapp.co.');
    }
  };

  return (
    <main className="min-h-screen bg-[#020D14] text-[#E2E8F0]">
      {/* Hero */}
      <header className="relative overflow-hidden border-b border-[#0D2235]">
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{
          backgroundImage: `radial-gradient(ellipse at top, ${meta.accent}33, transparent 60%)`,
        }} />
        <div className="relative mx-auto max-w-5xl px-6 pt-12 pb-16 md:pt-20 md:pb-24">
          {/* Scope toggle */}
          <div className="mb-8 inline-flex rounded-lg border border-[#0D2235] bg-black/40 p-1">
            {(['cameras', 'pentest'] as const).map((s) => {
              const m = SCOPES[s];
              const active = scope === s;
              return (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className="rounded px-4 py-2 text-xs font-bold tracking-widest transition"
                  style={{
                    background: active ? m.accent : 'transparent',
                    color: active ? '#020D14' : '#94A3B8',
                  }}
                >
                  {m.icon} {m.badge}
                </button>
              );
            })}
          </div>

          <h1 className="text-4xl font-black leading-[1.05] tracking-tight md:text-6xl">
            {meta.headline}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-[#94A3B8] md:text-xl">
            {meta.subheadline}
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href="#pricing"
              className="rounded-lg px-6 py-3 text-sm font-black tracking-widest transition hover:scale-[1.02]"
              style={{ background: meta.accent, color: '#020D14', boxShadow: `0 0 60px -10px ${meta.accent}80` }}
            >
              SEE PRICING
            </a>
            <a href="#how" className="rounded-lg border border-[#334155] px-6 py-3 text-sm font-bold tracking-widest text-[#E2E8F0] transition hover:border-[#94A3B8]">
              HOW IT WORKS
            </a>
          </div>

          {/* Trust strip */}
          <div className="mt-12 grid gap-4 border-t border-[#0D2235] pt-8 text-xs text-[#64748B] md:grid-cols-4">
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-2xl font-black text-white">
                <span style={{ color: '#22C55E' }}>🔒</span>
                <span>AES-256</span>
              </div>
              Hyve Encryption per audit
            </div>
            <div><div className="mb-1 text-2xl font-black text-white">7-day</div>Auto-purge of details</div>
            <div><div className="mb-1 text-2xl font-black text-white">~30s</div>Typical scan time</div>
            <div><div className="mb-1 text-2xl font-black text-white">$9.99+</div>Pay once, no subscription</div>
          </div>
        </div>
      </header>

      {/* What we detect */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="mb-8 text-2xl font-black md:text-3xl">{meta.detectionsTitle}</h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {meta.detections.map((d, i) => (
            <li key={i} className="flex items-start gap-3 rounded border border-[#0D2235] bg-black/30 p-4">
              <span className="mt-0.5 text-base" style={{ color: meta.accent }}>✓</span>
              <span className="text-sm leading-relaxed text-[#E2E8F0]">{d}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Sample report */}
      <section className="mx-auto max-w-5xl px-6 py-16 border-t border-[#0D2235]">
        <h2 className="mb-3 text-2xl font-black md:text-3xl">Sample findings you might receive</h2>
        <p className="mb-8 text-sm text-[#94A3B8]">Each finding includes severity, vendor, port, signature, and 6-8 click-by-click remediation steps.</p>
        <div className="rounded-lg border border-[#0D2235] bg-black/40 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] tracking-[0.4em] text-[#64748B]">SAMPLE REPORT</div>
              <div className="text-base font-bold text-white">3 findings · 2 critical · 1 high</div>
            </div>
            <div className="hidden text-right font-mono text-[10px] text-[#475569] md:block">
              audit ID: a1b2c3d4-...<br />Completed in 47s
            </div>
          </div>
          <div className="space-y-3">
            {meta.sampleFindings.map((f, i) => (
              <div key={i} className="rounded border bg-black/30 p-4" style={{ borderColor: SEV_COLOR[f.sev] }}>
                <div className="mb-2 flex items-center gap-3">
                  <span className="rounded px-2 py-0.5 text-[9px] font-black tracking-widest text-white" style={{ background: SEV_COLOR[f.sev] }}>
                    {f.sev.toUpperCase()}
                  </span>
                  <span className="font-mono text-[10px] text-[#64748B]">{f.vendor}</span>
                </div>
                <div className="text-sm font-bold text-white">{f.title}</div>
                <div className="mt-1.5 font-mono text-[10px] text-[#475569]">+ 6 click-by-click remediation steps included in your full report</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-5xl px-6 py-16 border-t border-[#0D2235]">
        <h2 className="mb-3 text-2xl font-black md:text-3xl">How it works</h2>
        <p className="mb-10 text-sm text-[#94A3B8]">Four steps. About five minutes of your time. The rest is automated.</p>
        <div className="grid gap-6 md:grid-cols-4">
          {[
            { n: 1, title: 'Pay once', body: 'Stripe checkout. No subscription, no auto-renewal.' },
            { n: 2, title: 'Sign authorization', body: 'Type your name to authorize us to scan only the assets you list. Same legal model as professional pen-testers.' },
            { n: 3, title: 'Register assets', body: 'Add domains, IPs, CIDR ranges, or camera serials. Domains require DNS TXT verification; the rest are covered by your signed agreement.' },
            { n: 4, title: 'Get your report', body: 'Auto-redirect to a severity-color-coded findings list with click-by-click remediation. Saved 90 days.' },
          ].map((s) => (
            <div key={s.n} className="rounded-lg border border-[#0D2235] bg-black/30 p-6">
              <div className="mb-3 inline-block rounded-full px-3 py-1 text-xs font-black" style={{ background: meta.accent, color: '#020D14' }}>{s.n}</div>
              <div className="mb-2 text-base font-bold text-white">{s.title}</div>
              <div className="text-sm leading-relaxed text-[#94A3B8]">{s.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Security & Privacy — flagship trust section, between How It Works and Pricing */}
      <section className="mx-auto max-w-5xl px-6 py-16 border-t border-[#0D2235]">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-2xl" style={{ color: '#22C55E' }}>🔒</span>
          <h2 className="text-2xl font-black md:text-3xl">Security & Privacy</h2>
        </div>
        <p className="mb-10 max-w-3xl text-sm leading-relaxed text-[#94A3B8]">
          We can't audit your systems if we open them up to other threats by storing the very data we just helped you secure.
          So we don't. Here's the engineering behind that promise:
        </p>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Encryption */}
          <div className="rounded-lg border-2 bg-black/30 p-6" style={{ borderColor: '#22C55E' }}>
            <div className="mb-3 flex items-center gap-2 font-mono text-[10px] tracking-widest text-[#22C55E]">
              <span>🔒</span>
              <span>HYVE ENCRYPTION</span>
            </div>
            <div className="mb-2 text-base font-bold text-white">AES-256-GCM with per-audit derived keys</div>
            <p className="mb-4 text-sm leading-relaxed text-[#94A3B8]">
              Every sensitive field — your IP/domain/asset identifiers, the vendor signatures we found, the endpoint paths,
              the remediation steps that document your specific issues — is encrypted at the application layer before it
              ever touches the database.
            </p>
            <ul className="space-y-1.5 text-xs text-[#E2E8F0]">
              <li>▸ <strong>AES-256-GCM</strong> — NIST-standard authenticated encryption</li>
              <li>▸ <strong>HKDF-derived per-audit keys</strong> — a single audit compromise can't leak others</li>
              <li>▸ <strong>Master key in env, never in DB</strong> — DB-only breaches yield ciphertext</li>
              <li>▸ <strong>Plaintext only in transit</strong> — your report response is the only place it briefly exists</li>
            </ul>
          </div>

          {/* Auto-purge */}
          <div className="rounded-lg border-2 bg-black/30 p-6" style={{ borderColor: '#A855F7' }}>
            <div className="mb-3 flex items-center gap-2 font-mono text-[10px] tracking-widest text-[#A855F7]">
              <span>🗑</span>
              <span>7-DAY AUTO-PURGE</span>
            </div>
            <div className="mb-2 text-base font-bold text-white">Sensitive details deleted after retention</div>
            <p className="mb-4 text-sm leading-relaxed text-[#94A3B8]">
              We don't retain a long-term map of your exposed systems. After 7 days, every sensitive field is purged.
              You keep the audit record (timestamp, signature, severity counts) for your compliance trail —
              we keep nothing actionable.
            </p>
            <ul className="space-y-1.5 text-xs text-[#E2E8F0]">
              <li>▸ <strong>Findings deleted entirely</strong> after day 7</li>
              <li>▸ <strong>Asset identifiers nulled</strong> — we forget what we scanned for you</li>
              <li>▸ <strong>Severity summary preserved</strong> — counts only, no detail</li>
              <li>▸ <strong>Save / print before day 7</strong> — for longer-term records</li>
            </ul>
          </div>

          {/* Scope safety */}
          <div className="rounded-lg border bg-black/30 p-6" style={{ borderColor: '#0D2235' }}>
            <div className="mb-3 font-mono text-[10px] tracking-widest text-[#94A3B8]">SCOPE LOCKED</div>
            <div className="mb-2 text-base font-bold text-white">We only scan what you list. Nothing else.</div>
            <p className="text-sm leading-relaxed text-[#94A3B8]">
              Your authorization is captured with typed name + IP + timestamp + user agent — same legal record professional
              pen-testing firms use. Scope is enforced at the orchestrator: probes refuse to run against any target not on your
              registered list. We don't scan adjacent infrastructure, neighbors, or anyone else.
            </p>
          </div>

          {/* Non-disruptive */}
          <div className="rounded-lg border bg-black/30 p-6" style={{ borderColor: '#0D2235' }}>
            <div className="mb-3 font-mono text-[10px] tracking-widest text-[#94A3B8]">NON-DISRUPTIVE</div>
            <div className="mb-2 text-base font-bold text-white">Looks identical to normal user traffic.</div>
            <p className="text-sm leading-relaxed text-[#94A3B8]">
              Every probe is a single non-disruptive request: DNS lookup, one TLS handshake, one HTTP GET, TCP connect-only
              for ports. No SYN scans, no fuzzing, no flood. Indistinguishable from any normal user hitting your site —
              your services keep running and your IDS doesn't fire.
            </p>
          </div>
        </div>

        {/* What we DON'T store */}
        <div className="mt-8 rounded-lg border border-[#0D2235] bg-black/30 p-5">
          <div className="mb-2 font-mono text-[10px] tracking-widest text-[#FF2D2D]">WE NEVER STORE</div>
          <div className="grid gap-2 text-xs text-[#E2E8F0] md:grid-cols-2">
            <div>✗ Camera footage or video stream content</div>
            <div>✗ HTTP response bodies from your assets</div>
            <div>✗ Default credentials we discover (yours or anyone's)</div>
            <div>✗ Screenshots of your admin panels or dashboards</div>
            <div>✗ Any payload that could re-enable an attack</div>
            <div>✗ Plaintext copies of asset identifiers in any logs</div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-5xl px-6 py-16 border-t border-[#0D2235]">
        <div className="mb-3 text-center">
          <h2 className="text-2xl font-black md:text-3xl">Pick a tier · pay once</h2>
          <p className="mt-2 text-sm text-[#94A3B8]">No subscription. No auto-renewal. The price you see is the only price.</p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {meta.tiers.map((t) => (
            <div
              key={t.tier}
              className="relative rounded-xl border-2 bg-black/30 p-6"
              style={{ borderColor: t.best ? meta.accent : '#0D2235' }}
            >
              {t.best && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-black tracking-widest text-[#020D14]" style={{ background: meta.accent }}>
                  MOST POPULAR
                </div>
              )}
              <div className="mb-2 font-mono text-[10px] tracking-widest" style={{ color: meta.accent }}>{t.name.toUpperCase()}</div>
              <div className="mb-1 flex items-baseline gap-1">
                <span className="text-4xl font-black text-white">${(t.cents / 100).toFixed(2)}</span>
                <span className="font-mono text-[10px] text-[#64748B]">one-time</span>
              </div>
              <div className="mb-4 text-sm text-[#94A3B8]">{t.blurb}</div>
              <ul className="mb-6 space-y-2 text-xs text-[#94A3B8]">
                <li>▸ {t.quota} asset{(t.quota as number) === 1 ? '' : 's'} (domain, IP, or CIDR)</li>
                <li>▸ Severity-color-coded findings report</li>
                <li>▸ Vendor-specific remediation steps</li>
                <li>▸ Email confirmation + 90-day report retention</li>
                <li>▸ 24-hour refund window if scan unfinished</li>
              </ul>
              <button
                onClick={() => startCheckout(t.tier)}
                disabled={!!busy}
                className="block w-full rounded-lg py-3 text-center text-xs font-black tracking-widest transition hover:scale-[1.02] disabled:opacity-50"
                style={{ background: meta.accent, color: '#020D14' }}
              >
                {busy === t.tier ? 'OPENING CHECKOUT…' : `START AUDIT — $${(t.cents / 100).toFixed(2)}`}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-16 border-t border-[#0D2235]">
        <h2 className="mb-8 text-2xl font-black md:text-3xl">Frequently asked</h2>
        <div className="space-y-4">
          {FAQ.map((f, i) => (
            <details key={i} className="group rounded-lg border border-[#0D2235] bg-black/30 p-5">
              <summary className="cursor-pointer text-base font-bold text-white">{f.q}</summary>
              <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Recover audit */}
      <section className="mx-auto max-w-3xl px-6 py-16 border-t border-[#0D2235]">
        <h2 className="mb-3 text-2xl font-black md:text-3xl">Lost your audit URL?</h2>
        <p className="mb-6 text-sm text-[#94A3B8]">Enter the email you used at checkout. We’ll email you links to every audit on that address.</p>
        <form onSubmit={recoverAudits} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            value={recoverEmail}
            onChange={(e) => setRecoverEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="flex-1 rounded-lg border border-[#0D2235] bg-black/60 px-4 py-3 text-sm text-white placeholder-[#475569] outline-none focus:border-[#94A3B8]"
          />
          <button
            type="submit"
            className="rounded-lg border border-[#0D2235] px-6 py-3 text-xs font-black tracking-widest text-[#E2E8F0] transition hover:border-[#94A3B8]"
          >
            EMAIL ME MY AUDITS
          </button>
        </form>
        {recoverMsg && <div className="mt-4 text-sm text-[#22C55E]">{recoverMsg}</div>}
      </section>

      {/* Refund + Legal */}
      <section className="mx-auto max-w-3xl px-6 py-16 border-t border-[#0D2235]">
        <h2 className="mb-3 text-2xl font-black md:text-3xl">Refund policy</h2>
        <p className="text-sm leading-relaxed text-[#94A3B8]">
          Full refund within <strong className="text-white">24 hours of purchase</strong> if you have not completed the scan. No refunds after
          the scan completes because we’ve incurred compute costs and delivered the deliverable. To request a refund, email
          <a href="mailto:support@hyveapp.co" className="ml-1 text-[#00D4FF] hover:underline">support@hyveapp.co</a> with your audit ID and we’ll
          process it within 2 business days.
        </p>
        <h3 className="mt-8 mb-2 text-lg font-bold">Legal posture</h3>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-[#94A3B8]">
          <li>You authorize us in writing (typed name + IP + timestamp + user agent) to scan only the specific assets you list.</li>
          <li>Scope is locked to those assets only — enforced at the orchestrator. We do not scan adjacent infrastructure, neighbors, or anyone else.</li>
          <li>Domain assets require DNS TXT verification before scanning.</li>
          <li>All probes are non-disruptive (DNS lookups, single TLS handshake, single HTTP GET, TCP connect-only).</li>
          <li><strong>Sensitive findings are encrypted at rest with AES-256-GCM</strong> using per-audit derived keys, never plaintext in our database.</li>
          <li><strong>Sensitive details auto-purge 7 days after the scan completes</strong> — we don't retain a long-term map of any user's exposed systems.</li>
          <li>Same legal model used by Bishop Fox, Mandiant, NCC Group, and other professional security firms.</li>
        </ul>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#0D2235] py-8 text-center font-mono text-[10px] uppercase tracking-[0.4em] text-[#475569]">
        Sentinel · Scout · part of Hyve Spy ·
        <a href="mailto:support@hyveapp.co" className="ml-2 hover:text-[#94A3B8]">support@hyveapp.co</a>
      </footer>
    </main>
  );
}
