// Type definitions + helpers for the in-app HYVE Residential web tool.
//
// These shapes match the Supabase residential_* tables (migration 003) and
// the Pydantic models in the desktop app's engine/models.py — same schema
// across all three layers so adapters can write data in one shape and the
// UI can render it without translation.
//
// All real data flows in via:
//   POST /api/residential/scan        → enqueue scan
//   GET  /api/residential/scan/[id]   → poll status + results
//   GET  /api/residential/scans       → user's recent scan history
//
// No demo data lives here anymore.

export type LienType = 'hoa' | 'mechanic' | 'contractor' | 'judgment' | 'other'

export type ForeclosureStage =
  | 'filed'
  | 'notice_of_hearing'
  | 'hearing_scheduled'
  | 'sale_scheduled'
  | 'sold'
  | 'dismissed'

export type Property = {
  parcelId: string
  source: string         // HUD, FANNIE, FREDDIE, VA, USDA, IRS, MARSHALS, GSA, ATTOM, WAKE_NC, ...
  countyFips?: string
  county?: string
  address: string
  city?: string
  state: string
  zip?: string
  lat?: number
  lng?: number
  assessedValue?: number
  listPrice?: number     // for REO listings (HUD/Fannie/Freddie)
  landUse?: string
  zoning?: string
  acreage?: number
  yearBuilt?: number
  sqFt?: number
}

export type Owner = {
  parcelId: string
  source: string
  name: string
  ownerType: 'individual' | 'llc' | 'trust' | 'estate' | 'other'
  mailingAddress?: string
  mailingCity?: string
  mailingState?: string
  mailingZip?: string
}

export type TaxRecord = {
  id?: string
  parcelId: string
  source: string
  taxYear: number
  amountDue: number
  amountPaid: number
  penalty?: number
  interest?: number
}

export type Lien = {
  id: string
  parcelId: string
  source: string
  type: LienType
  plaintiff?: string
  amount: number
  filingDate?: string // ISO date
  status: 'active' | 'satisfied' | 'released'
}

export type Foreclosure = {
  id: string
  parcelId: string
  source: string
  stage: ForeclosureStage
  filedDate?: string
  hearingDate?: string
  saleDate?: string
  trustee?: string
  caseNumber?: string
}

// Composite "distress profile" — what the UI renders per result row.
export type DistressProfile = {
  property: Property
  owner: Owner | null
  tax: TaxRecord[]
  liens: Lien[]
  foreclosure: Foreclosure | null
  distressScore: number
  signals: string[]
}

// ── Scan job types — mirror residential_scan_jobs Supabase table ───────────

export type ScanQueryType = 'address' | 'city' | 'county' | 'zip' | 'state'
export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export type ScanJob = {
  id: string
  userEmail: string
  status: ScanStatus
  queryType: ScanQueryType
  queryValue: string
  queryState?: string
  sourceFilter?: string[] | null
  createdAt: string
  startedAt?: string
  completedAt?: string
  resultCount: number
  error?: string
  progress: ScanProgress
}

export type ScanProgress = {
  sources_total?: number
  sources_done?: number
  current?: string
  per_source?: Record<string, { status: 'pending' | 'running' | 'done' | 'failed'; count: number; error?: string }>
}

// All adapters Phase 1 ships with. Phase 2 adds ATTOM. Phase 3 adds
// per-county scrapers (NC Wake/Mecklenburg first, then top-50 metros).
export const ALL_SOURCES = [
  'HUD',         // FHA-foreclosed homes (huduser.gov)
  'FANNIE',      // Fannie Mae HomePath
  'FREDDIE',     // Freddie Mac HomeSteps
  'VA',          // VA-foreclosed
  'USDA',        // USDA Rural Development REO
  'IRS',         // IRS Treasury sales
  'MARSHALS',    // US Marshals seizures
  'GSA',         // GSA Auctions
] as const
export type SourceCode = typeof ALL_SOURCES[number] | string

export const SOURCE_LABELS: Record<string, string> = {
  HUD: 'HUD Home Store',
  FANNIE: 'Fannie Mae HomePath',
  FREDDIE: 'Freddie Mac HomeSteps',
  VA: 'VA Foreclosures',
  USDA: 'USDA Rural Development',
  IRS: 'IRS Treasury Sales',
  MARSHALS: 'US Marshals Auctions',
  GSA: 'GSA Auctions',
  ATTOM: 'ATTOM Data',
  WAKE_NC: 'Wake County, NC',
  MECKLENBURG_NC: 'Mecklenburg County, NC',
}

// ── Distress score (heuristic, stable across UI + worker) ──────────────────
export function computeDistressScore(p: Pick<DistressProfile, 'tax' | 'liens' | 'foreclosure'>): {
  score: number
  signals: string[]
} {
  let score = 0
  const signals: string[] = []

  if (p.foreclosure) {
    if (p.foreclosure.stage === 'sale_scheduled') {
      score += 60
      signals.push(`Sale scheduled ${p.foreclosure.saleDate || ''}`)
    } else if (p.foreclosure.stage === 'hearing_scheduled') {
      score += 45
      signals.push(`Hearing scheduled ${p.foreclosure.hearingDate || ''}`)
    } else if (p.foreclosure.stage === 'notice_of_hearing') {
      score += 35
      signals.push('Notice of hearing filed')
    } else if (p.foreclosure.stage === 'filed') {
      score += 25
      signals.push('Foreclosure filed')
    } else if (p.foreclosure.stage === 'sold') {
      score += 50
      signals.push('REO — bank-owned')
    }
  }

  const totalTaxOwed = p.tax.reduce((acc, t) => acc + Math.max(0, t.amountDue - t.amountPaid), 0)
  const yearsDelinquent = p.tax.filter((t) => t.amountDue > t.amountPaid).length
  if (yearsDelinquent >= 3) {
    score += 25
    signals.push(`${yearsDelinquent}yr tax delinquent ($${totalTaxOwed.toLocaleString()})`)
  } else if (yearsDelinquent >= 2) {
    score += 15
    signals.push(`${yearsDelinquent}yr tax delinquent`)
  } else if (yearsDelinquent === 1 && totalTaxOwed > 5000) {
    score += 8
    signals.push(`Tax owed: $${totalTaxOwed.toLocaleString()}`)
  }

  const activeLiens = p.liens.filter((l) => l.status === 'active')
  const totalLienAmount = activeLiens.reduce((a, l) => a + l.amount, 0)
  if (activeLiens.length >= 3) {
    score += 15
    signals.push(`${activeLiens.length} active liens ($${totalLienAmount.toLocaleString()})`)
  } else if (activeLiens.length >= 1) {
    score += 5 + Math.min(10, totalLienAmount / 5000)
    signals.push(`${activeLiens.length} active lien${activeLiens.length > 1 ? 's' : ''}`)
  }

  return { score: Math.min(100, Math.round(score)), signals }
}

// ── UI helpers (preserved from previous implementation) ─────────────────────

export function formatCurrency(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function stageLabel(s: ForeclosureStage): string {
  return ({
    filed: 'Filed',
    notice_of_hearing: 'Notice of Hearing',
    hearing_scheduled: 'Hearing Scheduled',
    sale_scheduled: 'Sale Scheduled',
    sold: 'REO / Sold',
    dismissed: 'Dismissed',
  })[s]
}

export function stageColor(s: ForeclosureStage): string {
  return ({
    filed: '#F59E0B',
    notice_of_hearing: '#F97316',
    hearing_scheduled: '#EF4444',
    sale_scheduled: '#DC2626',
    sold: '#7C3AED',
    dismissed: '#22C55E',
  })[s]
}
