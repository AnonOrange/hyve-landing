export default function Footer() {
  return (
    <footer className="border-t border-white/8 py-12 px-6 mt-8">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Logo */}
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hyvelloo.png"
            alt="HYVE"
            className="h-8 w-auto object-contain"
          />
          <span className="text-white/30 text-xs">Beta</span>
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
