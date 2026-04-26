import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import dynamic from 'next/dynamic'

const ReconMapView = dynamic(() => import('./ReconMapView'), { ssr: false })

const COMP_EMAILS = new Set([
  'vibesoftwaresolutions@gmail.com',
  'luckybstudios@gmail.com',
])

const SUPA_URL = process.env.SUPABASE_URL
const SUPA_SERVICE = process.env.SUPABASE_SERVICE_KEY

async function fetchRecon() {
  if (!SUPA_URL || !SUPA_SERVICE) return []
  const r = await fetch(
    `${SUPA_URL}/rest/v1/cameras?region=eq.recon&is_active=eq.true&select=id,label,agency,feed_url,feed_type,lat,lng,state,county,confidence&limit=10000`,
    {
      headers: { apikey: SUPA_SERVICE, Authorization: `Bearer ${SUPA_SERVICE}` },
      cache: 'no-store',
    },
  )
  if (!r.ok) return []
  const rows = await r.json()
  return rows.map((r: any) => ({
    id: r.id,
    label: r.label,
    agency: r.agency,
    feedUrl: r.feed_url,
    feedType: r.feed_type,
    lat: r.lat,
    lng: r.lng,
    state: r.state,
    county: r.county,
  }))
}

export const dynamic_ = 'force-dynamic'
export const metadata = { title: 'Hyve Spy — Admin Recon' }

export default async function AdminReconPage() {
  // Auth: comp email allowlist (admin-only)
  const session = cookies().get('hyve_spy_session')?.value || ''
  const email = session.startsWith('comp:')
    ? decodeURIComponent(session.slice('comp:'.length)).toLowerCase()
    : null
  if (!email || !COMP_EMAILS.has(email)) {
    redirect('/spy/login?return_url=https%3A%2F%2Fwww.hyveapp.co%2Fspy%2Fadmin%2Frecon')
  }

  const cams = await fetchRecon()

  return (
    <main className="min-h-screen bg-[#020D14] pb-12 text-[#E2E8F0]">
      <header className="border-b border-[#0D2235] px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <div className="text-[10px] font-black tracking-[0.4em] text-[#FF2D2D]">HYVE SPY · ADMIN · RECON</div>
            <div className="mt-1 font-mono text-[10px] text-[#475569]">
              signed in as {email} · {cams.length.toLocaleString()} unsecured cams
            </div>
          </div>
          <div className="flex gap-2">
            <a href="/spy/admin" className="rounded border border-[#0D2235] px-3 py-1 text-[10px] font-bold text-[#64748B] hover:text-[#E2E8F0]">
              ← ADMIN HOME
            </a>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-4 p-6">
        <div className="rounded-lg border border-[#FF2D2D]/40 bg-[#FF2D2D]/5 p-4 text-xs text-[#FF2D2D]">
          <div className="mb-1 font-black tracking-widest">⚠ INTERNAL USE ONLY</div>
          <p className="text-[#94A3B8]">
            These cameras are publicly accessible due to default credentials, missing auth, or owner misconfiguration.
            Content is for security research and curation only — do not share, screenshot, or publish.
            Cameras viewed here may show private spaces; close immediately if so.
          </p>
        </div>

        {cams.length === 0 ? (
          <div className="rounded-lg border border-[#0D2235] bg-black/30 p-6 text-center">
            <div className="text-sm font-bold text-[#94A3B8]">Recon database empty.</div>
            <p className="mt-2 text-xs text-[#475569]">
              Insecam aggressively blocks scrapers (their servers refused all of our scrape attempts from
              this network). To populate this view: paste recon URLs manually via SQL into the
              <code className="mx-1 rounded bg-black/60 px-1 font-mono">cameras</code> table with
              <code className="mx-1 rounded bg-black/60 px-1 font-mono">region=&apos;recon&apos;</code>,
              or wire in a Shodan API key (paid).
            </p>
          </div>
        ) : (
          <ReconMapView initial={cams} />
        )}
      </div>
    </main>
  )
}
