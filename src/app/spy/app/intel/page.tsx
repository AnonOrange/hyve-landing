'use client';

// Intel hub — landing page that routes to the three Pro intel tabs:
// surveillance infrastructure, sex offender registry, and crime heatmap.
// Each is its own dedicated single-purpose map for fast, focused load.

import Link from 'next/link';

const TILES: { href: string; label: string; subtitle: string; color: string; icon: string; count: string }[] = [
  {
    href: '/spy/app/surveillance',
    label: 'SURVEILLANCE',
    subtitle: 'Flock ALPR · Drones · Face Recognition · ShotSpotter · Stingrays · 16 layers',
    color: '#F59E0B',
    icon: '⚠',
    count: '164,733 markers',
  },
  {
    href: '/spy/app/offenders',
    label: 'OFFENDERS',
    subtitle: 'Registered sex offenders by location · State + county registries',
    color: '#A855F7',
    icon: '⛔',
    count: '97k+ records',
  },
];

export default function IntelHub() {
  return (
    <main className="flex min-h-screen w-screen flex-col bg-[#020D14] pb-24 text-[#E2E8F0]">
      <div className="border-b border-[#0D2235] px-4 py-3">
        <div className="font-mono text-[10px] tracking-[0.4em] text-[#94A3B8]">HYVE SPY</div>
        <div className="text-base font-black text-white">Intel · Pro</div>
        <div className="mt-1 text-[10px] text-[#64748B]">Each layer has its own dedicated map. Tap to open.</div>
      </div>
      <div className="grid gap-3 p-4">
        {TILES.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group rounded-lg border-2 p-5 transition active:scale-[0.99]"
            style={{ borderColor: t.color, background: `${t.color}0F` }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2 font-mono text-[10px] tracking-[0.3em]" style={{ color: t.color }}>
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </div>
                <p className="text-sm text-[#E2E8F0]">{t.subtitle}</p>
                <div className="mt-2 font-mono text-[10px] text-[#94A3B8]">{t.count}</div>
              </div>
              <div className="ml-3 text-2xl text-[#475569] transition group-hover:translate-x-1" style={{ color: t.color }}>
                →
              </div>
            </div>
          </Link>
        ))}
      </div>
      <div className="px-4 pt-2 font-mono text-[10px] text-[#475569]">
        Each tab loads its own data only. Crime got promoted to its own bottom-nav tab — see 🔥 CRIME.
      </div>
    </main>
  );
}
