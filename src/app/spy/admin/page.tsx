import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import AdminClient from './AdminClient'

const COMP_EMAILS = new Set([
  'vibesoftwaresolutions@gmail.com',
  'luckybstudios@gmail.com',
])

const API = 'https://hyve-api.vercel.app'

async function fetchAdmin(path: string) {
  const r = await fetch(`${API}/admin/${path}`, {
    headers: { 'X-Agent-Secret': process.env.HYVE_API_AGENT_SECRET || '' },
    cache: 'no-store',
  })
  if (!r.ok) return null
  return r.json()
}

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Hyve Spy — Admin' }

export default async function AdminPage() {
  // Auth: must have a comp:<email> session cookie AND the email must be in the allowlist
  const session = cookies().get('hyve_spy_session')?.value || ''
  const email = session.startsWith('comp:')
    ? decodeURIComponent(session.slice('comp:'.length)).toLowerCase()
    : null
  if (!email || !COMP_EMAILS.has(email)) {
    redirect('/spy/login?return_url=https%3A%2F%2Fwww.hyveapp.co%2Fspy%2Fadmin')
  }

  const [dashboard, queueRes] = await Promise.all([
    fetchAdmin('dashboard'),
    fetchAdmin('queue'),
  ])

  if (!dashboard) {
    return (
      <main className="min-h-screen bg-[#020D14] p-8 text-[#E2E8F0]">
        <div className="mx-auto max-w-3xl rounded-lg border border-[#FF2D2D] bg-[#FF2D2D]/10 p-6">
          <div className="text-sm font-bold text-[#FF2D2D]">Admin API unreachable</div>
          <div className="mt-2 text-xs text-[#94A3B8]">
            hyve-api/admin returned no data — check that <code>HYVE_API_AGENT_SECRET</code> in
            hyve-landing env matches <code>AGENT_SECRET</code> in hyve-api env.
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#020D14] pb-12 text-[#E2E8F0]">
      <header className="border-b border-[#0D2235] px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <div className="text-[10px] font-black tracking-[0.4em] text-[#00D4FF]">HYVE SPY · ADMIN</div>
            <div className="mt-1 font-mono text-[10px] text-[#475569]">signed in as {email}</div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/spy/admin/recon" className="rounded border border-[#FF2D2D] bg-[#FF2D2D]/10 px-3 py-1 text-[10px] font-bold tracking-widest text-[#FF2D2D] hover:bg-[#FF2D2D]/20">
              RECON →
            </a>
            <a href="/spy/app" className="text-[10px] font-bold tracking-widest text-[#64748B] hover:text-[#E2E8F0]">
              ← BACK TO APP
            </a>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl p-6">
        <AdminClient initial={dashboard} queue={queueRes?.candidates || []} />
      </div>
    </main>
  )
}
