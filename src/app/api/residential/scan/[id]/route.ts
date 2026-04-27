// GET /api/residential/scan/[id]
//
// Poll a scan's status + return its results once the worker has populated
// residential_scan_results. Designed to be called every 2-5s from the UI
// while a scan is running.
//
// Response shape:
//   {
//     scan: ScanJob,
//     results: DistressProfile[]  // empty array while pending/running
//   }
//
// Each profile pulls property + owner + tax + liens + foreclosure for the
// (parcel_id, source) tuple in scan_results, then computes distress score.

import { NextRequest, NextResponse } from 'next/server'
import { supaGet } from '@/lib/supabase'
import { getResidentialUser } from '@/lib/residential/auth'
import { computeDistressScore, type DistressProfile, type Property, type Owner, type TaxRecord, type Lien, type Foreclosure } from '@/lib/residential'

export const dynamic = 'force-dynamic'

type ScanJobRow = {
  id: string
  user_email: string
  status: string
  query_type: string
  query_value: string
  query_state: string | null
  source_filter: string[] | null
  created_at: string
  started_at: string | null
  completed_at: string | null
  result_count: number
  error: string | null
  progress: Record<string, unknown>
}

type ScanResultRow = {
  scan_id: string
  parcel_id: string
  source: string
  distress_score: number
  signals: string[]
}

// Snake-case Supabase rows → camelCase TS types (UI shape)
function rowToProperty(r: Record<string, unknown>): Property {
  return {
    parcelId: r.parcel_id as string,
    source: r.source as string,
    countyFips: r.county_fips as string | undefined,
    county: r.county as string | undefined,
    address: r.address as string,
    city: r.city as string | undefined,
    state: r.state as string,
    zip: r.zip as string | undefined,
    lat: r.lat as number | undefined,
    lng: r.lng as number | undefined,
    assessedValue: r.assessed_value as number | undefined,
    listPrice: r.list_price as number | undefined,
    landUse: r.land_use as string | undefined,
    zoning: r.zoning as string | undefined,
    acreage: r.acreage as number | undefined,
    yearBuilt: r.year_built as number | undefined,
    sqFt: r.sq_ft as number | undefined,
  }
}

function rowToOwner(r: Record<string, unknown>): Owner {
  return {
    parcelId: r.parcel_id as string,
    source: r.source as string,
    name: r.name as string,
    ownerType: (r.owner_type || 'individual') as Owner['ownerType'],
    mailingAddress: r.mailing_address as string | undefined,
    mailingCity: r.mailing_city as string | undefined,
    mailingState: r.mailing_state as string | undefined,
    mailingZip: r.mailing_zip as string | undefined,
  }
}

function rowToTax(r: Record<string, unknown>): TaxRecord {
  return {
    id: r.id as string,
    parcelId: r.parcel_id as string,
    source: r.source as string,
    taxYear: r.tax_year as number,
    amountDue: Number(r.amount_due) || 0,
    amountPaid: Number(r.amount_paid) || 0,
    penalty: r.penalty != null ? Number(r.penalty) : undefined,
    interest: r.interest != null ? Number(r.interest) : undefined,
  }
}

function rowToLien(r: Record<string, unknown>): Lien {
  return {
    id: r.id as string,
    parcelId: r.parcel_id as string,
    source: r.source as string,
    type: r.type as Lien['type'],
    plaintiff: r.plaintiff as string | undefined,
    amount: Number(r.amount) || 0,
    filingDate: r.filing_date as string | undefined,
    status: (r.status || 'active') as Lien['status'],
  }
}

function rowToForeclosure(r: Record<string, unknown>): Foreclosure {
  return {
    id: r.id as string,
    parcelId: r.parcel_id as string,
    source: r.source as string,
    stage: r.stage as Foreclosure['stage'],
    filedDate: r.filed_date as string | undefined,
    hearingDate: r.hearing_date as string | undefined,
    saleDate: r.sale_date as string | undefined,
    trustee: r.trustee as string | undefined,
    caseNumber: r.case_number as string | undefined,
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getResidentialUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const scanId = params.id
  if (!/^[0-9a-f-]{36}$/.test(scanId)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  // Load scan job, scoped to user's own scans
  const scanR = await supaGet(
    'residential_scan_jobs',
    `id=eq.${scanId}&user_email=eq.${encodeURIComponent(user.email)}&select=*`,
  )
  if (!scanR.ok) return NextResponse.json({ error: 'scan_lookup_failed' }, { status: 502 })
  const scans = (await scanR.json()) as ScanJobRow[]
  if (scans.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const scan = scans[0]

  // Always emit the scan envelope; results will be empty while pending/running
  const scanEnvelope = {
    id: scan.id,
    userEmail: scan.user_email,
    status: scan.status,
    queryType: scan.query_type,
    queryValue: scan.query_value,
    queryState: scan.query_state,
    sourceFilter: scan.source_filter,
    createdAt: scan.created_at,
    startedAt: scan.started_at,
    completedAt: scan.completed_at,
    resultCount: scan.result_count,
    error: scan.error,
    progress: scan.progress,
  }

  // Pull scan_results
  const resultsR = await supaGet(
    'residential_scan_results',
    `scan_id=eq.${scanId}&select=parcel_id,source,distress_score,signals&order=distress_score.desc&limit=500`,
  )
  if (!resultsR.ok) {
    return NextResponse.json({ scan: scanEnvelope, results: [] })
  }
  const resultRows = (await resultsR.json()) as ScanResultRow[]
  if (resultRows.length === 0) {
    return NextResponse.json({ scan: scanEnvelope, results: [] })
  }

  // Hydrate the (parcel_id, source) tuples into full DistressProfiles by
  // batch-fetching from each table. We use PostgREST's `or=()` filter to
  // pull all needed rows in one query per table.
  const tupleFilter = resultRows
    .map((r) => `and(parcel_id.eq.${encodeURIComponent(r.parcel_id)},source.eq.${encodeURIComponent(r.source)})`)
    .join(',')

  // Properties (composite PK)
  const propsR = await supaGet(
    'residential_properties',
    `or=(${tupleFilter})&select=*`,
  )
  const propsRows = propsR.ok ? ((await propsR.json()) as Array<Record<string, unknown>>) : []

  // Owners (composite PK)
  const ownersR = await supaGet(
    'residential_owners',
    `or=(${tupleFilter})&select=*`,
  )
  const ownersRows = ownersR.ok ? ((await ownersR.json()) as Array<Record<string, unknown>>) : []

  // Tax records — by parcel_id only (a parcel can have multiple years across sources)
  const parcelIds = Array.from(new Set(resultRows.map((r) => r.parcel_id)))
  const parcelInList = `parcel_id=in.(${parcelIds.map((p) => `"${p}"`).join(',')})`

  const [taxR, liensR, forecR] = await Promise.all([
    supaGet('residential_tax_records', `${parcelInList}&select=*`),
    supaGet('residential_liens', `${parcelInList}&select=*`),
    supaGet('residential_foreclosures', `${parcelInList}&select=*`),
  ])
  const taxRows = taxR.ok ? ((await taxR.json()) as Array<Record<string, unknown>>) : []
  const liensRows = liensR.ok ? ((await liensR.json()) as Array<Record<string, unknown>>) : []
  const forecRows = forecR.ok ? ((await forecR.json()) as Array<Record<string, unknown>>) : []

  // Build profiles in scan_results order (already sorted by distress_score desc)
  const profiles: DistressProfile[] = []
  for (const r of resultRows) {
    const prop = propsRows.find((p) => p.parcel_id === r.parcel_id && p.source === r.source)
    if (!prop) continue
    const own = ownersRows.find((o) => o.parcel_id === r.parcel_id && o.source === r.source)
    const tax = taxRows.filter((t) => t.parcel_id === r.parcel_id).map(rowToTax)
    const liens = liensRows.filter((l) => l.parcel_id === r.parcel_id).map(rowToLien)
    const forecMatches = forecRows.filter((f) => f.parcel_id === r.parcel_id)
    const foreclosure = forecMatches.length > 0 ? rowToForeclosure(forecMatches[0]) : null
    const { score, signals } = computeDistressScore({ tax, liens, foreclosure })
    profiles.push({
      property: rowToProperty(prop),
      owner: own ? rowToOwner(own) : null,
      tax,
      liens,
      foreclosure,
      // Prefer worker-computed score; fall back to client computation
      distressScore: r.distress_score || score,
      signals: r.signals?.length ? r.signals : signals,
    })
  }

  return NextResponse.json({ scan: scanEnvelope, results: profiles })
}
