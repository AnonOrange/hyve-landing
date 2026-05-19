// The real StreamProvider — Mux Live via the REST API. No SDK: a fetch call to
// create a live stream, and crypto HMAC to verify webhook signatures.
import { createHmac, timingSafeEqual } from 'crypto'
import type { LiveStream, StreamProvider } from '@/lib/attend/streaming/provider'

const MUX_API = 'https://api.mux.com/video/v1'
const MUX_RTMP_URL = 'rtmps://global-live.mux.com:443/app'

export class MuxStreamProvider implements StreamProvider {
  private authHeader(): string {
    const id = process.env.MUX_TOKEN_ID!
    const secret = process.env.MUX_TOKEN_SECRET!
    return `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`
  }

  async createLiveStream(): Promise<LiveStream> {
    const res = await fetch(`${MUX_API}/live-streams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: this.authHeader() },
      body: JSON.stringify({
        // Signed playback so only ticket-holders (issued a signed token) can
        // watch — live and the recording.
        playback_policy: ['signed'],
        new_asset_settings: { playback_policy: ['signed'] },
        latency_mode: 'low',
        reconnect_window: 60,
      }),
    })
    if (!res.ok) {
      throw new Error(`Mux create live-stream failed: ${res.status} ${await res.text()}`)
    }
    const { data } = (await res.json()) as {
      data: { id: string; stream_key: string; playback_ids: { id: string }[] }
    }
    return {
      streamId: data.id,
      playbackId: data.playback_ids[0].id,
      streamKey: data.stream_key,
      rtmpUrl: MUX_RTMP_URL,
    }
  }

  // Mux signs webhooks as `Mux-Signature: t=<unix>,v1=<hex hmac-sha256>` over
  // `${t}.${rawBody}` — the same scheme Stripe uses.
  verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
    const secret = process.env.MUX_WEBHOOK_SECRET
    if (!secret || !signature) return false
    const parts = Object.fromEntries(
      signature.split(',').map((p) => {
        const eq = p.indexOf('=')
        return [p.slice(0, eq), p.slice(eq + 1)]
      }),
    ) as Record<string, string>
    const { t, v1 } = parts
    if (!t || !v1) return false
    const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex')
    const a = Buffer.from(v1)
    const b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b)
  }
}
