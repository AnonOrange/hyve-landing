'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const KEY_STORAGE = 'hyve_spy_anthropic_key';
const NOTIFY_STORAGE = 'hyve_spy_notify_prefs';
const ACCOUNTS_BASE = 'https://hyve-spy-accounts.vercel.app';

type Subscription = {
  active: boolean;
  status?: string;
  currentPeriodEnd?: number | null;
  cancelAtPeriodEnd?: boolean;
};

type AccountMe = {
  email: string;
  userId: string;
  subscriptionStatus: string | null;
  watchlistCount: number;
  foiaCount: number;
  stripeLinked: boolean;
};

type NotifyPrefs = {
  major: boolean;
  spikes: boolean;
  watchlist: boolean;
};

const DEFAULT_PREFS: NotifyPrefs = { major: true, spikes: false, watchlist: true };

function readPrefs(): NotifyPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(NOTIFY_STORAGE);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export default function SettingsPage() {
  // Anthropic key
  const [apiKey, setApiKey] = useState('');
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  // Subscription
  const [sub, setSub] = useState<Subscription | null>(null);
  const [subLoading, setSubLoading] = useState(true);

  // Notifications
  const [notifyPerm, setNotifyPerm] = useState<NotificationPermission>('default');
  const [prefs, setPrefs] = useState<NotifyPrefs>(DEFAULT_PREFS);

  // Cross-device account
  const [me, setMe] = useState<AccountMe | null>(null);
  const [meLoading, setMeLoading] = useState(true);

  useEffect(() => {
    try {
      const k = localStorage.getItem(KEY_STORAGE);
      setSavedKey(k);
    } catch {}
    setPrefs(readPrefs());
    if (typeof Notification !== 'undefined') {
      setNotifyPerm(Notification.permission);
    }
  }, []);

  // Probe accounts service for signed-in state (relies on .hyveapp.co cookie)
  useEffect(() => {
    let cancelled = false;
    fetch(`${ACCOUNTS_BASE}/api/me`, { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: AccountMe | null) => {
        if (!cancelled) setMe(j);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setMeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Once signed in, sync localStorage watchlist into the cloud (one-way upload of any local-only items)
  useEffect(() => {
    if (!me) return;
    try {
      const raw = localStorage.getItem('hyve_spy_watchlist');
      if (!raw) return;
      const local: string[] = JSON.parse(raw);
      if (!Array.isArray(local) || local.length === 0) return;
      // Fire-and-forget upserts; server is idempotent via primary key
      Promise.all(
        local.map((feedId) =>
          fetch(`${ACCOUNTS_BASE}/api/watchlist`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ feedId }),
          }).catch(() => null)
        )
      );
    } catch {}
  }, [me]);

  // Once signed in, link the Stripe checkout session to the Supabase user (idempotent).
  // Reads the hyve_spy_session cookie set during the post-checkout redirect.
  useEffect(() => {
    if (!me || me.stripeLinked) return;
    const sessionId = document.cookie
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('hyve_spy_session='))
      ?.split('=')[1];
    if (!sessionId || !sessionId.startsWith('cs_')) return;
    fetch(`${ACCOUNTS_BASE}/api/stripe/link`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.ok) setMe((prev) => (prev ? { ...prev, stripeLinked: true } : prev));
      })
      .catch(() => {});
  }, [me]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/spy/verify-session', { cache: 'no-store', credentials: 'same-origin' })
      .then((r) => r.json())
      .then((j: Subscription) => {
        if (!cancelled) setSub(j);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSubLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveKey = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) return;
    try {
      localStorage.setItem(KEY_STORAGE, trimmed);
      setSavedKey(trimmed);
      setApiKey('');
      setKeySaved(true);
      setTimeout(() => setKeySaved(false), 1800);
    } catch {}
  };

  const clearKey = () => {
    try {
      localStorage.removeItem(KEY_STORAGE);
      setSavedKey(null);
    } catch {}
  };

  const requestNotify = async () => {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    setNotifyPerm(perm);
  };

  const togglePref = (k: keyof NotifyPrefs) => {
    const next = { ...prefs, [k]: !prefs[k] };
    setPrefs(next);
    try {
      localStorage.setItem(NOTIFY_STORAGE, JSON.stringify(next));
    } catch {}
  };

  const signOut = async () => {
    try {
      // Clear session cookie via simple expiration
      document.cookie = 'hyve_spy_session=; Max-Age=0; Path=/; SameSite=Lax';
    } catch {}
    window.location.href = '/spy';
  };

  return (
    <main className="min-h-screen bg-[#020D14] pb-24 text-[#E2E8F0]">
      <div
        className="sticky top-0 z-20 border-b border-[#0D2235] bg-[#020D14]/95 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="text-[10px] font-black tracking-[0.4em] text-[#00D4FF]">SETTINGS</div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-6 px-4 pt-5">
        {/* Cross-device sign-in */}
        <Section title="Sync Across Devices" accent="#22C55E">
          {meLoading ? (
            <div className="text-xs text-[#64748B]">Checking sign-in…</div>
          ) : me ? (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
                <span className="text-xs font-bold text-[#E2E8F0]">Signed in</span>
              </div>
              <div className="mb-3 font-mono text-[11px] text-[#64748B]">{me.email}</div>
              <div className="mb-3 grid grid-cols-2 gap-2 text-[10px]">
                <div className="rounded border border-[#0D2235] bg-black/40 p-2">
                  <div className="text-[#64748B]">WATCHLIST</div>
                  <div className="font-mono text-sm text-[#E2E8F0]">{me.watchlistCount}</div>
                </div>
                <div className="rounded border border-[#0D2235] bg-black/40 p-2">
                  <div className="text-[#64748B]">FOIA LOG</div>
                  <div className="font-mono text-sm text-[#E2E8F0]">{me.foiaCount}</div>
                </div>
              </div>
              <a
                href={`${ACCOUNTS_BASE}/account`}
                className="inline-block rounded border border-[#22C55E]/40 bg-[#22C55E]/10 px-3 py-2 text-[10px] font-black tracking-widest text-[#22C55E] transition hover:bg-[#22C55E]/20"
              >
                MANAGE ACCOUNT →
              </a>
            </div>
          ) : (
            <div>
              <p className="mb-3 text-xs text-[#64748B]">
                Sign in with email to sync your watchlist and FOIA log to any device. No password —
                we send a magic link.
              </p>
              <a
                href={`${ACCOUNTS_BASE}/login?return_url=https://www.hyveapp.co/spy/app/settings`}
                className="inline-block rounded bg-[#22C55E] px-4 py-2 text-[10px] font-black tracking-widest text-[#020D14] transition hover:bg-white"
              >
                SIGN IN TO SYNC
              </a>
            </div>
          )}
        </Section>

        {/* API Keys */}
        <Section title="API Keys" accent="#00D4FF">
          <p className="mb-3 text-xs text-[#64748B]">
            Bring your own Anthropic key to enable AI summaries on feeds. Stored locally on this
            device only.
          </p>

          {savedKey && (
            <div className="mb-3 flex items-center justify-between rounded border border-[#22C55E]/40 bg-[#22C55E]/10 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
                <span className="font-mono text-[11px] text-[#E2E8F0]">
                  Active: …{savedKey.slice(-6)}
                </span>
              </div>
              <button
                onClick={clearKey}
                className="rounded border border-[#0D2235] px-2 py-0.5 text-[10px] font-bold text-[#64748B] hover:text-[#FF2D2D]"
              >
                CLEAR
              </button>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-…"
                className="w-full rounded border border-[#0D2235] bg-black/60 px-3 py-2 pr-16 font-mono text-xs text-[#E2E8F0] placeholder-[#334155] outline-none focus:border-[#00D4FF]"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-0.5 text-[10px] font-bold text-[#64748B] hover:text-[#00D4FF]"
              >
                {showKey ? 'HIDE' : 'SHOW'}
              </button>
            </div>
            <button
              onClick={saveKey}
              disabled={!apiKey.trim()}
              className="rounded bg-[#00D4FF] px-4 py-2 text-xs font-black tracking-widest text-[#020D14] transition hover:bg-white disabled:opacity-30"
            >
              {keySaved ? 'SAVED ✓' : 'SAVE KEY'}
            </button>
          </div>
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-[10px] text-[#64748B] hover:text-[#00D4FF]"
          >
            Get an Anthropic API key →
          </a>
        </Section>

        {/* Notifications */}
        <Section title="Notifications" accent="#F59E0B">
          <button
            onClick={requestNotify}
            className="mb-3 rounded border border-[#F59E0B] bg-[#F59E0B]/10 px-3 py-2 text-[10px] font-black tracking-widest text-[#F59E0B] transition hover:bg-[#F59E0B]/20"
          >
            {notifyPerm === 'granted'
              ? '● BROWSER PUSH ENABLED'
              : notifyPerm === 'denied'
              ? '✕ PERMISSION BLOCKED'
              : 'ENABLE BROWSER PUSH'}
          </button>

          <div className="space-y-2">
            <Toggle label="Major Incidents" checked={prefs.major} onChange={() => togglePref('major')} />
            <Toggle label="Listener Spikes" checked={prefs.spikes} onChange={() => togglePref('spikes')} />
            <Toggle
              label="Watchlist Activity"
              checked={prefs.watchlist}
              onChange={() => togglePref('watchlist')}
            />
          </div>
        </Section>

        {/* Account */}
        <Section title="Account" accent="#A855F7">
          {subLoading ? (
            <div className="text-xs text-[#64748B]">Loading subscription…</div>
          ) : sub?.active ? (
            <div className="mb-3 rounded border border-[#22C55E]/40 bg-[#22C55E]/10 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
                <span className="text-xs font-bold text-[#E2E8F0]">
                  {sub.status === 'trialing' ? 'Trial active' : 'Subscription active'}
                </span>
              </div>
              {sub.currentPeriodEnd && (
                <div className="mt-1 font-mono text-[10px] text-[#64748B]">
                  {sub.cancelAtPeriodEnd ? 'Ends' : 'Renews'} {new Date(sub.currentPeriodEnd * 1000).toLocaleDateString()}
                </div>
              )}
            </div>
          ) : (
            <div className="mb-3 rounded border border-[#FF2D2D]/40 bg-[#FF2D2D]/10 px-3 py-2 text-xs text-[#E2E8F0]">
              Subscription inactive {sub?.status ? `(${sub.status})` : ''}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href="/api/spy/portal-session"
              className="flex-1 rounded border border-[#A855F7] bg-[#A855F7]/10 px-3 py-2 text-center text-[10px] font-black tracking-widest text-[#A855F7] transition hover:bg-[#A855F7]/20"
            >
              MANAGE SUBSCRIPTION
            </a>
            <button
              onClick={signOut}
              className="flex-1 rounded border border-[#0D2235] bg-black/40 px-3 py-2 text-[10px] font-black tracking-widest text-[#64748B] transition hover:border-[#FF2D2D] hover:text-[#FF2D2D]"
            >
              SIGN OUT
            </button>
          </div>
        </Section>

        {/* About */}
        <Section title="About" accent="#64748B">
          <div className="space-y-2 font-mono text-[11px] text-[#64748B]">
            <div>
              <span className="text-[#334155]">Version</span> · Hyve Spy Web 1.0.0
            </div>
            <div className="flex flex-wrap gap-3 text-[10px]">
              <Link href="/spy" className="hover:text-[#00D4FF]">
                LANDING
              </Link>
              <Link href="/terms" className="hover:text-[#00D4FF]">
                TERMS
              </Link>
              <Link href="/privacy" className="hover:text-[#00D4FF]">
                PRIVACY
              </Link>
            </div>
          </div>
        </Section>
      </div>
    </main>
  );
}

function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#0D2235] bg-black/40 p-4">
      <div
        className="mb-3 font-mono text-[10px] uppercase tracking-[0.4em]"
        style={{ color: accent }}
      >
        {title}
      </div>
      {children}
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      className="flex w-full items-center justify-between rounded border border-[#0D2235] bg-black/40 px-3 py-2 text-left text-xs text-[#E2E8F0] transition hover:border-[#00D4FF]/40"
    >
      <span>{label}</span>
      <span
        className="relative h-5 w-9 rounded-full transition"
        style={{ background: checked ? '#00D4FF' : '#0D2235' }}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition"
          style={{ left: checked ? '18px' : '2px' }}
        />
      </span>
    </button>
  );
}
