import Image from 'next/image';
import type { Metadata } from 'next';
import OpenWebAppButton from './OpenWebAppButton';

export const metadata: Metadata = {
  title: 'Hyve Spy — Tactical scanner + surveillance + crime intelligence',
  description:
    'Live police/fire/EMS scanner audio. 49,000+ US cameras + 24,000+ worldwide. 164,000+ surveillance markers (Flock ALPR, ShotSpotter, drones, face rec). 97,000+ sex offender pins. 31,000+ live crime incidents. AI summaries with any LLM key. Push alerts. $5.99/mo.',
  openGraph: {
    title: 'Hyve Spy — Tactical scanner + surveillance + crime intelligence',
    description:
      '6,500+ scanner feeds · 73,000+ cameras · 164,000+ surveillance markers · 97,000+ offender pins · 31,000+ live crime reports. $5.99/mo, 72h free.',
    siteName: 'Hyve Spy',
    images: ['/spy-logo/hyve-spy-logo.png'],
  },
};

const STATS = [
  { value: '6,581', label: 'Scanner feeds' },
  { value: '73,898', label: 'Live cameras' },
  { value: '164,733', label: 'Surveillance markers' },
  { value: '97,061', label: 'Offender pins' },
  { value: '48,242', label: 'Live crime reports' },
  { value: '13', label: 'Cities w/ daily crime' },
];

const FEATURES = [
  {
    title: 'Every police, fire & EMS scanner in America',
    body:
      '6,500+ verified live audio feeds — direct Broadcastify streams, OpenMHz trunked systems, aviation, marine, weather. Tap any pin, hear the dispatch live. Skip-ahead controls so you go straight to the live edge instead of catching up on backlog. Auto-summary panel transcribes recent activity in plain English.',
    accent: '#00D4FF',
    tag: 'AUDIO',
  },
  {
    title: '49,488 US live cameras + 24,410 worldwide',
    body:
      "Every state DOT traffic cam, NYC TMC's 954 city cams, USGS volcano monitors, NPS parks, beach cams, marina cams, EarthCam landmarks, Times Square, Vegas Strip, plus 24,000+ Windy webcams across 199 countries. Pro tier unlocks the global view. Snapshots refresh every 2 seconds.",
    accent: '#22C55E',
    tag: 'VIDEO',
  },
  {
    title: '164,733 surveillance markers — Pro Intel tab',
    body:
      'See where Flock Safety license-plate readers (99,683), ShotSpotter mics (243), police drones (1,804), face recognition deployments (975), Stingrays (83), fusion centers, real-time crime centers, body-worn cam programs, and 26,000+ public CCTV cameras live. Sourced from EFF Atlas of Surveillance, DeFlock community DB, and OpenStreetMap. 16 toggleable layers grouped by category.',
    accent: '#F59E0B',
    tag: 'SURVEILLANCE',
  },
  {
    title: '97,061 sex offender pins — Pro Intel tab',
    body:
      "Every registered sex offender from public state and county registries — including all 100 NC counties from the official NC SBI bulk dump (17,744 records) plus aggregated county ArcGIS feeds nationwide. Click any pin: full registry detail (DOB, race, classification, charge, conviction date) plus deep-link buttons that prefill the offender's name on the official state registry where their photo lives.",
    accent: '#A855F7',
    tag: 'OFFENDERS',
  },
  {
    title: '48,242 live crime reports — 13 cities, refreshed daily',
    body:
      'Real incident pins (not heatmaps) sourced daily at 9am UTC from city open-data portals: Chicago, NYC, LA, San Francisco, Seattle, DC, Buffalo, Dallas, Philadelphia, Raleigh, Tucson, Montgomery County MD, Gainesville FL. 12 category icons (🔫 shooting, 💀 homicide, 👊 assault, 💰 robbery, 🏚 burglary, 🚗 vehicle theft, 🛒 theft, 💊 drug, 🎨 vandalism, 🔥 arson, 💳 fraud, ⚠ sex offense). Filter chips per category. Click pin → offense, time-ago, source.',
    accent: '#EF4444',
    tag: 'CRIME',
  },
  {
    title: 'Live alert pipeline — 3 detection signals',
    body:
      'Three independent signals all fire into one push pipeline: (1) Whisper STT keyword detection running continuously on Railway transcribes scanner audio for words like "shots fired", "structure fire", "officer down". (2) Listener-spike — when a feed\'s listener count jumps 5× its baseline, an incident is in progress. (3) Transmission-burst — >8 calls in 30s on OpenMHz feeds. Opt in once in Settings, set your radius (1–50 mi), grant location + notification permission. Push hits within seconds.',
    accent: '#FF2D2D',
    tag: 'ALERTS',
  },
  {
    title: 'Multi-provider AI summaries (BYOK)',
    body:
      'Bring your own API key from any provider — Anthropic Claude, OpenAI GPT, Google Gemini, OpenRouter, Groq, or Ollama (self-hosted). Auto-detects provider from key prefix. Optional model override. Summarizes recent radio traffic in 2-3 sentences for the public-safety listener. Keys stored locally on your device only.',
    accent: '#EC4899',
    tag: 'AI',
  },
  {
    title: 'FOIA request generator — every feed',
    body:
      "Tap any incident, download a fillable PDF pre-formatted with the agency's records office, the exact incident timestamp, talkgroup, and 8 enumerated request items. Now works for ANY scanner feed — not just the ones with formal FOIA contacts. Generic [Agency] Records Office fallback uses agency name + state when no formal contact is configured.",
    accent: '#9333EA',
    tag: 'RECORDS',
  },
  {
    title: 'Cross-device account + cloud sync',
    body:
      'Magic-link or password sign-in. Your watchlist, FOIA log, and chat handle sync between web (any browser), Android app, and PWA on iOS. Sign in once on web, the Android hybrid app inherits your session via cookie injection. No tracking — Ghost Mode is on by default.',
    accent: '#E2E8F0',
    tag: 'ACCOUNT',
  },
  {
    title: 'Tactical dark map + dedicated tabs',
    body:
      'Bottom nav: Map (live operations) · Feeds (audio list) · Cams (camera grid) · Intel (Pro: surveillance / offenders / crime) · World (Pro: global cams) · Watch · Settings. Each tab loads only its own data — no monolithic loads, no slow tabs. Custom dark CARTO tiles. Marker clustering keeps 100k+ pin layers responsive.',
    accent: '#06B6D4',
    tag: 'NAVIGATION',
  },
  {
    title: 'Per-channel community chat',
    body:
      'Listeners on the same scanner feed can chat in real time. Collapsible side panel inside every feed detail. Sign in once, your handle and history sync across all your devices.',
    accent: '#F472B6',
    tag: 'CHAT',
  },
  {
    title: 'Native Android app + PWA',
    body:
      'Hybrid Android APK with native scanner audio playback (background, lock-screen controls, no autoplay restrictions) and WebView for everything else (auto-inherits your sign-in via cookie sharing). Installable PWA on iOS. Tester APK at hyveapp.co/spy/downloads.',
    accent: '#10B981',
    tag: 'APPS',
  },
  {
    title: 'Cameras refresh + repopulate every 4 hours',
    body:
      "Every 4 hours, an automated validator HEAD-requests every camera URL we know about, marks dead ones inactive, and pulls fresh inventory from upstream sources (state DOTs, NPS parks, USGS volcanoes, Windy, EarthCam, port authorities). New cams added by upstream providers appear in the next sweep; rotted URLs get culled within a day. The site you load tomorrow has different cameras than today — always live, always trimmed.",
    accent: '#22C55E',
    tag: 'FRESH',
  },
  {
    title: 'Tactical radar loading — never silent',
    body:
      "Every page transition shows a tactical radar sweep: concentric rings with subtle pulses, rotating arm with a fading trail, blip-spawns simulating target detection, and an indeterminate progress bar. Color matches each tab's accent. So you always know the app is working — even when pulling 100k+ markers across the wire.",
    accent: '#06B6D4',
    tag: 'UX',
  },
  {
    title: 'Built across three runtimes for maximum uptime',
    body:
      "Same hyve-api codebase deployed three ways: Vercel for fast edge-cached HTTP reads (lazy-loaded layers + CDN cache), Railway for the always-on Whisper STT worker that needs continuous CPU, and GitHub Actions for free 5-minute alert polls. Every signal-detection layer runs independently — one platform's outage doesn't kill the others.",
    accent: '#8B5CF6',
    tag: 'INFRA',
  },
];

const SHOTS = [
  { src: '/spy-screenshots/1-map.png', alt: 'Map with scanner pins and camera dots', caption: 'Tactical map — 6,500 scanner pins + 49K camera dots' },
  { src: '/spy-screenshots/2-feeds.png', alt: 'Feeds list', caption: '6,500+ feeds, sorted by live listener count' },
  { src: '/spy-screenshots/3-incident.png', alt: 'Incident detail with audio + camera', caption: 'Tap a feed → audio + AI summary + live cameras within 30 miles' },
  { src: '/spy-screenshots/4-foia.png', alt: 'FOIA download + cameras', caption: 'Live DOT cameras, auto-refreshing every 2 seconds' },
];

export default function SpyPage() {
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

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="text-sm font-black tracking-[0.3em] text-[#64748B]">HYVE SPY</div>
        <nav className="hidden gap-8 text-sm font-medium text-[#64748B] md:flex">
          <a href="#features" className="transition hover:text-[#00D4FF]">Features</a>
          <a href="#screenshots" className="transition hover:text-[#00D4FF]">Screenshots</a>
          <a href="#pricing" className="transition hover:text-[#00D4FF]">Pricing</a>
        </nav>
        <div className="flex items-center gap-3">
          <OpenWebAppButton />
          <a
            href="/spy/login"
            className="text-xs font-bold tracking-widest text-[#64748B] transition hover:text-[#E2E8F0]"
          >
            SIGN IN
          </a>
          <a href="#pricing" className="rounded border border-[#00D4FF] bg-[#00D4FF]/10 px-4 py-2 text-xs font-bold tracking-widest text-[#00D4FF] transition hover:bg-[#00D4FF]/20">
            START FREE TRIAL
          </a>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-16 pt-8 md:pt-12">
        <div className="mb-12 flex justify-center md:mb-16">
          <div className="relative w-full max-w-3xl">
            <div className="absolute -inset-12 bg-gradient-to-r from-[#F59E0B]/20 via-[#FF2D2D]/10 to-[#F59E0B]/20 blur-3xl" />
            <Image src="/spy-logo/hyve-spy-logo.png" alt="Hyve Spy" width={1536} height={1024} className="relative h-auto w-full" priority />
          </div>
        </div>

        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#0D2235] bg-black/40 px-3 py-1 text-xs font-bold tracking-widest text-[#00D4FF]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#FF2D2D]" />
              LIVE NATIONWIDE COVERAGE
            </div>
            <h1 className="text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
              <span className="text-[#E2E8F0]">Hear what&apos;s </span>
              <span style={{ background: 'linear-gradient(110deg,#00D4FF 0%,#A855F7 35%,#FF2D2D 65%,#F59E0B 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }}>
                happening
              </span>
              <span className="text-[#E2E8F0]"> right now.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-[#64748B]">
              Real-time scanner audio · 73,000 live cameras · 164,000 surveillance markers · 97,000 sex offender pins · 48,000 live crime reports across 13 cities. Whisper-STT push alerts within X miles. AI summaries on any LLM key. One tap on a map.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <a href="#pricing" className="rounded bg-[#00D4FF] px-6 py-3 text-sm font-black tracking-widest text-[#020D14] transition hover:bg-white" style={{ boxShadow: '0 0 60px -10px rgba(0,212,255,0.4),0 0 140px -40px rgba(0,212,255,0.6)' }}>
                START 72-HOUR FREE TRIAL
              </a>
              <a
                href="/spy/login"
                className="rounded border border-[#00D4FF] bg-transparent px-6 py-3 text-sm font-black tracking-widest text-[#00D4FF] transition hover:bg-[#00D4FF]/10"
              >
                SIGN IN →
              </a>
              <span className="font-mono text-sm text-[#64748B]">$5.99/mo · cancel anytime</span>
            </div>
            <p className="mt-3 font-mono text-xs text-[#334155]">
              iOS-friendly · works in any browser · installable as a PWA
            </p>
            <div className="mt-12 grid grid-cols-2 gap-6 md:grid-cols-4">
              {STATS.map((s) => (
                <div key={s.label}>
                  <div className="font-mono text-2xl font-bold text-[#00D4FF]">{s.value}</div>
                  <div className="mt-1 text-xs uppercase tracking-widest text-[#334155]">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex justify-center md:justify-end">
            <div className="absolute -inset-8 rounded-[3rem] bg-[#00D4FF]/10 blur-3xl" />
            <div className="relative">
              <div className="rounded-[2.5rem] border border-[#0D2235] bg-black p-2 shadow-2xl">
                <div className="overflow-hidden rounded-[2rem] border border-[#0D2235]">
                  <Image src="/spy-screenshots/1-map.png" alt="Hyve Spy live map" width={540} height={1170} className="h-auto w-[280px] md:w-[320px]" priority />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Voicey "from the toilet" hook — captures the casual reality of what
          24,000+ worldwide cams + 49,000+ US cams unlock. Sets the tone before
          the technical feature grid. */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-2xl border border-[#22C55E]/40 bg-gradient-to-br from-[#22C55E]/5 to-transparent p-8 text-center">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.4em] text-[#22C55E]">// also a thing</div>
          <p className="mx-auto max-w-3xl text-xl font-bold leading-snug text-[#E2E8F0] md:text-2xl">
            Have you ever watched 3 zebras around a watering hole live, and then watched live bridge cameras
            on a cruise ship from the comfort of your toilet?
          </p>
          <p className="mt-4 text-sm font-bold tracking-widest text-[#22C55E]">
            WELL NOW YOU CAN.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-xs text-[#64748B]">
            73,000+ live cameras across 199 countries. African watering holes (Africam). Cruise-ship bridge cams.
            NPS national parks. NYC traffic. Times Square. Bourbon Street. Whatever you want, from wherever you are.
          </p>
        </div>
      </section>

      <section id="features" className="relative z-10 mx-auto max-w-7xl px-6 py-20">
        <div className="mb-16 text-center">
          <div className="font-mono text-xs uppercase tracking-[0.4em] text-[#00D4FF]">// capabilities</div>
          <h2 className="mt-4 text-4xl font-black md:text-5xl">Everything a serious listener needs</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="group relative rounded-lg border border-[#0D2235] bg-black/40 p-6 transition hover:border-[#00D4FF]/60">
              <div className="mb-4 inline-block rounded px-2 py-1 font-mono text-[10px] font-bold tracking-widest" style={{ background: `${f.accent}1A`, color: f.accent }}>
                {f.tag}
              </div>
              <h3 className="mb-3 text-xl font-bold text-[#E2E8F0]">{f.title}</h3>
              <p className="text-sm leading-relaxed text-[#64748B]">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="screenshots" className="relative z-10 mx-auto max-w-7xl px-6 py-20">
        <div className="mb-16 text-center">
          <div className="font-mono text-xs uppercase tracking-[0.4em] text-[#00D4FF]">// ground truth</div>
          <h2 className="mt-4 text-4xl font-black md:text-5xl">Built for the field</h2>
          <p className="mx-auto mt-4 max-w-2xl text-[#64748B]">
            No mockups. These are screenshots of the actual app running on a Galaxy S24 Ultra, pulling real data from real public-safety dispatch systems and DOT cameras right now.
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {SHOTS.map((shot) => (
            <div key={shot.src} className="group">
              <div className="relative overflow-hidden rounded-2xl border border-[#0D2235] bg-black p-1 transition group-hover:border-[#00D4FF]/60">
                <Image src={shot.src} alt={shot.alt} width={540} height={1170} className="h-auto w-full rounded-[1rem]" />
              </div>
              <p className="mt-4 text-sm text-[#64748B]">{shot.caption}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="relative z-10 mx-auto max-w-7xl px-6 py-20">
        <div className="mb-12 text-center">
          <div className="font-mono text-xs uppercase tracking-[0.4em] text-[#00D4FF]">// pricing</div>
          <h2 className="mt-4 text-4xl font-black md:text-5xl">Pick your tier. Cancel anytime.</h2>
          <p className="mt-3 text-[#64748B]">72-hour free trial on every plan.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="relative flex flex-col rounded-2xl border border-[#0D2235] bg-black/40 p-8">
            <div className="text-center">
              <div className="text-xs font-bold tracking-widest text-[#64748B]">BASIC · MONTHLY</div>
              <div className="mt-2 text-lg font-bold text-[#E2E8F0]">Hyve Spy Premium</div>
              <div className="my-6 flex items-baseline justify-center gap-2">
                <span className="font-mono text-5xl font-black text-[#E2E8F0]">$5.99</span>
                <span className="text-lg text-[#64748B]">/ mo</span>
              </div>
              <p className="text-xs text-[#64748B]">$71.88 / year if billed monthly</p>
            </div>
            <a href="/api/spy/checkout?plan=monthly&tier=basic" className="mt-8 block rounded border border-[#00D4FF] bg-[#00D4FF]/10 py-4 text-center text-sm font-black tracking-widest text-[#00D4FF] transition hover:bg-[#00D4FF]/20">
              START FREE TRIAL
            </a>
          </div>

          <div className="relative flex flex-col rounded-2xl border-2 border-[#00D4FF] bg-gradient-to-br from-[#00D4FF]/10 to-transparent p-8" style={{ boxShadow: '0 0 60px -10px rgba(0,212,255,0.4),0 0 140px -40px rgba(0,212,255,0.6)' }}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#00D4FF] bg-[#020D14] px-4 py-1 text-xs font-black tracking-widest text-[#00D4FF]">
              BASIC · BEST VALUE
            </div>
            <div className="text-center">
              <div className="text-xs font-bold tracking-widest text-[#00D4FF]">BASIC · ANNUAL</div>
              <div className="mt-2 text-lg font-bold text-[#E2E8F0]">Hyve Spy Premium</div>
              <div className="my-6 flex items-baseline justify-center gap-2">
                <span className="font-mono text-5xl font-black text-[#00D4FF]">$59.99</span>
                <span className="text-lg text-[#64748B]">/ yr</span>
              </div>
              <p className="text-xs text-[#22C55E]">≈ $5.00/mo · saves $11.89 vs monthly</p>
            </div>
            <a href="/api/spy/checkout?plan=annual&tier=basic" className="mt-8 block rounded bg-[#00D4FF] py-4 text-center text-sm font-black tracking-widest text-[#020D14] transition hover:bg-white">
              START FREE TRIAL
            </a>
          </div>

          <div className="relative flex flex-col rounded-2xl border-2 border-[#F59E0B] bg-gradient-to-br from-[#F59E0B]/10 to-transparent p-8" style={{ boxShadow: '0 0 60px -10px rgba(245,158,11,0.4),0 0 140px -40px rgba(245,158,11,0.6)' }}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#F59E0B] bg-[#020D14] px-4 py-1 text-xs font-black tracking-widest text-[#F59E0B]">
              PRO
            </div>
            <div className="text-center">
              <div className="text-xs font-bold tracking-widest text-[#F59E0B]">PRO · ANNUAL</div>
              <div className="mt-2 text-lg font-bold text-[#E2E8F0]">Hyve Spy Pro</div>
              <div className="my-6 flex items-baseline justify-center gap-2">
                <span className="font-mono text-5xl font-black text-[#F59E0B]">$149.99</span>
                <span className="text-lg text-[#64748B]">/ yr</span>
              </div>
              <p className="text-xs text-[#F59E0B]">≈ $12.50/mo · saves $29.89 vs monthly</p>
            </div>
            <ul className="mt-6 flex-1 space-y-2 text-left">
              {[
                'Everything in Basic, plus:',
                'AI incident summarizer',
                'Live transcription overlay',
                'Multi-feed concurrent listening',
                'Cross-reference with local news',
                'Longer push notification history',
                'Priority support',
              ].map((item, idx) => (
                <li key={item} className="flex items-start gap-2">
                  <span className={`mt-0.5 ${idx === 0 ? 'text-[#64748B]' : 'text-[#F59E0B]'}`}>{idx === 0 ? '+' : '★'}</span>
                  <span className={`text-xs ${idx === 0 ? 'text-[#64748B] italic' : 'text-[#E2E8F0]'}`}>{item}</span>
                </li>
              ))}
            </ul>
            <a href="/api/spy/checkout?plan=annual&tier=pro" className="mt-8 block rounded bg-[#F59E0B] py-4 text-center text-sm font-black tracking-widest text-[#020D14] transition hover:bg-[#FBBF24]">
              GO PRO · FREE TRIAL
            </a>
          </div>
        </div>

        <div className="mt-6 text-center">
          <a href="/api/spy/checkout?plan=monthly&tier=pro" className="text-xs font-mono text-[#64748B] underline-offset-4 hover:text-[#F59E0B] hover:underline">
            Prefer Pro monthly? $14.99/mo →
          </a>
        </div>

        <div className="mt-12 rounded-2xl border border-[#0D2235] bg-black/30 p-8">
          <div className="mb-4 text-center font-mono text-xs uppercase tracking-[0.4em] text-[#00D4FF]">
            all plans include
          </div>
          <p className="mb-6 text-center text-xs text-[#64748B]">
            Pro tier unlocks the <span className="text-[#22C55E]">Global view</span> (24,410 worldwide cams) +
            the <span className="text-[#F59E0B]">Intel suite</span> (164k surveillance · 97k offenders · 48k live crime reports).
          </p>
          <ul className="grid gap-3 md:grid-cols-2">
            {[
              'All 6,500+ live scanner feeds (police, fire, EMS, aviation, marine)',
              'All 49,488 US live cameras (DOT, USGS, EarthCam, NYC TMC, Windy)',
              'AI summaries on any LLM key (Anthropic, OpenAI, Gemini, Groq, Ollama)',
              'Cameras auto-refresh every 4 hours (dead URLs culled, new cams added)',
              'Push alerts for incidents within your radius (1-50 mi)',
              'Per-channel community chat (sign-in required)',
              'Real-time incident detection (Whisper STT + listener-spike)',
              'FOIA fillable-PDF generator (works on every feed)',
              'Cross-device sync (web + Android hybrid + iOS PWA)',
              'Unlimited watchlists',
              'No ads, no tracking, Ghost Mode by default',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-1 text-[#00D4FF]">▸</span>
                <span className="text-sm text-[#E2E8F0]">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-6 text-center text-xs text-[#334155]">
          $0 today. Trial ends in 72 hours, then your selected plan begins. Cancel anytime in one tap.
        </p>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-6 py-20">
        <div className="rounded-2xl border border-[#0D2235] bg-gradient-to-br from-black to-[#0D2235]/30 p-12 text-center">
          <h2 className="text-3xl font-black md:text-4xl">Available on Android. iPhone soon.</h2>
          <p className="mx-auto mt-4 max-w-xl text-[#64748B]">
            After signup, your premium APK download link is sent to your email and unlocked inside the app.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a href="#pricing" className="rounded bg-[#00D4FF] px-6 py-3 text-sm font-black tracking-widest text-[#020D14] transition hover:bg-white">
              GET ANDROID APK
            </a>
            <span className="rounded border border-[#0D2235] px-6 py-3 text-sm font-bold tracking-widest text-[#334155]">
              IPHONE — COMING SOON
            </span>
          </div>
        </div>
      </section>

      <footer className="relative z-10 mx-auto max-w-7xl px-6 py-12 text-center">
        <div className="font-mono text-xs uppercase tracking-[0.4em] text-[#334155]">
          © 2026 hyveapp.co — Built for situational awareness
        </div>
        <div className="mt-3 text-xs text-[#334155]">
          Hyve Spy aggregates only public-safety audio and cameras that are already free to the public. We don&apos;t host or rebroadcast — we point.
        </div>
      </footer>
    </main>
  );
}
