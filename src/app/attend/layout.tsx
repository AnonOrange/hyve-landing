// HYVE Attend shell layout. Owns the Attend product's chrome. Auth gating
// for nested segments (creator, attendee, admin) is added in later phases
// here and in nested layouts — never in the shared src/middleware.ts.

import Link from 'next/link'

export const metadata = {
  title: 'HYVE Attend — Live events, browser-first',
  description:
    'Discover and attend live performances. Buy tickets, transfer them, and join the show from your browser.',
}

export default function AttendLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#08111e] font-sans text-[#ede8d8]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link href="/attend" className="text-sm font-black tracking-[0.3em] text-[#E8C456]">
          HYVE ATTEND
        </Link>
        <nav className="flex gap-5 text-xs font-bold tracking-[0.2em] text-[#9e8a55]">
          <Link href="/attend/events" className="hover:text-[#E8C456]">DISCOVER</Link>
          <Link href="/attend/wallet" className="hover:text-[#E8C456]">WALLET</Link>
          <Link href="/attend/creator" className="hover:text-[#E8C456]">CREATE</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 pb-24">{children}</main>
    </div>
  )
}
