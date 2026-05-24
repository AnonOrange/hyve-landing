// Attend site footer. Async server component: reads active sponsors from the
// DB and renders them, plus the section nav + copyright. The DB read is wrapped
// in try/catch — this footer is on every Attend page, so a momentary DB blip
// must degrade to "no sponsors" rather than 500 the whole page.
import Link from 'next/link'
import { listActiveSponsors, type SponsorRow } from '@/lib/attend/sponsors/sponsor-service'
import { SponsorLogo } from './sponsor-logo'

export default async function AttendFooter() {
  let sponsors: SponsorRow[] = []
  try {
    sponsors = await listActiveSponsors()
  } catch {
    sponsors = []
  }

  return (
    <footer className="border-t border-[#2a2135] bg-[#08111e]">
      <div className="mx-auto max-w-7xl px-6 py-10">
        {sponsors.length > 0 && (
          <div className="flex flex-col items-center gap-4 border-b border-[#2a2135] pb-8">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#9e8a55]">
              Sponsored by
            </p>
            <div className="flex flex-wrap items-start justify-center gap-x-10 gap-y-6">
              {sponsors.map((s) => (
                <SponsorLogo
                  key={s.id}
                  name={s.name}
                  url={s.url}
                  logoUrl={s.logo_url}
                  blurb={s.blurb}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <Link
            href="/attend"
            className="text-sm font-black tracking-[0.3em] text-[#E8C456]"
          >
            HYVE ATTEND
          </Link>
          <nav className="flex gap-5 text-xs font-bold tracking-[0.2em] text-[#9e8a55]">
            <Link href="/attend/events" className="hover:text-[#E8C456]">DISCOVER</Link>
            <Link href="/attend/wallet" className="hover:text-[#E8C456]">WALLET</Link>
            <Link href="/attend/creator" className="hover:text-[#E8C456]">CREATE</Link>
          </nav>
          <p className="font-mono text-[10px] tracking-widest text-[#9e8a55]">
            © {new Date().getFullYear()} HYVE
          </p>
        </div>
      </div>
    </footer>
  )
}
