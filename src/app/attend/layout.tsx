// HYVE Attend shell layout. Owns the Attend product's chrome. Auth gating
// for nested segments (creator, attendee, admin) is added in later phases
// here and in nested layouts — never in the shared src/middleware.ts.

import AttendNav from './_components/attend-nav'

export const metadata = {
  title: 'HYVE Attend — Live events, browser-first',
  description:
    'Discover and attend live performances. Buy tickets, transfer them, and join the show from your browser.',
}

export default function AttendLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#08111e] font-sans text-[#ede8d8]">
      <AttendNav />
      <main className="mx-auto max-w-7xl px-6 pb-24">{children}</main>
    </div>
  )
}
