// /caseline/download — installer download page. Surfaces the Win/Mac/Linux
// installer URLs from env vars (so they can be swapped without code edits
// once the signed installers are uploaded to Firebase Storage / GitHub
// Releases / wherever).

import Image from 'next/image'
import Link from 'next/link'

export const metadata = {
  title: 'Download Hyve CaseLine',
  description:
    'Download the Hyve CaseLine desktop app for Windows, macOS, or Linux. Native installer · 64-bit · runs entirely on your hardware.',
}

// Read installer URLs from env at request time, so swapping URLs in Vercel
// settings takes effect without a rebuild.
export const dynamic = 'force-dynamic'

const ACCENT = '#00B4D8'

type Platform = {
  os: 'Windows' | 'macOS' | 'Linux'
  label: string
  extension: string
  size?: string
  url: string | null
  icon: React.ReactNode
}

// Pulled at render time so a redeploy is all it takes to swap installer URLs.
function getPlatforms(): Platform[] {
  return [
    {
      os: 'Windows',
      label: '.msi installer · Windows 10 / 11 · 64-bit',
      extension: 'msi',
      size: '~95 MB',
      url: process.env.NEXT_PUBLIC_CASELINE_WIN_URL || null,
      icon: <WindowsIcon />,
    },
    {
      os: 'macOS',
      label: '.dmg disk image · macOS 12 Monterey or newer · Universal',
      extension: 'dmg',
      size: '~110 MB',
      url: process.env.NEXT_PUBLIC_CASELINE_MAC_URL || null,
      icon: <AppleIcon />,
    },
    {
      os: 'Linux',
      label: '.AppImage · most distros · 64-bit · x86_64',
      extension: 'AppImage',
      size: '~105 MB',
      url: process.env.NEXT_PUBLIC_CASELINE_LINUX_URL || null,
      icon: <LinuxIcon />,
    },
  ]
}

export default function DownloadPage() {
  const platforms = getPlatforms()
  const serverUrl = process.env.NEXT_PUBLIC_CASELINE_SERVER_URL || null

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08070a] font-sans text-[#ede8d8]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 100' fill='none' stroke='%23C8A227' stroke-width='1'><polygon points='28,2 54,16 54,46 28,60 2,46 2,16'/><polygon points='28,42 54,56 54,86 28,100 2,86 2,56'/></svg>\")",
          backgroundSize: '56px 100px',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-25"
        style={{ background: 'radial-gradient(ellipse at top, rgba(0,180,216,0.30), transparent 70%)' }}
      />

      <header className="relative z-30 mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-6">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/hyve-logo/hyve-messenger-emblem.png" alt="Hyve" width={64} height={64} className="h-9 w-9" priority />
          <span
            className="text-sm font-black tracking-[0.3em]"
            style={{
              background: 'linear-gradient(135deg, #C8A227 0%, #E8C456 50%, #C8A227 100%)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text',
              WebkitTextFillColor: 'transparent', color: 'transparent',
            }}
          >
            HYVE / CASELINE
          </span>
        </Link>
        <nav className="hidden gap-5 text-xs font-bold tracking-[0.2em] text-[#9e8a55] md:flex">
          <Link href="/caseline" className="transition hover:text-[#00B4D8]">← CASELINE</Link>
          <Link href="/caseline#features" className="transition hover:text-[#00B4D8]">FEATURES</Link>
          <Link href="/caseline/buy" className="transition hover:text-[#00B4D8]">PRICING</Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto max-w-4xl px-6 py-12 text-center md:py-16">
        <Image
          src="/hyve-logo/hyve-caseline-emblem.png"
          alt="Hyve CaseLine"
          width={220} height={220}
          className="mx-auto h-24 w-auto md:h-32"
          style={{ filter: `drop-shadow(0 0 22px ${ACCENT}aa)` }}
          priority
        />
        <div className="mt-6 font-mono text-[11px] tracking-[0.4em]" style={{ color: ACCENT }}>
          DOWNLOAD · NATIVE DESKTOP APP
        </div>
        <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">
          Pick your platform.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#9e8a55] md:text-base">
          CaseLine runs entirely on your hardware. No web account required.
          Activate with the license key from your purchase email.
        </p>
      </section>

      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-16">
        <div className="grid gap-5 md:grid-cols-3">
          {platforms.map((p) => (
            <PlatformCard key={p.os} platform={p} />
          ))}
        </div>

        <p className="mt-8 text-center text-[10px] tracking-wider text-[#6b5e3a]">
          SHA-256 checksums published with every release · code-signed for Win / macOS
        </p>
      </section>

      {/* CaseLine Server — separate optional download for firms running an on-prem hub */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-16">
        <div className="rounded-xl border-2 p-7" style={{ borderColor: '#2a2135', background: 'rgba(0,0,0,0.4)' }}>
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div className="flex-1">
              <div className="font-mono text-[10px] tracking-[0.3em]" style={{ color: ACCENT }}>OPTIONAL · ON-PREMISES</div>
              <h2 className="mt-2 text-xl font-black text-[#ede8d8] md:text-2xl">CaseLine Server</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#9e8a55]">
                Install on one central computer in your office. Workstations connect to it for case storage and centralized
                LLM inference via Ollama. Includes the audit log for ABA Model Rule 1.6 compliance.
              </p>
              <div className="mt-3 font-mono text-[10px] tracking-wider text-[#6b5e3a]">
                Node.js 18+ · SQLite · WebSocket · runs as a Windows service or systemd unit
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {serverUrl ? (
                <a
                  href={serverUrl}
                  className="rounded px-6 py-3 text-center font-mono text-xs font-bold tracking-[0.3em] text-black transition hover:scale-[1.02]"
                  style={{ background: ACCENT, boxShadow: `0 0 16px ${ACCENT}77` }}
                >
                  DOWNLOAD SERVER →
                </a>
              ) : (
                <a
                  href="mailto:majixx@vibesoftwaresolutions.com?subject=CaseLine%20Server%20-%20request%20build"
                  className="rounded border-2 px-6 py-3 text-center font-mono text-xs font-bold tracking-[0.3em] transition hover:bg-white/5"
                  style={{ borderColor: ACCENT, color: ACCENT }}
                >
                  REQUEST BUILD →
                </a>
              )}
              <Link
                href="/caseline/server-docs"
                className="rounded border px-6 py-3 text-center font-mono text-[10px] font-bold tracking-[0.3em] text-[#9e8a55] transition hover:text-[#ede8d8]"
                style={{ borderColor: '#2a2135' }}
              >
                SETUP DOCS →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Activation walk-through */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-20">
        <div className="mb-8 text-center">
          <div className="font-mono text-[10px] tracking-[0.4em]" style={{ color: ACCENT }}>AFTER INSTALL</div>
          <h2 className="mt-2 text-2xl font-black md:text-3xl">Activate in 3 steps.</h2>
        </div>
        <ol className="mx-auto max-w-2xl space-y-4">
          {[
            { n: '1', t: 'Open the app', b: 'Launch Hyve CaseLine from your applications menu.' },
            { n: '2', t: 'Open license settings', b: <>Click <strong className="text-[#ede8d8]">WORKSPACE → SETTINGS → LICENSE &amp; SEATS</strong> in the top toolbar.</> },
            { n: '3', t: 'Paste your key', b: <>Drop your <strong className="text-[#ede8d8]">HYVE-XXXX-XXXX-XXXX</strong> key from the purchase email and click <strong className="text-[#ede8d8]">SAVE KEY</strong>. You&rsquo;re live.</> },
          ].map((s) => (
            <li key={s.n} className="rounded-xl border-2 p-5" style={{ borderColor: '#2a2135', background: 'rgba(0,0,0,0.4)' }}>
              <div className="flex items-start gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-sm font-black text-black"
                     style={{ background: ACCENT }}>
                  {s.n}
                </div>
                <div>
                  <h3 className="text-base font-black text-[#ede8d8]">{s.t}</h3>
                  <p className="mt-1 text-sm text-[#9e8a55]">{s.b}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-10 text-center">
          <p className="text-sm text-[#9e8a55]">
            No license key yet?{' '}
            <Link href="/caseline/buy" className="font-bold underline-offset-4 hover:underline" style={{ color: ACCENT }}>
              Grab one at /caseline/buy
            </Link>
          </p>
        </div>
      </section>

      <footer className="relative z-10 mt-10 border-t border-[#2a2135] bg-black/40">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6 flex flex-col items-center gap-2 border-b border-[#2a2135] pb-6 text-center">
            <div className="font-mono text-[9px] tracking-[0.4em] text-[#6b5e3a]">CREATED BY</div>
            <p className="text-sm font-bold tracking-[0.15em] text-[#ede8d8]">ANTHONY S. OWENS</p>
            <p className="text-[11px] text-[#9e8a55]">
              c/o{' '}
              <a href="https://www.vibesoftwaresolutions.com" target="_blank" rel="noopener noreferrer"
                 className="text-[#E8C456] underline-offset-4 hover:underline">
                Vibe Software Solutions
              </a>
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between">
            <span className="font-mono text-[10px] tracking-[0.3em] text-[#9e8a55]">© 2026 HYVE CASELINE</span>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[10px] tracking-[0.2em] text-[#6b5e3a]">
              <Link href="/caseline" className="hover:text-[#00B4D8]">CASELINE</Link>
              <Link href="/caseline/buy" className="hover:text-[#00B4D8]">BUY</Link>
              <Link href="/privacy" className="hover:text-[#E8C456]">PRIVACY</Link>
              <a href="mailto:support@hyveapp.co" className="hover:text-[#E8C456]">SUPPORT</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}

function PlatformCard({ platform }: { platform: Platform }) {
  const { os, label, extension, size, url, icon } = platform
  const ready = Boolean(url)
  return (
    <div
      className="flex flex-col rounded-xl border-2 p-6 transition hover:scale-[1.01]"
      style={ ready
        ? { borderColor: ACCENT, background: `${ACCENT}10`, boxShadow: `0 0 18px ${ACCENT}22` }
        : { borderColor: '#2a2135', background: 'rgba(0,0,0,0.35)' }
      }
    >
      <div className="mb-4 flex h-12 items-center" style={{ color: ready ? ACCENT : '#9e8a55' }}>{icon}</div>
      <h3 className="text-xl font-black text-[#ede8d8]">{os}</h3>
      <p className="mt-2 flex-1 text-xs text-[#9e8a55]">{label}</p>
      {size && (
        <div className="mt-3 font-mono text-[9px] tracking-wider text-[#6b5e3a]">SIZE · {size}</div>
      )}
      {ready ? (
        <a
          href={url!}
          download
          className="mt-5 rounded px-5 py-3 text-center font-mono text-xs font-bold tracking-[0.25em] text-black transition hover:scale-[1.02]"
          style={{ background: ACCENT, boxShadow: `0 0 16px ${ACCENT}77` }}
        >
          DOWNLOAD .{extension.toUpperCase()}
        </a>
      ) : (
        <button
          disabled
          className="mt-5 cursor-not-allowed rounded border-2 px-5 py-3 text-center font-mono text-xs font-bold tracking-[0.25em] opacity-60"
          style={{ borderColor: '#2a2135', color: '#9e8a55' }}
        >
          COMING SOON
        </button>
      )}
    </div>
  )
}

function WindowsIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="h-10 w-10"><path d="M3 5.5L10.5 4.5V11.5L3 11.5V5.5ZM11.5 4.4L21 3V11.5L11.5 11.5V4.4ZM3 12.5L10.5 12.5V19.5L3 18.5V12.5ZM11.5 12.5L21 12.5V21L11.5 19.6V12.5Z"/></svg>
}
function AppleIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="h-10 w-10"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
}
function LinuxIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="h-10 w-10"><path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.077 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.475.174.33.535.474.945.595.82.179 1.925.144 2.788.595.926.482 1.875.685 2.646.55.605-.107 1.099-.464 1.359-.998.728-.014 1.527-.34 2.791-.402.86-.057 1.93.292 3.16.183.038.131.067.197.135.319l.001.002c.502.769 1.456 1.108 2.327.832.871-.276 1.612-.961 1.984-1.55l.022-.03.022-.024c.31-.379.567-.66.85-.847.292-.18.508-.276.665-.418.078-.071.123-.16.124-.296-.001-.052-.022-.075-.054-.122-.041-.062-.085-.063-.04-.083-.108-.082-.214-.142-.301-.224a4.07 4.07 0 01-.293-.273l-.001-.001c-.097-.117-.215-.224-.314-.336-.142-.16-.31-.341-.484-.567l-.005-.007c-.106-.16-.243-.371-.376-.602-.075-.117-.149-.252-.222-.385a.434.434 0 00-.04-.061c.092-.18.165-.379.225-.59.07-.262.13-.531.169-.787l.001-.005c.078-.55.117-1.038.117-1.453 0-1.024-.226-1.804-.49-2.39-.18-.404-.379-.71-.557-.917a4.072 4.072 0 00-.27-.296c.062-.116.122-.21.166-.301.097-.198.196-.396.293-.595.043-.086.083-.165.123-.246.04-.082.08-.165.116-.246.04-.083.08-.166.106-.243.04-.116.075-.225.097-.327.105-.448.165-.857.205-1.214.04-.357.06-.667.06-.927.005-.232-.013-.43-.04-.6a4.143 4.143 0 00-.054-.252v-.001a3.927 3.927 0 00-.057-.196l-.001-.003a3.748 3.748 0 00-.064-.165 4.155 4.155 0 00-.117-.226 4.005 4.005 0 00-.143-.225 4.13 4.13 0 00-.165-.213c-.115-.13-.244-.24-.378-.34a4.36 4.36 0 00-.219-.142 3.967 3.967 0 00-.231-.124 3.957 3.957 0 00-.241-.105c-.182-.073-.376-.13-.575-.176-.05-.012-.102-.022-.154-.032l-.018-.003c-.105-.018-.211-.033-.319-.046l-.04-.005c-.103-.012-.207-.022-.31-.029l-.05-.003c-.146-.01-.292-.014-.437-.014h-.025c-.225 0-.45.014-.671.044a4.69 4.69 0 00-.658.143A4.21 4.21 0 0012.504 0z"/></svg>
}
