// Shared page-banner hero for /attend section pages.
//
// Centralises the bg + gradient + eyebrow/title pattern so every Attend
// route can drop in a branded header in one line. Used by the wallet,
// creator dashboard, payouts, promotion, per-event, event detail and
// admin pages. The /attend landing has its own bespoke hero.
import Image from 'next/image'

export function PageHero({
  bg,
  eyebrow,
  title,
  subtitle,
  meta,
  back,
  height = 'sm',
}: {
  /** Path under /public e.g. "/attend/backgrounds/bg-4.png" */
  bg: string
  /** Small all-caps tag rendered above the title in brand gold. */
  eyebrow?: string
  /** The H1. */
  title: string
  /** Optional one-line subtitle. */
  subtitle?: string
  /** Optional right-aligned mono badge (e.g. payout status). */
  meta?: React.ReactNode
  /** Optional small back link rendered above the eyebrow. */
  back?: { href: string; label: string }
  /** sm = ~220px / md = ~280px / lg = ~360px */
  height?: 'sm' | 'md' | 'lg'
}) {
  const heightClass =
    height === 'lg'
      ? 'h-[360px] sm:h-[400px]'
      : height === 'md'
        ? 'h-[280px] sm:h-[320px]'
        : 'h-[220px] sm:h-[260px]'
  return (
    <section
      className={`relative -mx-6 mt-2 overflow-hidden sm:rounded-2xl sm:mx-0 ${heightClass}`}
    >
      <Image
        src={bg}
        alt=""
        width={1920}
        height={1080}
        priority
        sizes="(min-width: 1280px) 1280px, 100vw"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-tr from-[#08111e] via-[#08111e]/65 to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-end gap-2 p-6 sm:p-9">
        {back && (
          <a
            href={back.href}
            className="self-start text-xs font-bold tracking-wider text-white/80 transition hover:text-[#E8C456]"
          >
            ← {back.label}
          </a>
        )}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            {eyebrow && (
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#E8C456]">
                {eyebrow}
              </p>
            )}
            <h1 className="mt-2 text-3xl font-black leading-[1.05] text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.6)] sm:text-4xl md:text-5xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-3 max-w-2xl text-sm text-white/85 sm:text-base">{subtitle}</p>
            )}
          </div>
          {meta}
        </div>
      </div>
    </section>
  )
}
