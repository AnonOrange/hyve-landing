'use client';

import { useEffect, useState } from 'react';

/**
 * Hidden by default — only shown to visitors whose `hyve_spy_session` cookie
 * still maps to an active Stripe subscription. Don't tease non-subscribers
 * with a button they can't use.
 */
export default function OpenWebAppButton() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/spy/verify-session', { cache: 'no-store', credentials: 'same-origin' })
      .then((r) => r.json())
      .then((j: { active: boolean }) => {
        if (!cancelled && j.active) setActive(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!active) return null;

  return (
    <a
      href="/spy/app"
      className="rounded border border-[#22C55E] bg-[#22C55E]/15 px-4 py-2 text-xs font-bold tracking-widest text-[#22C55E] transition hover:bg-[#22C55E]/25"
    >
      OPEN WEB APP →
    </a>
  );
}
