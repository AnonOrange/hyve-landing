'use client'

export default function LocationSection() {
  return (
    <section id="location" className="py-24 px-6">
      <div className="section-divider max-w-6xl mx-auto mb-24" />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-neon/30 bg-neon/5 text-neon text-xs font-semibold tracking-wider uppercase mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-neon animate-pulse-slow" />
            Live Feature
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
            Encrypted{' '}
            <span className="gradient-gold gold-text-glow">Location Sharing</span>
          </h2>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">
            Share your real-time location with trusted contacts — completely end-to-end encrypted.
            Your coordinates never touch our servers in plaintext.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {features.map((f) => (
            <div key={f.title} className="hyve-card rounded-2xl p-6 flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center text-gold">
                {f.icon}
              </div>
              <h3 className="font-bold text-white text-base">{f.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* How it works strip */}
        <div className="hyve-card rounded-3xl p-8 md:p-12">
          <h3 className="text-xl font-black text-white mb-8 text-center tracking-wide uppercase text-xs text-gold">
            How Location Sharing Works
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div key={i} className="flex flex-col items-center text-center gap-3">
                <div className="w-8 h-8 rounded-full border border-gold/40 bg-gold/5 flex items-center justify-center text-gold font-black text-sm">
                  {i + 1}
                </div>
                <p className="text-sm text-white/60 leading-relaxed">{s}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

const features = [
  {
    title: 'End-to-End Encrypted',
    desc: 'Your GPS coordinates are encrypted with the same HYVE 5-layer protocol before leaving your device. We never see your location.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    title: 'You Control It',
    desc: 'Start and stop sharing at any time. Sessions are temporary — no passive tracking, no background uploads when the session ends.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M9 10a3 3 0 106 0 3 3 0 00-6 0z" />
      </svg>
    ),
  },
  {
    title: 'Zero Server Storage',
    desc: 'Location updates are relayed through the blind relay network — the server only sees encrypted cells, never coordinates.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
      </svg>
    ),
  },
  {
    title: 'Live GPS Updates',
    desc: 'Real-time position updates sent every 5 seconds while sharing. Your contact sees a live dot on their map — not a stale snapshot.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: 'Consent-Based Sharing',
    desc: 'Only you can start a sharing session. No contact can request or force your location — you initiate, you stop.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    title: 'Call Coordination',
    desc: 'Location sharing automatically pauses during encrypted calls so ratchet chains stay in sync — no dropped keys, no interference.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.845v6.311a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
]

const steps = [
  'Open a conversation and tap the location icon',
  'HYVE generates an encrypted sharing session key',
  'Coordinates are encrypted locally before sending',
  'Your contact sees your live position — nobody else can',
]
