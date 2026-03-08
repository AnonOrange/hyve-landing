/**
 * HYVE relay WebSocket client.
 * Protocol:
 *   Subscribe: send 9 bytes = 0xFF + inboxPrefix[0:8]
 *   Send cell: send 512 raw bytes
 *   Receive: binary frames of 512 bytes
 */

const RELAY_URL = process.env.NEXT_PUBLIC_RELAY_URL || 'wss://hivecomms-production.up.railway.app'

export class RelayClient {
  private ws: WebSocket | null = null
  private inboxPrefix: Uint8Array | null = null
  private reconnectDelay = 1000
  private stopped = false

  onCell: ((cell: Uint8Array) => void) | null = null
  onConnect: (() => void) | null = null

  connect(inboxPrefix: Uint8Array): void {
    this.inboxPrefix = inboxPrefix
    this.stopped = false
    this._connect()
  }

  private _connect(): void {
    if (this.stopped) return
    try {
      const ws = new WebSocket(RELAY_URL)
      ws.binaryType = 'arraybuffer'
      this.ws = ws

      ws.onopen = () => {
        this.reconnectDelay = 1000
        if (this.inboxPrefix) this._subscribe(this.inboxPrefix)
        this.onConnect?.()
      }

      ws.onmessage = (e) => {
        if (e.data instanceof ArrayBuffer) {
          const cell = new Uint8Array(e.data)
          if (cell.length === 512) this.onCell?.(cell)
        }
      }

      ws.onclose = () => {
        if (!this.stopped) {
          setTimeout(() => {
            this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000)
            this._connect()
          }, this.reconnectDelay)
        }
      }

      ws.onerror = () => ws.close()
    } catch {
      // ignore — onclose will handle retry
    }
  }

  private _subscribe(prefix: Uint8Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const frame = new Uint8Array(9)
    frame[0] = 0xFF
    frame.set(prefix.slice(0, 8), 1)
    this.ws.send(frame)
  }

  sendCell(cell: Uint8Array): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(cell)
  }

  sendSwarm(cells: Uint8Array[]): void {
    for (const cell of cells) this.sendCell(cell)
  }

  disconnect(): void {
    this.stopped = true
    this.ws?.close()
    this.ws = null
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}
