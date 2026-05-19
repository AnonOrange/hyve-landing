// Server-side Supabase Realtime broadcast — delivers a live event to every
// browser subscribed to a room's channel. The durable record is the DB row;
// this is only the live wire, so a failed broadcast is logged and swallowed
// (clients reconcile from the table on reload).

export async function broadcastToRoom(
  eventId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const key = process.env.SUPABASE_SERVICE_KEY
  const base = process.env.SUPABASE_URL
  if (!key || !base) {
    console.error('[attend broadcast] SUPABASE_URL / SUPABASE_SERVICE_KEY not set')
    return
  }

  try {
    const res = await fetch(`${base}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: [{ topic: `attend-room-${eventId}`, event, payload }],
      }),
    })
    if (!res.ok) {
      console.error(`[attend broadcast] ${event} failed: ${res.status}`)
    }
  } catch (err) {
    console.error('[attend broadcast] error:', (err as Error).message)
  }
}
