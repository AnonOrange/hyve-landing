import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getEventPage } from '@/lib/attend/discovery/discovery-service'
import { getAttendUser } from '@/lib/attend/identity/auth'
import CheckoutClient from './checkout-client'

// Deterministically pick one of the stage backgrounds for the event hero
// based on the slug, so an individual event's page always looks the same
// while the catalogue as a whole rotates through the library.
const EVENT_HERO_BGS = [
  '/attend/backgrounds/bg-1.png',
  '/attend/backgrounds/bg-4.png',
  '/attend/backgrounds/bg-7.png',
  '/attend/backgrounds/bg-8.png',
  '/attend/backgrounds/bg-9.png',
  '/attend/backgrounds/bg-11.png',
]
function pickEventHero(slug: string): string {
  let hash = 0
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) | 0
  return EVENT_HERO_BGS[Math.abs(hash) % EVENT_HERO_BGS.length]
}

export const dynamic = 'force-dynamic'

const humanize = (s: string) =>
  s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/_/g, ' ')

const fmtWhen = (iso: string | null) => (iso ? iso.slice(0, 16).replace('T', ' ') : null)

// Wall-clock ISO text (YYYY-MM-DDTHH:MM…) -> a Google Calendar local datetime
// (YYYYMMDDTHHMMSS, no trailing Z). The timezone is passed separately as `ctz`
// so the time is not misread as UTC.
const calDate = (iso: string) => `${iso.slice(0, 16).replace(/[-:]/g, '')}00`

function calendarUrl(title: string, startsAt: string, endsAt: string, tz: string): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${calDate(startsAt)}/${calDate(endsAt)}`,
    ctz: tz,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

const card = 'rounded border border-[#2a2135] bg-[#111111] px-4 py-4'

export default async function EventPage({ params }: { params: { slug: string } }) {
  const data = await getEventPage(params.slug)
  if (!data) notFound()
  const { event, ticketTypes, artist } = data
  const user = await getAttendUser()
  const starts = fmtWhen(event.starts_at)
  const ends = fmtWhen(event.ends_at)

  const heroBg = pickEventHero(event.slug)

  return (
    <div>
      {/* Event hero: stage background + the event title + show type + live
          status. Replaces the earlier placeholder gradient. */}
      <section className="relative -mx-6 mt-2 h-[300px] overflow-hidden sm:rounded-2xl sm:mx-0 sm:h-[380px]">
        <Image
          src={heroBg}
          alt=""
          width={1920}
          height={1080}
          priority
          sizes="(min-width: 1280px) 1280px, 100vw"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#08111e] via-[#08111e]/60 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-9">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#E8C456]">
            {humanize(event.show_type)}
          </span>
          <h1 className="mt-2 text-3xl font-black leading-[1.05] text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.6)] md:text-5xl">
            {event.title}
          </h1>
          <p className="mt-3 font-mono text-[11px] tracking-widest text-[#E8C456]">
            {humanize(event.status)}
          </p>
        </div>
      </section>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <section className={card}>
            <h2 className="text-xs font-black tracking-[0.2em] text-[#9e8a55]">ARTIST</h2>
            <div className="mt-3 flex items-center gap-3">
              {artist.avatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={artist.avatarUrl}
                  alt={artist.name}
                  className="h-12 w-12 rounded-full object-cover"
                />
              )}
              <span className="text-lg font-black">{artist.name}</span>
            </div>
            {artist.bio && (
              <p className="mt-3 whitespace-pre-wrap text-sm text-[#9e8a55]">{artist.bio}</p>
            )}
          </section>

          {event.description && (
            <section className={card}>
              <h2 className="text-xs font-black tracking-[0.2em] text-[#9e8a55]">ABOUT</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm text-[#ede8d8]">{event.description}</p>
            </section>
          )}

          <section className={card}>
            <h2 className="text-xs font-black tracking-[0.2em] text-[#9e8a55]">POLICY</h2>
            {event.policy_text && (
              <p className="mt-3 whitespace-pre-wrap text-sm text-[#ede8d8]">
                {event.policy_text}
              </p>
            )}
            <p className="mt-3 text-xs text-[#9e8a55]">
              Refunds up to {event.refund_cutoff_hours}h before start · transfers up to{' '}
              {event.transfer_cutoff_hours}h before start.
            </p>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className={card}>
            <h2 className="text-xs font-black tracking-[0.2em] text-[#9e8a55]">WHEN</h2>
            {starts ? (
              <>
                <p className="mt-3 text-sm font-bold text-[#ede8d8]">{starts}</p>
                {ends && <p className="text-xs text-[#9e8a55]">until {ends}</p>}
                <p className="mt-1 text-xs text-[#9e8a55]">{event.timezone}</p>
                {event.starts_at && event.ends_at && (
                  <a
                    href={calendarUrl(event.title, event.starts_at, event.ends_at, event.timezone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block text-xs font-bold tracking-wider text-[#E8C456] hover:underline"
                  >
                    + Add to calendar
                  </a>
                )}
              </>
            ) : (
              <p className="mt-3 text-sm text-[#9e8a55]">Date to be announced.</p>
            )}
          </section>

          <CheckoutClient
            eventId={event.id}
            ticketTypes={ticketTypes}
            signedIn={!!user}
          />
        </div>
      </div>
      <div className="pb-10" />
    </div>
  )
}
