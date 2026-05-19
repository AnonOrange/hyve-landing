import { notFound } from 'next/navigation'
import { getEventPage } from '@/lib/attend/discovery/discovery-service'
import { formatUsd } from '@/lib/attend/money'

export const dynamic = 'force-dynamic'

const humanize = (s: string) =>
  s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/_/g, ' ')

const fmtWhen = (iso: string | null) => (iso ? iso.slice(0, 16).replace('T', ' ') : null)

// Wall-clock ISO text (YYYY-MM-DDTHH:MM…) -> Google Calendar's YYYYMMDDTHHMMSSZ.
const calDate = (iso: string) => `${iso.slice(0, 16).replace(/[-:]/g, '')}00Z`

function calendarUrl(title: string, startsAt: string, endsAt: string): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${calDate(startsAt)}/${calDate(endsAt)}`,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

const card = 'rounded border border-[#2a2135] bg-[#111111] px-4 py-4'

export default async function EventPage({ params }: { params: { slug: string } }) {
  const data = await getEventPage(params.slug)
  if (!data) notFound()
  const { event, ticketTypes, artist } = data
  const starts = fmtWhen(event.starts_at)
  const ends = fmtWhen(event.ends_at)

  return (
    <div className="py-10">
      {/* Placeholder hero — hero media (image/video) is a later phase. */}
      <div className="rounded-lg bg-gradient-to-br from-[#2a2135] to-[#08070a] px-6 py-16 sm:py-24">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#9e8a55]">
          {humanize(event.show_type)}
        </span>
        <h1 className="mt-2 text-3xl font-black md:text-5xl">{event.title}</h1>
        <p className="mt-2 font-mono text-[11px] tracking-widest text-[#E8C456]">
          {humanize(event.status)}
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
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
                    href={calendarUrl(event.title, event.starts_at, event.ends_at)}
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

          <section className={card}>
            <h2 className="text-xs font-black tracking-[0.2em] text-[#9e8a55]">TICKETS</h2>
            {ticketTypes.length === 0 ? (
              <p className="mt-3 text-sm text-[#9e8a55]">Tickets not yet listed.</p>
            ) : (
              <>
                <ul className="mt-3 flex flex-col gap-2">
                  {ticketTypes.map((tt) => (
                    <li
                      key={tt.id}
                      className="flex items-center justify-between gap-3 rounded border border-[#2a2135] px-3 py-2"
                    >
                      <div>
                        <span className="text-sm font-bold">{tt.name}</span>
                        {tt.status === 'SOLD_OUT' && (
                          <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-red-400">
                            Sold out
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-sm text-[#E8C456]">
                        {formatUsd(tt.price_cents)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] text-[#9e8a55]">
                  All prices are final — no fees are added at checkout.
                </p>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
