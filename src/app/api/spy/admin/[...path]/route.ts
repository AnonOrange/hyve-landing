import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const COMP_EMAILS = new Set([
  'vibesoftwaresolutions@gmail.com',
  'luckybstudios@gmail.com',
])

const API = 'https://hyve-api.vercel.app'

// Same-origin proxy for /admin/* on hyve-api. Adds the agent secret server-side
// (so the browser never sees it) and gates access to comp emails.
function authorize() {
  const c = cookies()
  const session = c.get('hyve_spy_session')?.value || ''
  if (!session.startsWith('comp:')) return null
  const email = decodeURIComponent(session.slice('comp:'.length)).toLowerCase()
  if (!COMP_EMAILS.has(email)) return null
  return email
}

async function proxy(req: NextRequest, ctx: { params: { path: string[] } }) {
  const email = authorize()
  if (!email) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const sub = (ctx.params.path || []).join('/')
  const url = `${API}/admin/${sub}${req.nextUrl.search}`
  const init: RequestInit = {
    method: req.method,
    headers: {
      'X-Agent-Secret': process.env.HYVE_API_AGENT_SECRET || '',
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  }
  if (req.method === 'POST' || req.method === 'PUT') {
    init.body = await req.text()
  }
  const res = await fetch(url, init)
  const body = await res.text()
  return new NextResponse(body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
  })
}

export const GET = proxy
export const POST = proxy
export const dynamic = 'force-dynamic'
