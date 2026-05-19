import { redirect } from 'next/navigation'
import { requireReviewer } from '@/lib/attend/identity/roles'

export const dynamic = 'force-dynamic'

// Server-side gate for the Attend back office — ADMIN/REVIEWER only,
// independent of the umbrella /admin. A non-reviewer is bounced silently.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const reviewer = await requireReviewer()
  if (!reviewer) redirect('/attend')

  return (
    <div className="py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Attend admin</h1>
        <span className="font-mono text-[10px] tracking-widest text-[#E8C456]">
          {reviewer.role}
        </span>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  )
}
