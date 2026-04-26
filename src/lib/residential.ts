// Type definitions + sample data for the in-app HYVE Residential web tool.
//
// Shapes copied verbatim from the desktop app's Pydantic models in
// engine/models.py, so when we migrate the Python scrapers to write to
// Supabase, the data layer slots in without any UI changes:
//
//   Today:    UI reads SAMPLE_PROPERTIES (this file)
//   Tomorrow: UI reads from /api/residential/properties (Supabase-backed)
//
// The shape stays identical; only the source flips. That's the value of
// pinning to the existing schema upfront.

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
  countyFips: string
  county: string // human-readable (Wake, Mecklenburg, etc.)
  address: string
  city?: string
  state: string
  zip?: string
  lat?: number
  lng?: number
  assessedValue?: number
  landUse?: string
  zoning?: string
  acreage?: number
  yearBuilt?: number
  sqFt?: number
}

export type Owner = {
  parcelId: string
  name: string
  ownerType: 'individual' | 'llc' | 'trust' | 'estate' | 'other'
  mailingAddress?: string
  mailingCity?: string
  mailingState?: string
  mailingZip?: string
}

export type TaxRecord = {
  parcelId: string
  taxYear: number
  amountDue: number
  amountPaid: number
  penalty?: number
  interest?: number
}

export type Lien = {
  id: string
  parcelId: string
  type: LienType
  plaintiff: string
  amount: number
  filingDate: string // ISO
  status: 'active' | 'satisfied' | 'released'
}

export type Foreclosure = {
  id: string
  parcelId: string
  stage: ForeclosureStage
  filedDate: string // ISO
  hearingDate?: string
  saleDate?: string
  trustee?: string
  caseNumber?: string
}

// Composite "distress profile" for a property — what the UI most often
// renders. Pre-joining these on the client (or on the API) saves a chain
// of N+1 lookups per row.
export type DistressProfile = {
  property: Property
  owner: Owner
  tax: TaxRecord[]
  liens: Lien[]
  foreclosure: Foreclosure | null
  distressScore: number // 0-100, computed in computeDistressScore()
  signals: string[] // human-readable list of why the score is what it is
}

// Heuristic distress scorer. Tunable; this is a fine starting point for the
// "is this property worth contacting?" sort.
export function computeDistressScore(p: Pick<DistressProfile, 'tax' | 'liens' | 'foreclosure'>): {
  score: number
  signals: string[]
} {
  let score = 0
  const signals: string[] = []

  // Foreclosure signal — the strongest. Sale-scheduled = imminent distress.
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
    }
  }

  // Tax delinquencies. Multi-year unpaid = strong stress signal.
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

  // Liens
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

// ────────────────────────────────────────────────────────────────────
// Sample data — replaced by real Supabase queries in Phase 2. The shape
// matches the engine/models.py Pydantic schema so the UI doesn't change.
// ────────────────────────────────────────────────────────────────────

const PROPERTIES: Property[] = [
  {
    parcelId: '0042-117-A1',
    countyFips: '37183',
    county: 'Wake',
    address: '4218 Glenwood Ave',
    city: 'Raleigh',
    state: 'NC',
    zip: '27612',
    lat: 35.8283,
    lng: -78.6743,
    assessedValue: 285000,
    landUse: 'Residential — single family',
    zoning: 'R-4',
    acreage: 0.21,
    yearBuilt: 1962,
    sqFt: 1480,
  },
  {
    parcelId: '0118-554-B2',
    countyFips: '37119',
    county: 'Mecklenburg',
    address: '912 Hawthorne Ln',
    city: 'Charlotte',
    state: 'NC',
    zip: '28204',
    lat: 35.2155,
    lng: -80.8124,
    assessedValue: 412000,
    landUse: 'Residential — duplex',
    zoning: 'R-22MF',
    acreage: 0.16,
    yearBuilt: 1948,
    sqFt: 2240,
  },
  {
    parcelId: '0789-201-C5',
    countyFips: '37183',
    county: 'Wake',
    address: '6705 Old Wake Forest Rd',
    city: 'Raleigh',
    state: 'NC',
    zip: '27616',
    lat: 35.8589,
    lng: -78.5887,
    assessedValue: 198000,
    landUse: 'Residential — single family',
    zoning: 'R-4',
    acreage: 0.34,
    yearBuilt: 1971,
    sqFt: 1180,
  },
  {
    parcelId: '0445-902-D8',
    countyFips: '37119',
    county: 'Mecklenburg',
    address: '3401 Eastway Dr',
    city: 'Charlotte',
    state: 'NC',
    zip: '28205',
    lat: 35.2342,
    lng: -80.7780,
    assessedValue: 175000,
    landUse: 'Residential — single family',
    zoning: 'R-3',
    acreage: 0.18,
    yearBuilt: 1955,
    sqFt: 980,
  },
  {
    parcelId: '0033-088-E1',
    countyFips: '37183',
    county: 'Wake',
    address: '212 New Bern Ave',
    city: 'Raleigh',
    state: 'NC',
    zip: '27601',
    lat: 35.7796,
    lng: -78.6347,
    assessedValue: 510000,
    landUse: 'Mixed-use — commercial/residential',
    zoning: 'DX-3',
    acreage: 0.09,
    yearBuilt: 1924,
    sqFt: 2820,
  },
  {
    parcelId: '0211-433-F4',
    countyFips: '37119',
    county: 'Mecklenburg',
    address: '5520 Wilkinson Blvd',
    city: 'Charlotte',
    state: 'NC',
    zip: '28208',
    lat: 35.2266,
    lng: -80.9012,
    assessedValue: 89000,
    landUse: 'Residential — single family',
    zoning: 'R-3',
    acreage: 0.22,
    yearBuilt: 1939,
    sqFt: 720,
  },
]

const OWNERS: Owner[] = [
  { parcelId: '0042-117-A1', name: 'Jennifer Thompson', ownerType: 'individual', mailingAddress: '4218 Glenwood Ave', mailingCity: 'Raleigh', mailingState: 'NC', mailingZip: '27612' },
  { parcelId: '0118-554-B2', name: 'Hawthorne Holdings LLC', ownerType: 'llc', mailingAddress: 'PO Box 4827', mailingCity: 'Charlotte', mailingState: 'NC', mailingZip: '28210' },
  { parcelId: '0789-201-C5', name: 'Estate of Robert Hayes', ownerType: 'estate', mailingAddress: 'c/o David Hayes 1842 Pebblebrook Dr', mailingCity: 'Raleigh', mailingState: 'NC', mailingZip: '27613' },
  { parcelId: '0445-902-D8', name: 'Marcus Williams', ownerType: 'individual', mailingAddress: '3401 Eastway Dr', mailingCity: 'Charlotte', mailingState: 'NC', mailingZip: '28205' },
  { parcelId: '0033-088-E1', name: 'New Bern Trust', ownerType: 'trust', mailingAddress: 'c/o J. Patterson 4400 Six Forks Rd Ste 200', mailingCity: 'Raleigh', mailingState: 'NC', mailingZip: '27609' },
  { parcelId: '0211-433-F4', name: 'Sandra Mitchell', ownerType: 'individual', mailingAddress: '4112 Tuckaseegee Rd', mailingCity: 'Charlotte', mailingState: 'NC', mailingZip: '28208' },
]

const TAX_RECORDS: TaxRecord[] = [
  // Glenwood Ave — current
  { parcelId: '0042-117-A1', taxYear: 2025, amountDue: 3210, amountPaid: 3210 },
  { parcelId: '0042-117-A1', taxYear: 2024, amountDue: 3105, amountPaid: 3105 },
  // Hawthorne Ln — 2yr delinquent
  { parcelId: '0118-554-B2', taxYear: 2025, amountDue: 5840, amountPaid: 0, penalty: 580, interest: 240 },
  { parcelId: '0118-554-B2', taxYear: 2024, amountDue: 5720, amountPaid: 0, penalty: 1144, interest: 720 },
  { parcelId: '0118-554-B2', taxYear: 2023, amountDue: 5580, amountPaid: 5580 },
  // Old Wake Forest — 3yr delinquent (probate scenario)
  { parcelId: '0789-201-C5', taxYear: 2025, amountDue: 2240, amountPaid: 0, penalty: 224 },
  { parcelId: '0789-201-C5', taxYear: 2024, amountDue: 2180, amountPaid: 0, penalty: 436, interest: 180 },
  { parcelId: '0789-201-C5', taxYear: 2023, amountDue: 2110, amountPaid: 0, penalty: 633, interest: 380 },
  // Eastway Dr — 1yr partial
  { parcelId: '0445-902-D8', taxYear: 2025, amountDue: 1980, amountPaid: 500, penalty: 148 },
  { parcelId: '0445-902-D8', taxYear: 2024, amountDue: 1920, amountPaid: 1920 },
  // New Bern Ave — current
  { parcelId: '0033-088-E1', taxYear: 2025, amountDue: 5780, amountPaid: 5780 },
  // Wilkinson Blvd — 4yr delinquent (heavy distress)
  { parcelId: '0211-433-F4', taxYear: 2025, amountDue: 1010, amountPaid: 0, penalty: 101 },
  { parcelId: '0211-433-F4', taxYear: 2024, amountDue: 980, amountPaid: 0, penalty: 196, interest: 78 },
  { parcelId: '0211-433-F4', taxYear: 2023, amountDue: 950, amountPaid: 0, penalty: 285, interest: 152 },
  { parcelId: '0211-433-F4', taxYear: 2022, amountDue: 920, amountPaid: 0, penalty: 368, interest: 220 },
]

const LIENS: Lien[] = [
  { id: 'L-2024-0118', parcelId: '0118-554-B2', type: 'hoa', plaintiff: 'Plaza Midwood Owners Assoc', amount: 4200, filingDate: '2025-08-14', status: 'active' },
  { id: 'L-2025-0334', parcelId: '0118-554-B2', type: 'mechanic', plaintiff: 'Carolina Roofing Co', amount: 12800, filingDate: '2026-01-22', status: 'active' },
  { id: 'L-2024-0892', parcelId: '0789-201-C5', type: 'judgment', plaintiff: 'Capital One Bank N.A.', amount: 18420, filingDate: '2025-04-09', status: 'active' },
  { id: 'L-2024-1102', parcelId: '0445-902-D8', type: 'contractor', plaintiff: 'Mecklenburg HVAC LLC', amount: 6840, filingDate: '2025-11-02', status: 'active' },
  { id: 'L-2025-0044', parcelId: '0211-433-F4', type: 'hoa', plaintiff: 'Wilkinson Place HOA', amount: 2100, filingDate: '2026-02-01', status: 'active' },
  { id: 'L-2024-0712', parcelId: '0211-433-F4', type: 'judgment', plaintiff: 'Discover Bank', amount: 8920, filingDate: '2025-07-18', status: 'active' },
  { id: 'L-2023-0991', parcelId: '0211-433-F4', type: 'mechanic', plaintiff: 'Allcare Plumbing', amount: 3200, filingDate: '2024-09-30', status: 'active' },
]

const FORECLOSURES: Foreclosure[] = [
  {
    id: 'F-2026-0421',
    parcelId: '0118-554-B2',
    stage: 'hearing_scheduled',
    filedDate: '2026-02-12',
    hearingDate: '2026-05-08',
    trustee: 'Brock & Scott PLLC',
    caseNumber: '26-SP-042',
  },
  {
    id: 'F-2025-1108',
    parcelId: '0789-201-C5',
    stage: 'sale_scheduled',
    filedDate: '2025-11-08',
    hearingDate: '2026-01-15',
    saleDate: '2026-05-12',
    trustee: 'The Walters Law Firm',
    caseNumber: '25-SP-1108',
  },
  {
    id: 'F-2026-0102',
    parcelId: '0211-433-F4',
    stage: 'filed',
    filedDate: '2026-04-03',
    trustee: 'Hutchens Law Firm',
    caseNumber: '26-SP-088',
  },
]

/**
 * Build the merged DistressProfile per property and compute a distress score.
 * In Phase 2 this becomes a Supabase query that joins these tables server-side.
 */
export function loadDistressProfiles(): DistressProfile[] {
  return PROPERTIES.map((property) => {
    const owner = OWNERS.find((o) => o.parcelId === property.parcelId) || {
      parcelId: property.parcelId,
      name: 'Unknown',
      ownerType: 'individual' as const,
    }
    const tax = TAX_RECORDS.filter((t) => t.parcelId === property.parcelId)
    const liens = LIENS.filter((l) => l.parcelId === property.parcelId)
    const foreclosure = FORECLOSURES.find((f) => f.parcelId === property.parcelId) || null
    const { score, signals } = computeDistressScore({ tax, liens, foreclosure })
    return { property, owner, tax, liens, foreclosure, distressScore: score, signals }
  }).sort((a, b) => b.distressScore - a.distressScore)
}

export function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function stageLabel(s: ForeclosureStage): string {
  return ({
    filed: 'Filed',
    notice_of_hearing: 'Notice of Hearing',
    hearing_scheduled: 'Hearing Scheduled',
    sale_scheduled: 'Sale Scheduled',
    sold: 'Sold',
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
