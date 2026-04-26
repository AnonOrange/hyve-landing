export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-white/8 py-12 px-6 mt-8">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Logo */}
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hyve-logo/hyve-messenger-emblem.png"
            alt="HYVE"
            className="h-8 w-auto object-contain"
          />
          <span className="text-white/30 text-xs">Beta</span>
        </div>

        {/* Links */}
        <div className="flex items-center gap-6 text-sm text-white/40">
          <a href="/" className="hover:text-gold transition-colors">All Apps</a>
          <a href="#technology" className="hover:text-gold transition-colors">Technology</a>
          <a href="#download" className="hover:text-gold transition-colors">Download</a>
          <a href="#disclaimer" className="hover:text-gold transition-colors">Disclaimer</a>
          <a
            href="mailto:vibesoftwaresolutions@gmail.com"
            className="hover:text-gold transition-colors"
          >
            Contact
          </a>
        </div>

        {/* Tagline */}
        <p className="text-white/25 text-xs uppercase tracking-widest">
          Secured by HYVE Encryption
        </p>
      </div>

      {/* Creator + copyright attribution — required on every page that
          renders this footer. References Anthony S. Owens (creator) c/o
          Vibe Software Solutions (publisher). */}
      <div className="max-w-3xl mx-auto mt-8 border-t border-white/5 pt-6 text-center">
        <p className="text-[11px] leading-relaxed text-white/40">
          HYVE™ created by{' '}
          <span className="text-white/70">Anthony S. Owens</span>{' '}
          c/o{' '}
          <a
            href="https://www.vibesoftwaresolutions.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold/80 hover:text-gold underline-offset-4 hover:underline"
          >
            Vibe Software Solutions
          </a>
          .
        </p>
        <p className="mt-1 text-[11px] text-white/30">
          © {year} Anthony S. Owens / Vibe Software Solutions. All rights reserved.
          HYVE, Hyve Spy, Hyve Messenger, Hyve Sleuth, Hyve Residential, Hyve Sentinel,
          Hyve Alpha, Hyve Cares, and all related marks are trademarks of Vibe Software Solutions.
        </p>
      </div>
    </footer>
  )
}
