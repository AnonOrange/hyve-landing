export default function SpyFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="py-10 px-6 text-white/40">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-4 justify-between items-center text-xs">
        <div className="flex items-center gap-3">
          <span className="font-mono tracking-widest text-[#E8C456]/90">HYVE SPY</span>
          <span>© {year}</span>
        </div>
        <div className="flex flex-wrap gap-5 font-mono text-[11px] tracking-wider">
          <a href="/" className="hover:text-white">All Apps</a>
          <a href="/messenger" className="hover:text-white">Messenger</a>
          <a href="/privacy" className="hover:text-white">Privacy</a>
          <a href="#features" className="hover:text-white">Features</a>
          <a href="#pricing" className="hover:text-white">Pricing</a>
          <a href="#download" className="hover:text-white">Download</a>
        </div>
      </div>
      <p className="text-[10px] text-white/30 max-w-3xl mx-auto text-center mt-6 leading-relaxed">
        Hyve Spy aggregates publicly-broadcast scanner audio (OpenMHz, Broadcastify free tier) and
        publicly-published government cameras (state DOTs, NYC TMC, USGS, NWS, NPS) for
        situational-awareness purposes. We do not relay or rebroadcast — every stream link points
        to the original publisher. FOIA tools are provided as templates only and do not constitute
        legal advice.
      </p>
      {/* Creator + copyright — same attribution that appears on every page. */}
      <div className="max-w-3xl mx-auto mt-6 border-t border-white/5 pt-5 text-center">
        <p className="text-[11px] leading-relaxed text-white/40">
          HYVE™ created by{' '}
          <span className="text-white/70">Anthony S. Owens</span>{' '}
          c/o{' '}
          <a
            href="https://www.vibesoftwaresolutions.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#E8C456]/90 hover:text-[#E8C456] underline-offset-4 hover:underline"
          >
            Vibe Software Solutions
          </a>
          .
        </p>
        <p className="mt-1 text-[10px] text-white/30">
          © {year} Anthony S. Owens / Vibe Software Solutions. All rights reserved.
          HYVE and all Hyve product marks are trademarks of Vibe Software Solutions.
        </p>
      </div>
    </footer>
  )
}
