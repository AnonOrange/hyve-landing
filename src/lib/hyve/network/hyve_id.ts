/** HYVE-ID HTTP client — mirrors hyve_id_client.dart */

const BASE_URL = process.env.NEXT_PUBLIC_ID_URL || 'https://genuine-wisdom-production.up.railway.app'

export interface PeerBundle {
  hyveId: string
  ikPub: string     // hex
  spkPub: string    // hex
  spkSig: string    // hex
  opk?: string      // hex (single OPK returned by server, consumed on use)
}

export interface PublicBundle {
  hyveId: string
  ikPub: string
  spkPub: string
  spkSig: string
  opkBundle: string[]   // array of hex OPK public keys
}

export async function lookupBundle(hyveId: string): Promise<PeerBundle | null> {
  const clean = hyveId.trim().replace(/^@/, '')
  try {
    const res = await fetch(`${BASE_URL}/v1/bundle/${clean}`)
    if (!res.ok) return null
    return await res.json() as PeerBundle
  } catch {
    return null
  }
}

export async function publishBundle(bundle: PublicBundle): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/v1/bundle`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bundle),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function hyveIdExists(hyveId: string): Promise<boolean> {
  const clean = hyveId.trim().replace(/^@/, '')
  try {
    const res = await fetch(`${BASE_URL}/v1/bundle/${clean}`)
    return res.ok
  } catch {
    return false
  }
}
