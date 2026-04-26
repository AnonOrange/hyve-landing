'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  {
    href: '/spy/app',
    label: 'Map',
    match: (p: string) => p === '/spy/app',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#00D4FF' : '#64748B'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
        <line x1="8" y1="2" x2="8" y2="18" />
        <line x1="16" y1="6" x2="16" y2="22" />
      </svg>
    ),
  },
  {
    href: '/spy/app/feeds',
    label: 'Feeds',
    match: (p: string) => p.startsWith('/spy/app/feeds'),
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#00D4FF' : '#64748B'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12.55a11 11 0 0 1 19.84 0" />
        <path d="M5.5 16.05a7 7 0 0 1 13 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
    ),
  },
  {
    href: '/spy/app/cameras',
    label: 'Cams',
    match: (p: string) => p.startsWith('/spy/app/cameras'),
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#00D4FF' : '#64748B'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 7l-7 5 7 5V7z" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    ),
  },
  {
    href: '/spy/app/crime',
    label: 'Crime',
    match: (p: string) => p.startsWith('/spy/app/crime'),
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#EF4444' : '#64748B'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* Police shield silhouette */}
        <path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: '/spy/app/intel',
    label: 'Intel',
    match: (p: string) => p.startsWith('/spy/app/intel') || p.startsWith('/spy/app/surveillance') || p.startsWith('/spy/app/offenders'),
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#F59E0B' : '#64748B'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: '/spy/app/world',
    label: 'Globe',
    match: (p: string) => p === '/spy/app/world' || p.startsWith('/spy/app/world/'),
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#22C55E' : '#64748B'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  {
    href: '/spy/app/world-cams',
    label: 'W-Cams',
    match: (p: string) => p.startsWith('/spy/app/world-cams'),
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#22C55E' : '#64748B'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9 8l6 4-6 4z" fill={active ? '#22C55E' : '#64748B'} />
      </svg>
    ),
  },
  {
    href: '/spy/app/tv',
    label: 'TV',
    match: (p: string) => p.startsWith('/spy/app/tv'),
    // CRT/television icon — red "ON AIR" tint when active.
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#EF4444' : '#64748B'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="13" rx="2" ry="2" />
        <polyline points="17 2 12 7 7 2" />
        {active && <circle cx="18.5" cy="10.5" r="0.8" fill="#EF4444" stroke="none" />}
      </svg>
    ),
  },
  {
    href: '/spy/app/radio',
    label: 'Radio',
    match: (p: string) => p.startsWith('/spy/app/radio'),
    // Radio tower with broadcast waves.
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#22C55E' : '#64748B'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="2" />
        <path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14" />
      </svg>
    ),
  },
  {
    href: '/spy/app/pulse',
    label: 'Pulse',
    match: (p: string) => p.startsWith('/spy/app/pulse'),
    // Heartbeat / activity pulse glyph
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#FF2D2D' : '#64748B'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    href: '/spy/app/roulette',
    label: 'Roulette',
    match: (p: string) => p.startsWith('/spy/app/roulette'),
    // Dice / random target glyph
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#A855F7' : '#64748B'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8" cy="8" r="1.2" fill="currentColor" />
        <circle cx="16" cy="16" r="1.2" fill="currentColor" />
        <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: '/spy/app/ticker',
    label: 'Ticker',
    match: (p: string) => p.startsWith('/spy/app/ticker'),
    // Newspaper / ticker tape glyph
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#F59E0B' : '#64748B'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16v16H4z" />
        <line x1="4" y1="9" x2="20" y2="9" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="14" y2="17" />
      </svg>
    ),
  },
  {
    href: '/spy/app/panopticon',
    label: 'Panop',
    match: (p: string) => p.startsWith('/spy/app/panopticon'),
    // Big eye glyph
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#A855F7' : '#64748B'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    href: '/spy/app/watchlist',
    label: 'Watch',
    match: (p: string) => p.startsWith('/spy/app/watchlist'),
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#00D4FF' : '#64748B'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    href: '/spy/app/settings',
    label: 'Settings',
    match: (p: string) => p.startsWith('/spy/app/settings'),
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#00D4FF' : '#64748B'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export default function SpyBottomNav() {
  const pathname = usePathname() || '/spy/app';
  // Hide on full-screen feed detail
  if (/^\/spy\/app\/feed\/[^/]+/.test(pathname)) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[3000] border-t border-[#0D2235] bg-[#020D14]/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/*
        15 tabs in a clean 3 rows × 5 cols grid. Same icon/label size as the
        old 9-tab nav — every cell stays a comfortable tap target.
      */}
      <ul className="mx-auto grid max-w-3xl grid-cols-5">
        {NAV.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex flex-col items-center gap-1 py-2 transition"
              >
                {item.icon(active)}
                <span
                  className="text-[10px] font-bold tracking-widest"
                  style={{ color: active ? '#00D4FF' : '#64748B' }}
                >
                  {item.label.toUpperCase()}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
