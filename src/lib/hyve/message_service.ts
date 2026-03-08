/**
 * HYVE MessageService — orchestrates relay + X3DH + ratchet + swarm for text messaging.
 * Mirrors message_service.dart (text-only subset).
 */

import { RelayClient } from './network/relay'
import { lookupBundle, PeerBundle } from './network/hyve_id'
import { Identity, getInboxPrefix, getBootstrapKey, peerInboxPrefix } from './identity'
import { hkdf, fromHex, toHex, concat } from './crypto/hkdf'
import { assembleSwarm, tryReconstruct } from './crypto/swarm'
import { x3dhInitiate, x3dhRespond, X3DHHeader } from './crypto/x3dh'
import { initSenderRatchet, initReceiverRatchet, ratchetSend, ratchetReceive, RatchetState, serializeRatchet, deserializeRatchet } from './crypto/ratchet'
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
  firstMessageSent: boolean
  peerBundle: PeerBundle
}

export class MessageService {
  private relay = new RelayClient()
  private identity: Identity | null = null
  private sessions = new Map<string, Session>()

  onMessage: ((msg: HyveMessage) => void) | null = null

  /** Call after vault unlock. */
  async start(identity: Identity): Promise<void> {
    this.identity = identity
    const inboxPrefix = getInboxPrefix(identity)

    this.relay.onCell = (cell) => this._onCell(cell)
    this.relay.connect(inboxPrefix)
  }

  stop(): void {
    this.relay.disconnect()
    this.identity = null
    this.sessions.clear()
  }

  /** Send a text message to a peer (by hyveId). */
  async sendText(peerId: string, body: string): Promise<boolean> {
    if (!this.identity) return false
    const clean = peerId.trim().replace(/^@/, '')

    // Load or create session
    let session: Session | undefined = this.sessions.get(clean)
    if (!session) {
      const created = await this._createSession(clean)
      if (!created) return false
      session = created
    }

    // Build payload
    const { result: sendResult, nextState } = ratchetSend(session.ratchet)
    session.ratchet = nextState

    const payload: Record<string, unknown> = {
      v: 1,
      from: this.identity.hyveId,
      dh: toHex(sendResult.dhPub),
      type: 'text',
      body,
      ts: Date.now(),
    }

    // First message: embed X3DH header
    if (!session.firstMessageSent) {
      const ekPair = await this._freshEkFor(session.peerBundle)
      if (ekPair) {
        payload.x3dh = ekPair.header
      }
      session.firstMessageSent = true
    }

    // Get peer inbox prefix from their IK pub
    const peerIkPubBytes = fromHex(session.peerBundle.ikPub)
    const inboxPrefix = peerInboxPrefix(peerIkPubBytes)

    const cells = assembleSwarm(payload, sendResult.chainKey, inboxPrefix, sendResult.epoch)
    this.relay.sendSwarm(cells)

    // Persist session
    await dbPut('sessions', clean, serializeRatchet(session.ratchet))

    return true
  }

  private async _createSession(peerId: string): Promise<Session | null> {
    if (!this.identity) return null

    // Load persisted ratchet if available
    const savedRatchet = await dbGet<Record<string, unknown>>('sessions', peerId)

    let bundle = await lookupBundle(peerId)
    if (!bundle) return null

    let ratchet: RatchetState
    let firstMessageSent = false

    if (savedRatchet) {
      ratchet = deserializeRatchet(savedRatchet)
      firstMessageSent = true
    } else {
      // X3DH initiate
      const { sharedSecret } = x3dhInitiate(
        fromHex(this.identity.ikPriv),
        fromHex(this.identity.ikPub),
        bundle,
      )
      ratchet = initSenderRatchet(sharedSecret, fromHex(bundle.spkPub))
    }

    const session: Session = { convId: peerId, ratchet, firstMessageSent, peerBundle: bundle }
    this.sessions.set(peerId, session)
    return session
  }

  private async _freshEkFor(bundle: PeerBundle): Promise<{ header: X3DHHeader } | null> {
    if (!this.identity) return null
    const { header } = x3dhInitiate(
      fromHex(this.identity.ikPriv),
      fromHex(this.identity.ikPub),
      bundle,
    )
    return { header }
  }

  private _onCell(raw: Uint8Array): void {
    if (!this.identity) return

    // Try with bootstrap key first (unknown sender first message)
    const bootstrapKey = getBootstrapKey(this.identity)
    let decoded = tryReconstruct(raw, bootstrapKey)

    // Try all known session chain keys
    if (!decoded) {
      for (const [, session] of this.sessions) {
        decoded = tryReconstruct(raw, session.ratchet.recvChainKey)
        if (decoded) {
          // Advance receive ratchet
          const payload = decoded as Record<string, unknown>
          const dhPub = payload.dh ? fromHex(payload.dh as string) : null
          if (dhPub) {
            const { messageKey, nextState } = ratchetReceive(session.ratchet, dhPub)
            session.ratchet = nextState
            dbPut('sessions', session.convId, serializeRatchet(nextState))
          }
          break
        }
      }
    }

    if (!decoded) return

    const payload = decoded as Record<string, unknown>
    if (payload.type !== 'text') return

    // Handle X3DH session establishment if x3dh header present
    if (payload.x3dh && !this.sessions.has(payload.from as string)) {
      this._handleX3dhInit(payload)
    }

    const msg: HyveMessage = {
      id: `${Date.now()}-${Math.random()}`,
      convId: payload.from as string,
      from: payload.from as string,
      body: payload.body as string,
      ts: payload.ts as number || Date.now(),
      sent: false,
    }

    this.onMessage?.(msg)
  }

  private _handleX3dhInit(payload: Record<string, unknown>): void {
    if (!this.identity) return
    try {
      const header = payload.x3dh as X3DHHeader
      const opkPool = this.identity.opkPool.map(o => ({
        pub: fromHex(o.pub),
        priv: fromHex(o.priv),
      }))
      const sharedSecret = x3dhRespond(
        fromHex(this.identity.ikPriv),
        fromHex(this.identity.spkPriv),
        opkPool,
        header,
      )
      const ratchet = initReceiverRatchet(sharedSecret)
      const fromId = (payload.from as string).replace(/^@/, '')
      this.sessions.set(fromId, {
        convId: fromId,
        ratchet,
        firstMessageSent: true,
        peerBundle: {
          hyveId: fromId,
          ikPub: toHex(fromHex(header.ik.replace(/-/g, '+').replace(/_/g, '/'))),
          spkPub: '',
          spkSig: '',
        },
      })
    } catch {
      // ignore bad X3DH
    }
  }
}

// Singleton
export const messageService = new MessageService()
