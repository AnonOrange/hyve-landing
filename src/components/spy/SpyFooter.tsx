export default function SpyFooter() {
  return (
    <footer className="py-10 px-6 text-white/40">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-4 justify-between items-center text-xs">
        <div className="flex items-center gap-3">
          <span className="font-mono tracking-widest text-[#00D4FF]/80">HYVE SPY</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
        <div className="flex flex-wrap gap-5 font-mono text-[11px] tracking-wider">
          <a href="/" className="hover:text-white">HYVE Comms</a>
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
    </footer>
  )
}
