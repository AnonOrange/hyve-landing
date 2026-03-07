export default function DownloadSection() {
  return (
    <section id="download" className="py-24 px-6">
      {/* Gold gradient divider */}
      <div className="section-divider max-w-6xl mx-auto mb-24" />

      <div className="max-w-5xl mx-auto">
        <div className="hyve-card rounded-3xl p-10 md:p-14 text-center relative overflow-hidden gold-glow">
          {/* Background glow blob */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[500px] h-[300px] bg-gold/8 blur-[80px] rounded-full" />
          </div>

          <div className="relative">
            <span className="inline-block px-4 py-1.5 rounded-full border border-gold/30 bg-gold/5 text-gold text-xs font-semibold tracking-widest uppercase mb-6">
              Available Now
            </span>

            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              Get HYVE Today
            </h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto mb-10">
              Subscribe and download the Android APK. Setup takes under 60 seconds.
            </p>

            {/* Platform cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto mb-10">
              {/* Android */}
              <a
                href="#pricing"
                className="btn-primary rounded-2xl p-5 flex flex-col items-center gap-2 group"
              >
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85a.637.637 0 00-.83.22l-1.88 3.24a11.463 11.463 0 00-8.94 0L5.65 5.67a.643.643 0 00-.87-.2c-.28.18-.37.54-.22.83L6.4 9.48A10.78 10.78 0 001 18h22A10.78 10.78 0 0017.6 9.48zM7 15.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm10 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" />
                </svg>
                <span className="font-bold text-sm">Android APK</span>
                <span className="text-xs opacity-70">Android 8.0+ required</span>
              </a>

              {/* iOS — coming soon */}
              <div className="rounded-2xl p-5 flex flex-col items-center gap-2 border border-white/10 opacity-40 cursor-not-allowed select-none">
                <svg className="w-8 h-8 text-white/50" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                <span className="font-bold text-sm text-white/50">iOS App</span>
                <span className="text-xs text-white/30">Coming Soon</span>
              </div>
            </div>

            {/* Install instructions */}
            <div className="text-left max-w-xl mx-auto bg-white/5 rounded-xl p-5 border border-white/10">
              <p className="text-xs font-semibold text-gold uppercase tracking-wider mb-3">
                Android Installation Steps
              </p>
              <ol className="text-sm text-white/60 space-y-2 list-decimal list-inside">
                <li>Download the APK file above</li>
                <li>Open your device <strong className="text-white/80">Settings → Security</strong></li>
                <li>Enable <strong className="text-white/80">Install unknown apps</strong> for your browser</li>
                <li>Open the downloaded APK and tap <strong className="text-white/80">Install</strong></li>
                <li>Launch HYVE and create your encrypted identity</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
