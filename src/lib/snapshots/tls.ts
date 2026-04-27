// src/lib/snapshots/tls.ts
//
// Node.js only — uses node:tls. Cannot run on Edge runtime.

import tls from 'node:tls'

export interface TlsResult {
  expiresAt: number
  daysLeft: number
  issuer: string
}

export interface TlsSnapshot {
  hyveapp: TlsResult | { error: string }
  ts: number
}

function checkCert(host: string): Promise<TlsResult> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port: 443, servername: host, timeout: 8_000 }, () => {
      const cert = socket.getPeerCertificate()
      socket.end()
      if (!cert?.valid_to) return reject(new Error('No certificate'))
      const expiresAt = new Date(cert.valid_to).getTime()
      const daysLeft = Math.floor((expiresAt - Date.now()) / 86_400_000)
      const issuer = (cert.issuer?.O as string | undefined) ?? 'unknown'
      resolve({ expiresAt, daysLeft, issuer })
    })
    socket.on('error', reject)
    socket.on('timeout', () => { socket.destroy(); reject(new Error('TLS timeout')) })
  })
}

export async function snapshotTls(): Promise<TlsSnapshot> {
  try {
    const result = await checkCert('hyveapp.co')
    return { hyveapp: result, ts: Date.now() }
  } catch (err) {
    return { hyveapp: { error: (err as Error).message }, ts: Date.now() }
  }
}
