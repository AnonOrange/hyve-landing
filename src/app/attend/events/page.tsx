// /attend/events — buyer discovery: hero banner, featured row, live now, upcoming.
import Image from 'next/image'
import { getDiscoveryFeed } from '@/lib/attend/discovery/discovery-service'
import DiscoveryClient from './discovery-client'

export const metadata = { title: 'Events — HYVE Attend' }
export const dynamic = 'force-dynamic'

export default async function AttendEvents() {
  const { featured, live, upcoming } = await getDiscoveryFeed()
  return (
    <>
      <section className="relative -mx-6 mb-8 overflow-hidden sm:rounded-2xl sm:mx-0">
        <Image
          src="/attend/backgrounds/bg-2.png"
          alt=""
          width={1920}
          height={600}
          priority
          className="h-[220px] w-full object-cover md:h-[280px]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#08111e] via-[#08111e]/70 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#E8C456]">
            EVENTS
          </p>
          <h1 className="mt-2 text-3xl font-black text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.6)] md:text-5xl">
            Live events, browser-first.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/85 md:text-base">
            Discover live performances and join the show from any browser.
          </p>
        </div>
      </section>
      <DiscoveryClient featured={featured} live={live} upcoming={upcoming} />
    </>
  )
}
