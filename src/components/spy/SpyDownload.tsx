export default function SpyDownload() {
  const apkUrl = process.env.NEXT_PUBLIC_SPY_APK_URL || '#'
  const playUrl = process.env.NEXT_PUBLIC_SPY_PLAY_URL || '#'

  return (
    <section id="download" className="border-b border-[#0D2235] py-24 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <span className="text-[#00D4FF] text-[10px] font-bold tracking-[0.2em] uppercase">
          ── Distribution
        </span>
        <h2 className="text-4xl md:text-5xl font-black mt-3 mb-4">Two ways to install</h2>
        <p className="text-white/50 text-base max-w-xl mx-auto mb-10">
          Direct APK is fastest. Play Store is automatic-update friendly.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Direct APK */}
          <a
            href={apkUrl}
            download
            className="group bg-black/40 border border-[#0D2235] hover:border-[#00D4FF]/60 rounded-xl p-8 text-left transition-colors"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[#00D4FF] text-2xl">↓</span>
              <h3 className="text-2xl font-black">Direct APK Download</h3>
            </div>
            <p className="text-white/50 text-sm mb-4 leading-relaxed">
              Sideload directly. Bypass the Play Store. You&apos;ll need to allow installs from unknown sources in Android settings.
            </p>
            <p className="text-[11px] tracking-widest uppercase text-[#00D4FF] font-bold">
              Download .apk →
            </p>
          </a>

          {/* Play Store */}
          <a
            href={playUrl}
            target="_blank"
            rel="noopener"
            className="group bg-black/40 border border-[#0D2235] hover:border-[#22C55E]/60 rounded-xl p-8 text-left transition-colors"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[#22C55E] text-2xl">▶</span>
              <h3 className="text-2xl font-black">Google Play Store</h3>
            </div>
            <p className="text-white/50 text-sm mb-4 leading-relaxed">
              One-tap install with automatic updates. Recommended for most users.
            </p>
            <p className="text-[11px] tracking-widest uppercase text-[#22C55E] font-bold">
              Get it on Play →
            </p>
          </a>
        </div>

        <p className="text-[11px] text-white/30 mt-8 max-w-xl mx-auto">
          Activation code emailed after Stripe checkout. Open the app, paste the code in
          Settings → Activate, and everything unlocks for your trial period.
        </p>
      </div>
    </section>
  )
}
