import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireReviewer } from '@/lib/attend/identity/roles'
import { PageHero } from '@/app/attend/_components/page-hero'

export const dynamic = 'force-dynamic'

const navLink = 'text-[#9e8a55] transition hover:text-[#E8C456]'

// Server-side gate for the Attend back office — ADMIN/REVIEWER only,
// independent of the umbrella /admin. A non-reviewer is bounced silently.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const reviewer = await requireReviewer()
  if (!reviewer) redirect('/attend')

  return (
    <>
      <PageHero
        bg="/attend/backgrounds/bg-2.png"
        eyebrow="Attend Admin"
        title="Refunds backed by evidence. Disputes responded to."
        subtitle="Approve events for publishing, decide refund requests, and submit dispute evidence packets."
        meta={
          <span className="font-mono text-[10px] tracking-widest text-[#E8C456] backdrop-blur">
            {reviewer.role}
          </span>
        }
      />
      <div className="py-8">
        <nav className="flex gap-4 border-b border-[#2a2135] pb-2 text-xs font-bold">
          <Link href="/attend/admin" className={navLink}>
            Event review
          </Link>
          <Link href="/attend/admin/refunds" className={navLink}>
            Refunds
          </Link>
          <Link href="/attend/admin/disputes" className={navLink}>
            Disputes
          </Link>
          <Link href="/attend/admin/sponsors" className={navLink}>
            Sponsors
          </Link>
        </nav>
        <div className="mt-6">{children}</div>
      </div>
    </>
  )
}
