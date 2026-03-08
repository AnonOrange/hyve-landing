/**
 * HYVE MessageService — orchestrates relay + X3DH + ratchet + swarm for text messaging.
 * Mirrors message_service.dart (text-only subset).
 */

import { RelayClient } from './network/relay'
import { lookupBundle, PeerBundle } from './network/hyve_id'
import { Identity, getInboxPrefix, peerInboxPrefix } from './identity'
import { hkdf, fromHex, toHex, fromBase64url, toBase64url } from './crypto/hkdf'
import { assembleSwarm, tryReconstruct } from './crypto/swarm'
import { x3dhInitiate, x3dhRespond, X3DHHeader } from './crypto/x3dh'
import {
  initSenderRatchet, initReceiverRatchet,
  ratchetSend, ratchetReceive,
  RatchetState, serializeRatchet, deserializeRatchet,
} from './crypto/ratchet'
import { dbGet, dbPut } from './storage/db'

export interface HyveMessage {
  id: string
  convId: string    // peer hyveId
  from: string
  body: string
  ts: number
  sent: boolean     // true if we sent it
}

export interface HyveConversation {
  peerId: string
  peerIkPub: string   // hex — needed for inbox routing
}

interface Session {
  convId: string
  ratchet: RatchetState
  peerBundle: PeerBundle
  peerIkPub: string            // hex
  peerSpkPub: string           // hex (empty for Bob-side sessions)
  pendingX3dhHeader: X3DHHeader | null
  usesIkBootstrapForFirstSend: boolean
}

interface TextChunkBuffer {
  totalChunks: number
  chunks: (string | null)[]
  receivedCount: number
}

export class MessageService {
  private relay = new RelayClient()
  private identity: Identity | null = null
  private sessions = new Map<string, Session>()
  private textBuffers = new Map<string, TextChunkBuffer>()
  private _bootstrapKey: Uint8Array | null = null       // HKDF(spkPub, 'HYVE Bootstrap v1.0')
  private _bootstrapKeyFromIk: Uint8Array | null = null // HKDF(ikPub,  'HYVE Bootstrap v1.0')

  onMessage: ((msg: HyveMessage) => void) | null = null

  /** Call after vault unlock. */
  async start(identity: Identity): Promise<void> {
    this.identity = identity
    this._bootstrapKey      = hkdf(fromHex(identity.spkPub), 'HYVE Bootstrap v1.0', 32)
    this._bootstrapKeyFromIk = hkdf(fromHex(identity.ikPub),  'HYVE Bootstrap v1.0', 32)
    const inboxPrefix = getInboxPrefix(identity)
    this.relay.onCell = (cell) => this._onCell(cell)
    this.relay.connect(inboxPrefix)
  }

  stop(): void {
    this.relay.disconnect()
    this.identity = null
    this.sessions.clear()
    this.textBuffers.clear()
    this._bootstrapKey       = null
    this._bootstrapKeyFromIk = null
  }

  /** Send a text message to a peer (by hyveId). */
  async sendText(peerId: string, body: string): Promise<boolean> {
    if (!this.identity) return false
    const clean = peerId.trim().replace(/^@/, '')

    let session: Session | undefined = this.sessions.get(clean)
    if (!session) {
      const created = await this._createSession(clean)
      if (!created) return false
      session = created
    }

    // Flush the X3DH handshake via a separate 'hs' swarm before first text
    await this._ensureSessionEstablished(session)

    const { result: sendResult, nextState } = ratchetSend(session.ratchet)
    session.ratchet = nextState

    const payload: Record<string, unknown> = {
      v: 1,
      from: this.identity.hyveId,
      dh: toBase64url(sendResult.dhPub),
      type: 'text',
      body,
      ts: Date.now(),
    }

    const peerIkPubBytes = fromHex(session.peerIkPub)
    const inboxPrefix    = peerInboxPrefix(peerIkPubBytes)
    const cells = assembleSwarm(payload, sendResult.chainKey, inboxPrefix, sendResult.epoch)
    this.relay.sendSwarm(cells)

    await dbPut('sessions', clean, serializeRatchet(session.ratchet))
    return true
  }

  /**
   * Send a silent 'hs' swarm containing the X3DH header (Alice→Bob first contact),
   * or a silent 'hs' swarm using the IK-bootstrap key (Bob→Alice first reply).
   * Mirrors _ensureSessionEstablished in message_service.dart.
   */
  private async _ensureSessionEstablished(session: Session): Promise<void> {
    if (!session.pendingX3dhHeader && !session.usesIkBootstrapForFirstSend) return
    if (!this.identity) return

    const { result: sendResult, nextState } = ratchetSend(session.ratchet)
    session.ratchet = nextState

    const hsPayload: Record<string, unknown> = {
      v: 1,
      from: this.identity.hyveId,
      dh: toBase64url(sendResult.dhPub),
      type: 'hs',
    }

    let cellChainKey: Uint8Array

    if (session.pendingX3dhHeader) {
      // Alice→Bob: bootstrap key = HKDF(peerSpkPub, 'HYVE Bootstrap v1.0')
      hsPayload.x3dh = session.pendingX3dhHeader
      session.pendingX3dhHeader = null
      cellChainKey = hkdf(fromHex(session.peerSpkPub), 'HYVE Bootstrap v1.0', 32)
    } else {
      // Bob→Alice: bootstrap key = HKDF(peerIkPub, 'HYVE Bootstrap v1.0')
      session.usesIkBootstrapForFirstSend = false
      cellChainKey = hkdf(fromHex(session.peerIkPub), 'HYVE Bootstrap v1.0', 32)
    }

    const peerIkPubBytes = fromHex(session.peerIkPub)
    const inboxPrefix    = peerInboxPrefix(peerIkPubBytes)
    const cells = assembleSwarm(hsPayload, cellChainKey, inboxPrefix, sendResult.epoch)
    this.relay.sendSwarm(cells)
  }

  private async _createSession(peerId: string): Promise<Session | null> {
    if (!this.identity) return null

    const savedRatchet = await dbGet<Record<string, unknown>>('sessions', peerId)
    const bundle = await lookupBundle(peerId)
    if (!bundle) return null

    let ratchet: RatchetState
    let pendingX3dhHeader: X3DHHeader | null = null

    if (savedRatchet) {
      ratchet = deserializeRatchet(savedRatchet)
    } else {
      // X3DH initiate — single call; store header for _ensureSessionEstablished
      const { sharedSecret, header } = x3dhInitiate(
        fromHex(this.identity.ikPriv),
        fromHex(this.identity.ikPub),
        bundle,
      )
      ratchet = initSenderRatchet(sharedSecret, fromHex(bundle.spkPub))
      pendingX3dhHeader = header
    }

    const session: Session = {
      convId: peerId,
      ratchet,
      peerBundle: bundle,
      peerIkPub: bundle.ikPub,
      peerSpkPub: bundle.spkPub,
      pendingX3dhHeader,
      usesIkBootstrapForFirstSend: false,
    }
    this.sessions.set(peerId, session)
    return session
  }

  private _onCell(raw: Uint8Array): void {
    if (!this.identity) return

    let decoded: object | null = null
    let matchedSession: Session | null = null

    // 1. Try all known session recv chain keys
    for (const [, session] of this.sessions) {
      decoded = tryReconstruct(raw, session.ratchet.recvChainKey)
      if (decoded) { matchedSession = session; break }
    }

    // 2. Try SPK bootstrap key (Alice→Bob first contact)
    if (!decoded && this._bootstrapKey) {
      decoded = tryReconstruct(raw, this._bootstrapKey)
    }

    // 3. Try IK bootstrap key (Bob→Alice first reply)
    if (!decoded && this._bootstrapKeyFromIk) {
      const candidate = tryReconstruct(raw, this._bootstrapKeyFromIk)
      if (candidate) {
        decoded = candidate
        const from = ((candidate as Record<string, unknown>).from as string || '').replace(/^@/, '')
        matchedSession = this.sessions.get(from) || null
      }
    }

    if (!decoded) return

    const payload = decoded as Record<string, unknown>
    const type    = payload.type as string

    // Handle X3DH session establishment before ratchet advance
    if (payload.x3dh) {
      const fromId = (payload.from as string || '').replace(/^@/, '')
      if (!this.sessions.has(fromId)) {
        this._handleX3dhInit(payload)
        matchedSession = this.sessions.get(fromId) || null
      }
    }

    // Advance receive ratchet for known sessions
    if (matchedSession) {
      const dhHex = payload.dh as string | undefined
      if (dhHex) {
        const dhPub = fromBase64url(dhHex)
        const { nextState } = ratchetReceive(matchedSession.ratchet, dhPub)
        matchedSession.ratchet = nextState
        dbPut('sessions', matchedSession.convId, serializeRatchet(nextState))
      }
    }

    // Silent handshake — no message to surface
    if (type === 'hs') return
    if (type !== 'text') return

    const from = (payload.from as string || '').replace(/^@/, '')
    const body = (payload.body as string) || ''
    const mid  = payload.mid as string | undefined
    const i    = payload.i   as number | undefined
    const t    = payload.t   as number | undefined

    // Multi-chunk text reassembly
    if (mid !== undefined && t !== undefined && t > 1 && i !== undefined && i >= 0 && i < t) {
      const bufKey = `${from}_${mid}`
      let buf = this.textBuffers.get(bufKey)
      if (!buf) {
        buf = { totalChunks: t, chunks: new Array<string | null>(t).fill(null), receivedCount: 0 }
        this.textBuffers.set(bufKey, buf)
      }
      if (buf.chunks[i] === null) {
        buf.chunks[i] = body
        buf.receivedCount++
      }
      if (buf.receivedCount === buf.totalChunks) {
        this.textBuffers.delete(bufKey)
        const fullBody = buf.chunks.join('')
        if (fullBody) {
          this.onMessage?.({
            id: `${mid}_r`,
            convId: from,
            from,
            body: fullBody,
            ts: (payload.ts as number) || Date.now(),
            sent: false,
          })
        }
      }
      return
    }

    if (!body) return
    this.onMessage?.({
      id: `${Date.now()}-${Math.random()}`,
      convId: from,
      from,
      body,
      ts: (payload.ts as number) || Date.now(),
      sent: false,
    })
  }

  private _handleX3dhInit(payload: Record<string, unknown>): void {
    if (!this.identity) return
    try {
      const header  = payload.x3dh as X3DHHeader
      const opkPool = this.identity.opkPool.map(o => ({
        pub:  fromHex(o.pub),
        priv: fromHex(o.priv),
      }))
      const sharedSecret = x3dhRespond(
        fromHex(this.identity.ikPriv),
        fromHex(this.identity.spkPriv),
        opkPool,
        header,
      )
      const ratchet = initReceiverRatchet(sharedSecret)
      const fromId  = (payload.from as string).replace(/^@/, '')

      // Fix: use fromBase64url() — X3DH header fields are base64url-encoded, not hex.
      // Old code: fromHex(header.ik.replace(/-/g,'+').replace(/_/g,'/')) → garbage output.
      const peerIkPub = toHex(fromBase64url(header.ik))

      this.sessions.set(fromId, {
        convId: fromId,
        ratchet,
        pendingX3dhHeader: null,
        peerSpkPub: '',
        peerIkPub,
        usesIkBootstrapForFirstSend: true,  // Bob's first reply uses IK bootstrap key
        peerBundle: { hyveId: fromId, ikPub: peerIkPub, spkPub: '', spkSig: '' },
      })
    } catch {
      // ignore malformed X3DH
    }
  }
}

// Singleton
export const messageService = new MessageService()
