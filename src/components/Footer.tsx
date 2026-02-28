export default function Footer() {
  return (
    <footer className="border-t border-white/8 py-12 px-6 mt-8">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 36 36" className="w-7 h-7">
            <polygon
              points="18,2 33,10 33,26 18,34 3,26 3,10"
              fill="none"
              stroke="url(#footerGrad)"
              strokeWidth="1.5"
            />
            <defs>
              <linearGradient id="footerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#39FF14" />
                <stop offset="100%" stopColor="#FFB800" />
              </linearGradient>
            </defs>
          </svg>
          <span className="font-black text-white tracking-tight">HYVE</span>
          <span className="text-white/30 text-xs ml-1">Beta</span>
        </div>

        {/* Links */}
        <div className="flex items-center gap-6 text-sm text-white/40">
          <a href="#technology" className="hover:text-gold transition-colors">Technology</a>
          <a href="#download" className="hover:text-gold transition-colors">Download</a>
          <a href="#disclaimer" className="hover:text-gold transition-colors">Disclaimer</a>
          <a href="#report" className="hover:text-gold transition-colors">Report a Problem</a>
          <a
            href="mailto:vibesoftwaresolutions@gmail.com"
            className="hover:text-gold transition-colors"
          >
            Contact
          </a>
        </div>

        {/* Copyright */}
        <p className="text-white/25 text-xs">
          © {new Date().getFullYear()} Vibe Software Solutions. All rights reserved.
        </p>
      </div>

      {/* Tagline */}
      <div className="max-w-6xl mx-auto mt-6 text-center">
        <p className="text-xs text-white/20 tracking-widest uppercase">
          Secured by HYVE Encryption
        </p>
      </div>
    </footer>
  )
}
