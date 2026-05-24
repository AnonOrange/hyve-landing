// HYVE Attend shell layout. Owns the Attend product's chrome. Auth gating
// for nested segments (creator, attendee, admin) is added in later phases
// here and in nested layouts — never in the shared src/middleware.ts.

import AttendNav from './_components/attend-nav'
import AttendFooter from './_components/attend-footer'

export const metadata = {
  title: 'HYVE Attend — Live events, browser-first',
  description:
    'Discover and attend live performances. Buy tickets, transfer them, and join the show from your browser.',
}

export default function AttendLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#08111e] font-sans text-[#ede8d8]">
      <AttendNav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 pb-16">{children}</main>
      <AttendFooter />
    </div>
  )
}
