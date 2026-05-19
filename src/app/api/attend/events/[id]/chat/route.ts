import { NextRequest, NextResponse } from 'next/server'
import { requireAttendUser } from '@/lib/attend/identity/roles'
import { getProfileById } from '@/lib/attend/identity/profile-repository'
import { postChatMessage, getRecentChat } from '@/lib/attend/live/chat-service'
import { ValidationError } from '@/lib/attend/events/service'

export const runtime = 'nodejs'

// GET /api/attend/events/[id]/chat — the recent visible chat backlog.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAttendUser()
  if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 })
  try {
    return NextResponse.json({ messages: await getRecentChat(params.id) })
  } catch (err) {
    console.error('[attend chat] list:', (err as Error).message)
    return NextResponse.json({ error: 'Failed to load chat' }, { status: 500 })
  }
}

// POST /api/attend/events/[id]/chat — send a chat message. Body: { body }.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAttendUser()
  if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 })

  let body: { body?: unknown }
  try {
    body = (await req.json()) as { body?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (typeof body.body !== 'string') {
    return NextResponse.json({ error: 'A message is required' }, { status: 400 })
  }

  try {
    const profile = await getProfileById(user.id)
    // Fall back to the de-identified handle (the same one ensureProfile sets),
    // never the raw email — the message rides an open broadcast channel.
    const displayName = profile?.display_name ?? user.email.split('@')[0]
    await postChatMessage(params.id, user.id, displayName, body.body)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[attend chat] post:', (err as Error).message)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
