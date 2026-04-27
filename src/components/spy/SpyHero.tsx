export default function SpyHero() {
  return (
    <section className="relative overflow-hidden border-b border-[#0D2235] py-24 md:py-32 px-6">
      {/* dot grid backdrop */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #00D4FF 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 30% 20%, rgba(0,212,255,0.08), transparent 60%), radial-gradient(circle at 80% 80%, rgba(255,45,45,0.06), transparent 60%)',
        }}
      />

      <div className="relative max-w-6xl mx-auto">
        <span className="inline-block px-3 py-1 rounded border border-[#00D4FF]/30 bg-[#00D4FF]/5 text-[#00D4FF] text-[10px] font-bold tracking-[0.2em] uppercase mb-6">
          Hyve Spy &nbsp;·&nbsp; Public Safety Intelligence
        </span>
        <h1 className="text-5xl md:text-7xl font-black leading-[0.95] tracking-tight mb-6">
          See what dispatch sees.
          <br />
          <span className="text-[#00D4FF]">In real time.</span>
        </h1>
        <p className="text-lg md:text-xl text-white/60 max-w-2xl mb-10 leading-relaxed">
          4,300+ live police, fire, EMS &amp; aviation scanner feeds. 25,000+ public DOT, traffic, weather and webcam streams. Real-time crime data. Built-in FOIA request generator. One tactical map, the whole country.
        </p>

        <div className="flex flex-wrap items-center gap-3 mb-12">
          <a
            href="/spy/sign-up-free"
            className="px-7 py-3.5 rounded-lg bg-[#00D4FF] text-black font-bold uppercase tracking-wider text-sm hover:bg-[#00D4FF]/90 transition-colors"
          >
            Start Free with Ads
          </a>
          <a
            href="#features"
            className="px-7 py-3.5 rounded-lg border border-[#0D2235] text-white/80 font-bold uppercase tracking-wider text-sm hover:border-[#00D4FF]/50 hover:text-white transition-colors"
          >
            See How It Works
          </a>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl">
          <Stat n="4,300+" label="Scanner Feeds" />
          <Stat n="25,000+" label="Live Cameras" />
          <Stat n="50" label="States Covered" />
          <Stat n="Real-time" label="Crime Data" />
        </div>
      </div>
    </section>
  )
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="border-l-2 border-[#00D4FF]/40 pl-4">
      <div className="text-3xl md:text-4xl font-black font-mono text-[#00D4FF]">{n}</div>
      <div className="text-[10px] tracking-[0.18em] uppercase text-white/40 font-bold mt-1">{label}</div>
    </div>
  )
}
