// src/lib/snapshots/github.ts
//
// APK download counts from public GitHub release assets. No auth needed.

export interface ApkDownloadsSnapshot {
  total: number
  releases: { tag: string; count: number }[]
  ts: number
}

interface GhAsset   { name: string; download_count: number }
interface GhRelease { tag_name: string; assets: GhAsset[] }

export async function snapshotApkDownloads(repo = 'AnonOrange/hyve-landing'): Promise<ApkDownloadsSnapshot> {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases`, {
    headers: { Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(8_000),
  })
  if (!res.ok) throw new Error(`GitHub API returned ${res.status}`)

  const releases = await res.json() as GhRelease[]
  let total = 0
  const out: { tag: string; count: number }[] = []

  for (const r of releases) {
    const apk = r.assets.find((a) => a.name.endsWith('.apk'))
    const count = apk?.download_count ?? 0
    out.push({ tag: r.tag_name, count })
    total += count
  }

  return { total, releases: out, ts: Date.now() }
}
