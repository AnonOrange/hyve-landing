// Type definitions + helpers for the in-app Hyve Sleuth scanner.
//
// Mirrors the sleuth_* Supabase tables (migration 004) and the data shapes
// produced by the hyve-sleuth-worker adapter framework. Same federation
// pattern as Residential — every adapter writes to the canonical tables;
// the UI reads composite "PersonProfile" objects via /api/sleuth/scan/[id].
//
// IMPORTANT: This is the in-app scanner. The existing iframe-based smart
// launcher at /spy/app/sleuth still works and is not touched. The scanner
// lives at /spy/app/sleuth/scan as a sibling route.

export type ScanQueryType = 'name' | 'email' | 'phone' | 'username' | 'address'
export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export type Person = {
  personId: string
  source: string          // HIBP, GITHUB, SHERLOCK, OPENCORPORATES, USPTO, FAA, NSOPW, GRAVATAR
  fullName?: string
  firstName?: string
  middleName?: string
  lastName?: string
  age?: number
  dob?: string            // ISO date
  occupation?: string
  bio?: string
  avatarUrl?: string
  city?: string
  state?: string
  zip?: string
}

export type EmailRecord = {
  id?: string
  personId: string
  source: string
  email: string
  verified?: boolean
}

export type PhoneRecord = {
  id?: string
  personId: string
  source: string
  phone: string
  carrier?: string
  lineType?: 'mobile' | 'landline' | 'voip' | string
}

export type AddressRecord = {
  id?: string
  personId: string
  source: string
  address?: string
  city?: string
  state?: string
  zip?: string
  dateSeen?: string
}

export type UsernameRecord = {
  id?: string
  personId: string
  source: string
  platform: string
  handle: string
  url?: string
}

export type BreachRecord = {
  id: string
  personId: string
  source: string
  breachName: string
  breachDate?: string
  dataClasses?: string[]
  description?: string
}

export type CourtRecord = {
  id: string
  personId: string
  source: string
  court?: string
  caseNumber?: string
  caseType?: string
  filedDate?: string
  status?: string
  description?: string
}

export type BusinessRecord = {
  id: string
  personId: string
  source: string
  companyName: string
  role?: string             // officer | director | registered agent
  state?: string
  status?: string
  formedDate?: string
}

export type LicenseRecord = {
  id: string
  personId: string
  source: string
  type: string              // pilot | radio | medical | patent | trademark
  number?: string
  authority?: string        // FAA | FCC | USPTO | state board
  status?: string
  issuedDate?: string
  expiresDate?: string
}

export type NewsMention = {
  id: string
  personId: string
  source: string
  url: string
  title?: string
  publisher?: string
  date?: string
  snippet?: string
}

// Composite profile per scan-result row — what the UI renders.
export type PersonProfile = {
  person: Person
  emails: EmailRecord[]
  phones: PhoneRecord[]
  addresses: AddressRecord[]
  usernames: UsernameRecord[]
  breaches: BreachRecord[]
  courtRecords: CourtRecord[]
  businesses: BusinessRecord[]
  licenses: LicenseRecord[]
  newsMentions: NewsMention[]
  matchScore: number        // 0-100, confidence the source's hit matches the query
  signals: string[]
}

export type ScanProgress = {
  sources_total?: number
  sources_done?: number
  current?: string
  per_source?: Record<string, { status: 'pending' | 'running' | 'done' | 'failed'; count: number; error?: string }>
}

export type ScanJob = {
  id: string
  userEmail: string
  status: ScanStatus
  queryType: ScanQueryType
  queryValue: string
  queryFirst?: string
  queryLast?: string
  queryState?: string
  queryCity?: string
  sourceFilter?: string[] | null
  createdAt: string
  startedAt?: string
  completedAt?: string
  resultCount: number
  error?: string
  progress: ScanProgress
}

// Phase 1 OSINT adapters — all completely free, no API keys required (except
// HIBP which has a free tier for the breach catalog endpoint).
export const ALL_SOURCES = [
  'HIBP',           // Have I Been Pwned — email → breaches
  'GITHUB',         // GitHub — username → public profile + repos
  'GRAVATAR',       // Gravatar — email → profile
  'SHERLOCK',       // Sherlock-style enumeration across 300+ social platforms
  'OPENCORPORATES', // OpenCorporates — name → business filings
  'USPTO',          // USPTO — name → patents/trademarks
  'FAA',            // FAA — name → airman / pilot license
  'NSOPW',          // National Sex Offender Public Website — name+state lookup
] as const
export type SourceCode = typeof ALL_SOURCES[number] | string

export const SOURCE_LABELS: Record<string, string> = {
  HIBP: 'Have I Been Pwned',
  GITHUB: 'GitHub',
  GRAVATAR: 'Gravatar',
  SHERLOCK: 'Sherlock (300+ sites)',
  OPENCORPORATES: 'OpenCorporates',
  USPTO: 'USPTO Patents & TMs',
  FAA: 'FAA Airman Registry',
  NSOPW: 'Sex Offender Registry',
}

// Each adapter declares which query types it can answer. Used by the UI
// to gray out incompatible sources for the active query type.
export const SOURCE_QUERY_TYPES: Record<string, ScanQueryType[]> = {
  HIBP: ['email'],
  GITHUB: ['username', 'name', 'email'],
  GRAVATAR: ['email'],
  SHERLOCK: ['username'],
  OPENCORPORATES: ['name'],
  USPTO: ['name'],
  FAA: ['name'],
  NSOPW: ['name'],
}

// ─── Heuristic match scorer ──────────────────────────────────────────────
//
// Sleuth match scoring is fundamentally different from Residential's distress
// scoring. Here we're computing CONFIDENCE that the source's hit actually
// matches the query subject — not severity. 100 = nearly certain match,
// 0 = probably not the right person.

export function computeMatchScore(p: Pick<PersonProfile, 'breaches' | 'courtRecords' | 'businesses' | 'licenses' | 'usernames'>, q: { queryType: ScanQueryType; queryValue: string }): {
  score: number
  signals: string[]
} {
  let score = 0
  const signals: string[] = []
  const v = q.queryValue.toLowerCase()

  // Direct identifier match — highest confidence
  if (q.queryType === 'email' && p.breaches.length > 0) {
    score += 70
    signals.push(`Email in ${p.breaches.length} known breach${p.breaches.length === 1 ? '' : 'es'}`)
  }
  if (q.queryType === 'username' && p.usernames.some((u) => u.handle.toLowerCase() === v)) {
    score += 60
    signals.push('Exact handle match')
  }

  // Affiliation evidence
  if (p.businesses.length > 0) {
    score += Math.min(20, 5 * p.businesses.length)
    signals.push(`${p.businesses.length} business affiliation${p.businesses.length === 1 ? '' : 's'}`)
  }
  if (p.licenses.length > 0) {
    score += Math.min(15, 4 * p.licenses.length)
    signals.push(`${p.licenses.length} professional license${p.licenses.length === 1 ? '' : 's'}`)
  }
  if (p.courtRecords.length > 0) {
    score += Math.min(15, 4 * p.courtRecords.length)
    signals.push(`${p.courtRecords.length} court record${p.courtRecords.length === 1 ? '' : 's'}`)
  }
  if (p.usernames.length > 0) {
    score += Math.min(15, p.usernames.length)
    signals.push(`${p.usernames.length} usernames found`)
  }

  return { score: Math.min(100, Math.round(score)), signals }
}

export function formatDate(s?: string): string {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
