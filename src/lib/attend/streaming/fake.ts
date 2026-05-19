// The fake StreamProvider — deterministic-shaped values, no network. Used in
// dev/CI and whenever Mux credentials are absent.
import { randomBytes } from 'crypto'
import type { LiveStream, StreamProvider } from '@/lib/attend/streaming/provider'

export class FakeStreamProvider implements StreamProvider {
  async createLiveStream(): Promise<LiveStream> {
    const id = randomBytes(8).toString('hex')
    return {
      streamId: `fake-stream-${id}`,
      playbackId: `fake-playback-${id}`,
      streamKey: `fake-key-${id}`,
      rtmpUrl: 'rtmp://fake.local/app',
    }
  }

  verifyWebhookSignature(): boolean {
    return true
  }

  async signPlaybackToken(playbackId: string): Promise<string> {
    return `fake-token-${playbackId}`
  }
}
