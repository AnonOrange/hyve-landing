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
  { value: '57,260', label: 'Live crime reports' },
  { value: '20', label: 'Cities w/ daily crime' },
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
    title: '39,457 free TV channels — every one on a real map',
    body:
      "Every public broadcaster's 24/7 stream, plotted at its actual studio HQ. ABC News Live, NBC News NOW, CBS, Bloomberg, Sky News, Al Jazeera, France 24, DW, NHK, CNA, Reuters — pinned exactly where they're broadcast from. Plus the entire iptv-org open dataset: 14,298 US channels (every state's local ABC/NBC/CBS/Fox affiliates that publish a free stream) and 39,457 channels worldwide across 199 countries. Click any pin → full-screen player (YouTube live for curated, native HLS for everything else). Government feeds (C-SPAN, White House, UK Parliament, EU Council, UN), space (NASA TV, ISS Earth-view, SpaceX), iconic webcams (Times Square, Shibuya, Eiffel, Venice St Mark's), nature cams (Yellowstone, aurora, African watering hole). Every subscriber gets all of it — not pro-gated. Live now at /spy/app/tv.",
    accent: '#EF4444',
    tag: 'TV',
  },
  {
    title: '53,719 free radio stations — radio.garden but better',
    body:
      "Every internet radio station from radio-browser.info's community database, dropped onto a global dark map at the station's real geographic location. 6,969 US stations (every working AM/FM/online affiliate) plus the most-clicked 5,000 worldwide — covers virtually every recognizable global station. Tap any pin: instant audio playback (HTML5 native for MP3/AAC, hls.js for streaming HLS), genre/language tags, station favicon, bitrate, codec, link to homepage. Genre quick-filters (news, talk, jazz, rock, classical, dance) auto-built from the most-common tags in the loaded set. Pause/resume, no ads, no app. Every subscriber gets all of it. Live now at /spy/app/radio.",
    accent: '#22C55E',
    tag: 'RADIO',
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
    title: 'HYVE SLEUTH — OSINT smart-launcher (Pro Intel tool)',
    body:
      "Sleuth indexes 100+ public OSINT resources — CourtListener, PACER, Justia, UniCourt, BOP federal inmate locator, VINELink, NSOPW national sex-offender registry, Family Watchdog, OpenCorporates, BBB, Zillow, Redfin, voter rolls, property tax, military records, professional licensing, bankruptcy, news archives. Enter a subject's name + optional location, hit Launch All, and 30+ tabs open with the search pre-executed across every relevant database. PIN-protected profiles, hit/miss tracking per resource, free-form notes, JSON export. Lives inside the Intel tab as an inline web tool. The same workflow PIs charge $500/case for, automated.",
    accent: '#C8A227',
    tag: 'SLEUTH',
  },
  {
    title: 'HYVE RESIDENTIAL — distressed-property intel (Pro Intel tool)',
    body:
      "Browse every distressed property in your county directly in the Spy app — no download. Foreclosure pipeline (filed → notice → hearing → sale → sold/dismissed), tax-delinquent properties (years owed, amount due, penalties), HOA / mechanic / contractor / judgment liens, and combined property-profile cards (parcel + owner + tax + lien history). Each property gets a 0-100 distress score so the highest-stress targets sort to the top. One-click cross-link to Sleuth on the owner — instantly check court / corrections / OSINT records on the person. Same data PropStream / DealMachine / BatchLeads charge $200-$1,000/mo for, included with Pro. Wake + Mecklenburg + more NC counties on launch.",
    accent: '#F59E0B',
    tag: 'RESIDENTIAL',
  },
  {
    title: '57,260 live crime reports — 20 cities, refreshed daily',
    body:
      'Real incident pins (not heatmaps) refreshed daily at 9am UTC from city open-data portals: NYC · LA · Chicago · Philadelphia · Minneapolis · SF · Seattle · Raleigh · Dallas · Lewisville TX · DC · Tucson · Houston · Montgomery County MD · Valdosta GA · Gainesville FL · Buffalo · Boulder CO · Marin County CA · Halifax NS. 12 category icons (🔫 shooting, 💀 homicide, 👊 assault, 💰 robbery, 🏚 burglary, 🚗 vehicle theft, 🛒 theft, 💊 drug, 🎨 vandalism, 🔥 arson, 💳 fraud, ⚠ sex offense). Click any pin → 🎙 SCANNER AUDIO with 3 closest live feeds + Broadcastify Premium archive deep-link + OpenMHz public calls.',
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
    title: 'Tactical dark map + 15 dedicated tabs',
    body:
      'Bottom nav (3 rows × 5 cols): Map · Feeds · Cams · Crime · Intel · Globe · W-Cams · TV · Radio · Watch · Settings · Pulse · Roulette · Ticker · Panopticon. Each tab loads only its own data — no monolithic loads. Custom dark CARTO tiles. Marker clustering keeps 100k+ pin layers responsive even on cheap phones.',
    accent: '#06B6D4',
    tag: 'NAVIGATION',
  },
  {
    title: 'PULSE — live national activity heatmap',
    body:
      "Where in America is something HAPPENING right now? Pulse fuses three independent live signals into one live-glow heat layer: scanner listener-spikes (5× normal traffic = real responders + civilians tuning in because something just went down), recent crime cadence (cities with 3+ incidents in the last 24h), and Whisper STT keyword bursts. The country pulses red where shit is going down, without you needing to know in advance where to look. Refreshes every 60s. The first crime weather radar — nobody else has all three signals in one product.",
    accent: '#FF2D2D',
    tag: 'PULSE',
  },
  {
    title: 'ROULETTE — random live anywhere',
    body:
      "One button. Drops you into a random place on Earth and serves up: closest live scanner feed (audio plays), four nearest cameras (auto-refreshing snapshots every 5 seconds), the closest local TV + radio station from our 39k/54k catalogs, and recent crime within 25 miles. Stay 30 seconds or roll again. ChatRoulette for live reality — except every destination is real, every camera is live, and every scanner is broadcasting current public-safety dispatches. Weighted-random by listener count so popular feeds appear more often, but a single-truck volunteer fire department in Wyoming still has a real shot at being where you land. Goes viral on screenshot.",
    accent: '#A855F7',
    tag: 'ROULETTE',
  },
  {
    title: 'TICKER — national 911 ticker',
    body:
      "A scrolling Bloomberg-terminal-style bar of dispatched/breaking events, nationwide, in real time. Listener-spike feeds (top scanner activity by current listeners) and recent crime incidents (last 24h, sorted by recency) interleaved into one continuous national pulse: 🔫 SHOTS FIRED · Detroit MI · 14s ago    🏚 STRUCTURE FIRE · Atlanta GA · 23s ago    👁 PURSUIT · Tampa FL · 47s ago. Click any item → drops onto the map. The first national real-time emergency feed of its kind — every other ticker covers one city or one type. This is the country.",
    accent: '#F59E0B',
    tag: 'TICKER',
  },
  {
    title: 'PANOPTICON — \"how surveilled am I right now?\"',
    body:
      "Drop a pin on the map (or hit \"Score Me\" for geolocation) → instant 0-100 Panopticon Score for that exact spot, with full breakdown: number of Flock LPR readers, ShotSpotter mics, drone deployments, face-recognition systems, Stingrays, fusion centers, public CCTVs, and body-cam programs within 1 mile. Each device type weighted by privacy invasiveness (Stingrays heaviest, body cams lightest). Severity color: green CLEAR → amber ELEVATED → red PANOPTICON. A working tool for journalists, protesters, and the privacy-conscious — and a viral civic-tech screenshot generator. Nobody else joins the EFF surveillance dataset + DeFlock + OSM CCTV layer in one query.",
    accent: '#A855F7',
    tag: 'PANOPTICON',
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
    title: 'Sentinel — one-shot camera exposure audit',
    body:
      "Pay $9.99-$49.99 once, list the cameras / IPs / domains you own, sign the authorization agreement, and we deliver a plain-English report: which of your devices are exposed to the internet, what kind of exposure (Hikvision unauthenticated UI, Dahua default credentials, Foscam weak password, Axis open RTSP, etc.), and step-by-step instructions to fix each one. Real probes — DNS, TLS, HTTP, vendor-specific camera detection, exposed-DB-port checks. Same legal model as professional pen-testing. Live now at /spy/app/sentinel.",
    accent: '#A855F7',
    tag: 'SENTINEL',
  },
  {
    title: 'Scout — automated infrastructure pen test',
    body:
      "$49.99-$299.99, one-shot pen test for your own domains and IPs. Real probes: SPF/DMARC missing, TLS expired, weak ciphers, missing security headers, exposed admin panels, public database ports, dangling CNAMEs (subdomain takeover). Same chassis as Sentinel — sign authorization, register assets, get a severity-color-coded report with click-by-click remediation per finding. Live now at /spy/app/sentinel.",
    accent: '#FF2D2D',
    tag: 'SCOUT',
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
  { src: '/spy-screenshots/1-map.png', alt: 'Map with scanner pins and camera dots', caption: 'Tactical map — 6,500 scanner pins + 73K camera dots + 39K TV + 54K radio stations' },
  { src: '/spy-screenshots/2-feeds.png', alt: 'Feeds list', caption: '6,500+ feeds, sorted by live listener count' },
  { src: '/spy-screenshots/3-incident.png', alt: 'Incident detail with audio + camera', caption: 'Tap a feed → audio + AI summary + live cameras within 30 miles' },
  { src: '/spy-screenshots/4-foia.png', alt: 'FOIA download + cameras', caption: 'Live DOT cameras, auto-refreshing every 2 seconds' },
];

export default function SpyPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08070a] font-sans text-[#ede8d8]">
      {/*
        Themed to match the new gold-on-near-black HYVE Spy brand
        (logo art, hyvealpha.com aesthetic). The grid lines are now a faint
        gold tint instead of cyan; primary CTAs use the gold gradient that
        matches the logo's metallic feel.
      */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(rgba(200,162,39,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(200,162,39,0.06) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div
          className="text-sm font-black tracking-[0.3em]"
          style={{
            background: 'linear-gradient(135deg, #C8A227 0%, #E8C456 50%, #C8A227 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
          }}
        >
          HYVE SPY
        </div>
        <nav className="hidden gap-8 text-sm font-medium text-[#9e8a55] md:flex">
          <a href="#features" className="transition hover:text-[#E8C456]">Features</a>
          <a href="#sentinel" className="transition hover:text-[#A855F7]">Sentinel · Scout</a>
          <a href="#screenshots" className="transition hover:text-[#E8C456]">Screenshots</a>
          <a href="#pricing" className="transition hover:text-[#E8C456]">Pricing</a>
        </nav>
        <div className="flex items-center gap-3">
          <OpenWebAppButton />
          <a
            href="/spy/login"
            className="text-xs font-bold tracking-widest text-[#9e8a55] transition hover:text-[#ede8d8]"
          >
            SIGN IN
          </a>
          <a
            href="#pricing"
            className="rounded px-4 py-2 text-xs font-black tracking-widest text-[#1a1200] transition hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, #C8A227, #E8C456)',
              boxShadow: '0 0 30px -10px rgba(200,162,39,0.5)',
            }}
          >
            START FREE TRIAL
          </a>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-16 pt-8 md:pt-12">
        <div className="mb-12 flex justify-center md:mb-16">
          <div className="relative w-full max-w-3xl">
            {/* Gold halo behind the new logo to amplify the metallic glow */}
            <div className="absolute -inset-12 bg-gradient-to-r from-[#C8A227]/30 via-[#E8C456]/15 to-[#C8A227]/30 blur-3xl" />
            <Image src="/spy-logo/hyve-spy-logo.png" alt="Hyve Spy" width={1536} height={1024} className="relative h-auto w-full" priority />
          </div>
        </div>

        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#C8A227]/40 bg-black/40 px-3 py-1 text-xs font-bold tracking-widest text-[#E8C456]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#E8C456]" />
              LIVE NATIONWIDE COVERAGE
            </div>
            <h1 className="text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
              <span className="text-[#ede8d8]">Hear what&apos;s </span>
              <span style={{ background: 'linear-gradient(110deg,#C8A227 0%,#E8C456 50%,#C8A227 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }}>
                happening
              </span>
              <span className="text-[#ede8d8]"> right now.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-[#9e8a55]">
              Real-time scanner audio · 73,000 live cameras · 39,000 free TV channels · 54,000 free radio stations · 164,000 surveillance markers · 97,000 sex offender pins · 57,000 live crime reports across 20 cities. Whisper-STT push alerts within X miles. AI summaries on any LLM key. One tap on a map.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <a
                href="#pricing"
                className="rounded px-6 py-3 text-sm font-black tracking-widest text-[#1a1200] transition hover:opacity-90"
                style={{
                  background: 'linear-gradient(135deg, #C8A227, #E8C456)',
                  boxShadow: '0 0 60px -10px rgba(200,162,39,0.5), 0 0 140px -40px rgba(232,196,86,0.6)',
                }}
              >
                START 72-HOUR FREE TRIAL
              </a>
              <a
                href="/spy/login"
                className="rounded border border-[#C8A227] bg-transparent px-6 py-3 text-sm font-black tracking-widest text-[#E8C456] transition hover:bg-[#C8A227]/10"
              >
                SIGN IN →
              </a>
              <span className="font-mono text-sm text-[#6b5e3a]">$5.99/mo · cancel anytime</span>
            </div>
            <p className="mt-3 font-mono text-xs text-[#475569]">
              iOS-friendly · works in any browser · installable as a PWA
            </p>
            <div className="mt-12 grid grid-cols-2 gap-6 md:grid-cols-4">
              {STATS.map((s) => (
                <div key={s.label}>
                  <div className="font-mono text-2xl font-bold text-[#E8C456]">{s.value}</div>
                  <div className="mt-1 text-xs uppercase tracking-widest text-[#6b5e3a]">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex justify-center md:justify-end">
            <div className="absolute -inset-8 rounded-[3rem] bg-[#C8A227]/10 blur-3xl" />
            <div className="relative">
              <div className="rounded-[2.5rem] border border-[#2a2135] bg-black p-2 shadow-2xl">
                <div className="overflow-hidden rounded-[2rem] border border-[#2a2135]">
                  <Image src="/spy-screenshots/1-map.png" alt="Hyve Spy live map" width={540} height={1170} className="h-auto w-[280px] md:w-[320px]" priority />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sentinel · Scout — flagship paid product line. Placed RIGHT under the
          hero so visitors see the standalone audit offering before scrolling
          through the Pro-subscription feature grid. */}
      <section id="sentinel" className="relative z-10 mx-auto max-w-7xl px-6 pt-8 pb-12 md:pt-12">
        <div className="rounded-2xl border-2 bg-gradient-to-br from-[#A855F7]/5 via-transparent to-[#FF2D2D]/5 p-8 md:p-12"
             style={{ borderColor: '#A855F7' }}>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#A855F7]/40 bg-[#A855F7]/10 px-3 py-1 font-mono text-[10px] tracking-[0.3em] text-[#A855F7]">
            🔒 ONE-SHOT SECURITY AUDITS · NEW
          </div>
          <h2 className="text-3xl font-black leading-[1.05] tracking-tight md:text-5xl">
            <span className="text-white">Find what&apos;s exposed. </span>
            <span style={{ background: 'linear-gradient(90deg,#A855F7,#FF2D2D)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Fix it in plain English.
            </span>
          </h2>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-[#94A3B8] md:text-lg">
            Pay once, list the assets you own, sign the authorization, and we deliver a real security audit with
            click-by-click remediation. No subscription. AES-256 encrypted with per-audit keys. Sensitive details
            auto-purge in 7 days so we never retain a long-term map of your exposed systems.
          </p>

          {/* Two products */}
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-[#A855F7]/40 bg-black/30 p-5">
              <div className="mb-2 flex items-center gap-2 font-mono text-[10px] tracking-widest text-[#A855F7]">
                <span>📹</span><span>SENTINEL · CAMERA EXPOSURE AUDIT</span>
              </div>
              <div className="mb-2 text-xl font-black text-white">From $9.99 · one-time</div>
              <p className="mb-2 text-sm text-[#94A3B8]">
                Hikvision, Dahua, Foscam, Axis, generic RTSP. Vendor-specific remediation per finding.
              </p>
              <div className="font-mono text-[10px] text-[#64748B]">5 / 20 / 100 asset tiers</div>
            </div>
            <div className="rounded-lg border border-[#FF2D2D]/40 bg-black/30 p-5">
              <div className="mb-2 flex items-center gap-2 font-mono text-[10px] tracking-widest text-[#FF2D2D]">
                <span>🛡</span><span>SCOUT · INFRASTRUCTURE PEN TEST</span>
              </div>
              <div className="mb-2 text-xl font-black text-white">From $49.99 · one-time</div>
              <p className="mb-2 text-sm text-[#94A3B8]">
                DNS misconfig, expired/weak TLS, missing security headers, exposed admin panels, public DB ports.
              </p>
              <div className="font-mono text-[10px] text-[#64748B]">3 / 10 / 50 asset tiers</div>
            </div>
          </div>

          {/* Trust strip */}
          <div className="mt-8 grid gap-4 border-t border-[#A855F7]/20 pt-6 text-xs text-[#64748B] md:grid-cols-4">
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-lg font-black text-white">
                <span style={{ color: '#22C55E' }}>🔒</span><span>AES-256</span>
              </div>
              Hyve Encryption per audit
            </div>
            <div><div className="mb-1 text-lg font-black text-white">7-day</div>Auto-purge of details</div>
            <div><div className="mb-1 text-lg font-black text-white">~30s</div>Typical scan time</div>
            <div><div className="mb-1 text-lg font-black text-white">2-layer</div>Scope enforcement</div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="/spy/app/sentinel"
               className="rounded-lg px-6 py-3 text-sm font-black tracking-widest transition hover:scale-[1.02]"
               style={{ background: '#A855F7', color: '#020D14', boxShadow: '0 0 60px -10px rgba(168,85,247,0.5)' }}>
              SEE PRICING + START AUDIT
            </a>
            <a href="/spy/app/sentinel#how" className="rounded-lg border border-[#A855F7]/40 px-6 py-3 text-sm font-bold tracking-widest text-[#E2E8F0] transition hover:border-[#A855F7]">
              HOW IT WORKS
            </a>
            <span className="font-mono text-[10px] text-[#475569]">No subscription · pay once · 24h refund window</span>
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
          <p className="mt-3 text-[#64748B]">72-hour free trial on every paid plan. Or start free with ads.</p>
        </div>

        {/*
          FREE TIER — ad-supported, web-only. Same feature surface as Basic
          but with display ads on most screens. Drives top-of-funnel volume
          + creates an upgrade path to ad-free Basic.
        */}
        <div className="mb-6 rounded-2xl border-2 border-[#22C55E]/40 bg-gradient-to-br from-[#22C55E]/8 to-transparent p-6">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="mb-1 font-mono text-[10px] tracking-[0.4em] text-[#22C55E]">
                NEW · FREE WITH ADS
              </div>
              <h3 className="text-xl font-black text-[#E2E8F0]">$0/mo — same data, ad-supported</h3>
              <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[#94A3B8]">
                All scanner audio, cameras, crime, TV, radio, pulse, and ticker — same as Basic, with
                display ads on most screens. Pro features (Sleuth, Residential, Intel hub, Globe)
                stay paid. Web only — sign up in seconds, no credit card.
              </p>
            </div>
            <a
              href="/spy/sign-up-free"
              className="shrink-0 rounded px-6 py-3 text-sm font-black tracking-widest text-[#020D14] transition hover:scale-[1.02]"
              style={{ background: '#22C55E', boxShadow: '0 0 60px -10px rgba(34,197,94,0.5)' }}
            >
              START FREE →
            </a>
          </div>
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
            <span className="text-[#EF4444]">TV</span> &amp; <span className="text-[#22C55E]">Radio</span> tabs (39K channels + 54K stations on a real map) are free for every subscriber.
            Pro tier additionally unlocks the <span className="text-[#22C55E]">Global view</span> (24,491 worldwide cams) +
            the <span className="text-[#F59E0B]">Intel suite</span> (164k surveillance · 97k offenders · 57k live crime reports).
          </p>
          <ul className="grid gap-3 md:grid-cols-2">
            {[
              'All 6,500+ live scanner feeds (police, fire, EMS, aviation, marine)',
              'All 49,488 US live cameras (DOT, USGS, EarthCam, NYC TMC, Windy)',
              '🆕 39,457 free TV channels worldwide on a real map (14,298 US)',
              '🆕 53,719 free radio stations worldwide on a real map (6,969 US)',
              '🆕 PULSE — live national activity heatmap (scanner + crime + STT fusion)',
              '🆕 ROULETTE — one-button random teleport into live reality',
              '🆕 TICKER — hyperlocal scrolling event ticker (geo-radius selectable)',
              '🆕 PANOPTICON — drop a pin, get a 0-100 surveillance density score',
              '🆕 HYVE SLEUTH — Pro OSINT smart-launcher (100+ public databases)',
              '🆕 HYVE RESIDENTIAL — Pro real-estate distress intel (in-tab, no download)',
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
