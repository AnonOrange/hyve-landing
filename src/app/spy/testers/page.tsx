import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Hyve Spy — Tester Build',
  description: 'Private full-unlocked Hyve Spy build for beta testers.',
  robots: { index: false, follow: false },
};

const APK_URL = '/spy/downloads/hyve-spy-tester.apk';
const APK_VERSION = 'beta-1.0.3';
const APK_SHA256 = '18cecd272e8a4654f5112a372001db7b75a3143f831447eeac7ef9c94fa13c0c';
const APK_SIZE = '28 MB';

export default function TestersPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020D14] font-sans text-[#E2E8F0]">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,212,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.06) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="text-sm font-black tracking-[0.3em] text-[#64748B]">HYVE SPY · TESTER BUILD</div>
        <Link href="/spy" className="text-sm text-[#64748B] hover:text-[#00D4FF] transition">← back to /spy</Link>
      </header>

      <section className="relative z-10 mx-auto max-w-3xl px-6 py-16">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#FF2D2D] bg-[#FF2D2D]/10 px-3 py-1 text-xs font-bold tracking-widest text-[#FF2D2D]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#FF2D2D]" />
          INVITE-ONLY BUILD · DO NOT SHARE PUBLICLY
        </div>

        <h1 className="text-5xl font-black leading-[0.95] tracking-tight md:text-6xl">
          <span className="text-[#E2E8F0]">Tester </span>
          <span
            style={{
              background: 'linear-gradient(110deg,#00D4FF 0%,#A855F7 35%,#FF2D2D 65%,#F59E0B 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
            }}
          >
            unlocked build.
          </span>
        </h1>
        <p className="mt-4 max-w-xl text-[#64748B]">
          Full Hyve Spy with every feature enabled — no Stripe required. Sideload onto any modern Android phone.
        </p>

        {/* Download */}
        <div className="mt-12 rounded-2xl border-2 border-[#00D4FF]/40 bg-gradient-to-br from-[#00D4FF]/5 to-transparent p-8">
          <div className="mb-1 font-mono text-xs uppercase tracking-widest text-[#00D4FF]">// download</div>
          <div className="mt-2 text-2xl font-bold">Hyve Spy Premium · {APK_VERSION}</div>
          <div className="mt-1 font-mono text-xs text-[#64748B]">{APK_SIZE} · Android 8.0+ (Oreo / API 26)</div>

          <a
            href={APK_URL}
            download
            className="mt-8 block rounded bg-[#00D4FF] py-4 text-center text-sm font-black tracking-widest text-[#020D14] transition hover:bg-white"
            style={{ boxShadow: '0 0 60px -10px rgba(0,212,255,0.4),0 0 140px -40px rgba(0,212,255,0.6)' }}
          >
            DOWNLOAD APK ({APK_SIZE})
          </a>

          <details className="mt-6 text-sm text-[#64748B]">
            <summary className="cursor-pointer font-mono text-xs tracking-widest text-[#00D4FF]">SHA-256 verification</summary>
            <div className="mt-3 break-all rounded bg-black/40 p-3 font-mono text-[10px]">
              {APK_SHA256}
            </div>
            <div className="mt-2 text-xs">
              On Linux/Mac: <code className="font-mono text-[#E2E8F0]">shasum -a 256 hyve-spy-tester.apk</code>
              <br />
              On Windows PowerShell: <code className="font-mono text-[#E2E8F0]">Get-FileHash hyve-spy-tester.apk -Algorithm SHA256</code>
            </div>
          </details>
        </div>

        {/* Install steps */}
        <div className="mt-12">
          <div className="font-mono text-xs uppercase tracking-widest text-[#00D4FF]">// install</div>
          <h2 className="mt-2 text-3xl font-black">Install in 4 steps</h2>

          <ol className="mt-8 space-y-6">
            {[
              {
                title: 'Allow installs from unknown sources',
                body:
                  "Settings → Apps → Special access → Install unknown apps → enable for whichever browser you'll download from (Chrome, Firefox, Samsung Internet).",
              },
              {
                title: 'Tap the download button above',
                body:
                  "Hit DOWNLOAD APK on your Android phone (not laptop) and the file lands in your Downloads folder.",
              },
              {
                title: 'Open the APK',
                body:
                  "From the download notification or Downloads folder, tap hyve-spy-tester.apk → Install. Android may warn about a beta source — accept and continue.",
              },
              {
                title: 'Launch Hyve Spy',
                body:
                  "Open the app from your home screen. Grant location + notification permissions on first launch. The map loads immediately — tap any pin to hear scanner audio, tap any green dot to see a live camera.",
              },
            ].map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#00D4FF]/40 bg-[#00D4FF]/10 font-mono text-sm font-bold text-[#00D4FF]">
                  {i + 1}
                </div>
                <div>
                  <div className="text-lg font-bold text-[#E2E8F0]">{s.title}</div>
                  <div className="mt-1 text-sm text-[#64748B]">{s.body}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* What's inside */}
        <div className="mt-16 rounded-2xl border border-[#0D2235] bg-black/30 p-8">
          <div className="mb-4 font-mono text-xs uppercase tracking-widest text-[#00D4FF]">// what you're testing</div>
          <ul className="grid gap-3 md:grid-cols-2">
            {[
              '4,300+ live US scanner feeds (police / fire / EMS / aviation / marine)',
              '26,000+ live cameras (state DOTs, NYC TMC, USGS volcanoes, EarthCam)',
              'Real-time incident detection (Whisper STT + listener-spike + transmission burst)',
              'FOIA fillable-PDF generator',
              'Custom keyword alerts with quiet hours',
              'Push notifications for nearby incidents',
              'Live in-app camera viewer (HLS / YouTube / WebView / auto-refresh JPEG)',
              'Search & filter across feeds and cities',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm">
                <span className="mt-1 text-[#00D4FF]">▸</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Feedback */}
        <div className="mt-12 rounded-2xl border border-[#FF2D2D]/30 bg-[#FF2D2D]/5 p-6">
          <div className="font-mono text-xs uppercase tracking-widest text-[#FF2D2D]">// reporting bugs</div>
          <p className="mt-2 text-sm text-[#E2E8F0]">
            Found a crash, dead camera, or weird scanner audio behavior? Reply to the invite email or message the
            tester chat with: <span className="font-mono text-[#00D4FF]">device model</span>,{' '}
            <span className="font-mono text-[#00D4FF]">Android version</span>, screen of what you were doing, and a
            screenshot if relevant.
          </p>
        </div>

        <div className="mt-16 text-center font-mono text-xs uppercase tracking-[0.4em] text-[#334155]">
          Build {APK_VERSION} · Compiled from main · debug-signed (will not auto-update)
        </div>
      </section>
    </main>
  );
}
