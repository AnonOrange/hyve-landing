// HYVE Attend streaming — the StreamProvider boundary (spec §4.5). A real Mux
// implementation and a fake; the fake is selected unless Mux is configured, so
// the build and test suite run offline.
import { FakeStreamProvider } from '@/lib/attend/streaming/fake'
import { MuxStreamProvider } from '@/lib/attend/streaming/mux'

export interface LiveStream {
  streamId: string
  playbackId: string
  streamKey: string
  rtmpUrl: string
}

export interface StreamProvider {
  createLiveStream(): Promise<LiveStream>
  // Verify a provider webhook's signature over the raw request body.
  verifyWebhookSignature(rawBody: string, signature: string | null): boolean
}

/** The real Mux provider when credentials are configured, otherwise the fake. */
export function streamProvider(): StreamProvider {
  if (process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET) {
    return new MuxStreamProvider()
  }
  return new FakeStreamProvider()
}
