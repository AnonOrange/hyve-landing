// GET /api/sleuth/scan/[id]
//
// Poll a Sleuth scan's status + return hydrated PersonProfile rows. Designed
// to be called every 2-5s while the scan is running.
//
// Response shape:
//   { scan: ScanJob, results: PersonProfile[] }

import { NextRequest, NextResponse } from 'next/server'
import { supaGet } from '@/lib/supabase'
import { getSleuthUser } from '@/lib/sleuth/auth'
import type {
  PersonProfile,
  Person,
  EmailRecord,
  PhoneRecord,
  AddressRecord,
  UsernameRecord,
  BreachRecord,
  CourtRecord,
  BusinessRecord,
  LicenseRecord,
  NewsMention,
} from '@/lib/sleuth/types'

export const dynamic = 'force-dynamic'

type ScanRow = {
  id: string
  user_email: string
  status: string
  query_type: string
  query_value: string
  query_first: string | null
  query_last: string | null
  query_state: string | null
  query_city: string | null
  source_filter: string[] | null
  created_at: string
  started_at: string | null
  completed_at: string | null
  result_count: number
  error: string | null
  progress: Record<string, unknown>
}

type ResultRow = {
  scan_id: string
  person_id: string
  source: string
  match_score: number
  signals: string[]
}

// snake_case Supabase rows → camelCase domain types
const toPerson = (r: Record<string, unknown>): Person => ({
  personId: r.person_id as string,
  source: r.source as string,
  fullName: r.full_name as string | undefined,
  firstName: r.first_name as string | undefined,
  middleName: r.middle_name as string | undefined,
  lastName: r.last_name as string | undefined,
  age: r.age as number | undefined,
  dob: r.dob as string | undefined,
  occupation: r.occupation as string | undefined,
  bio: r.bio as string | undefined,
  avatarUrl: r.avatar_url as string | undefined,
  city: r.city as string | undefined,
  state: r.state as string | undefined,
  zip: r.zip as string | undefined,
})

const toEmail = (r: Record<string, unknown>): EmailRecord => ({
  id: r.id as string,
  personId: r.person_id as string,
  source: r.source as string,
  email: r.email as string,
  verified: r.verified as boolean | undefined,
})

const toPhone = (r: Record<string, unknown>): PhoneRecord => ({
  id: r.id as string,
  personId: r.person_id as string,
  source: r.source as string,
  phone: r.phone as string,
  carrier: r.carrier as string | undefined,
  lineType: r.line_type as string | undefined,
})

const toAddress = (r: Record<string, unknown>): AddressRecord => ({
  id: r.id as string,
  personId: r.person_id as string,
  source: r.source as string,
  address: r.address as string | undefined,
  city: r.city as string | undefined,
  state: r.state as string | undefined,
  zip: r.zip as string | undefined,
  dateSeen: r.date_seen as string | undefined,
})

const toUsername = (r: Record<string, unknown>): UsernameRecord => ({
  id: r.id as string,
  personId: r.person_id as string,
  source: r.source as string,
  platform: r.platform as string,
  handle: r.handle as string,
  url: r.url as string | undefined,
})

const toBreach = (r: Record<string, unknown>): BreachRecord => ({
  id: r.id as string,
  personId: r.person_id as string,
  source: r.source as string,
  breachName: r.breach_name as string,
  breachDate: r.breach_date as string | undefined,
  dataClasses: r.data_classes as string[] | undefined,
  description: r.description as string | undefined,
})

const toCourt = (r: Record<string, unknown>): CourtRecord => ({
  id: r.id as string,
  personId: r.person_id as string,
  source: r.source as string,
  court: r.court as string | undefined,
  caseNumber: r.case_number as string | undefined,
  caseType: r.case_type as string | undefined,
  filedDate: r.filed_date as string | undefined,
  status: r.status as string | undefined,
  description: r.description as string | undefined,
})

const toBusiness = (r: Record<string, unknown>): BusinessRecord => ({
  id: r.id as string,
  personId: r.person_id as string,
  source: r.source as string,
  companyName: r.company_name as string,
  role: r.role as string | undefined,
  state: r.state as string | undefined,
  status: r.status as string | undefined,
  formedDate: r.formed_date as string | undefined,
})

const toLicense = (r: Record<string, unknown>): LicenseRecord => ({
  id: r.id as string,
  personId: r.person_id as string,
  source: r.source as string,
  type: r.type as string,
  number: r.number as string | undefined,
  authority: r.authority as string | undefined,
  status: r.status as string | undefined,
  issuedDate: r.issued_date as string | undefined,
  expiresDate: r.expires_date as string | undefined,
})

const toNews = (r: Record<string, unknown>): NewsMention => ({
  id: r.id as string,
  personId: r.person_id as string,
  source: r.source as string,
  url: r.url as string,
  title: r.title as string | undefined,
  publisher: r.publisher as string | undefined,
  date: r.date as string | undefined,
  snippet: r.snippet as string | undefined,
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSleuthUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const scanId = params.id
  if (!/^[0-9a-f-]{36}$/.test(scanId)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  // Load the scan (scoped to user)
  const scanR = await supaGet(
    'sleuth_scan_jobs',
    `id=eq.${scanId}&user_email=eq.${encodeURIComponent(user.email)}&select=*`,
  )
  if (!scanR.ok) return NextResponse.json({ error: 'scan_lookup_failed' }, { status: 502 })
  const scans = (await scanR.json()) as ScanRow[]
  if (scans.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const scan = scans[0]

  const scanEnvelope = {
    id: scan.id,
    userEmail: scan.user_email,
    status: scan.status,
    queryType: scan.query_type,
    queryValue: scan.query_value,
    queryFirst: scan.query_first,
    queryLast: scan.query_last,
    queryState: scan.query_state,
    queryCity: scan.query_city,
    sourceFilter: scan.source_filter,
    createdAt: scan.created_at,
    startedAt: scan.started_at,
    completedAt: scan.completed_at,
    resultCount: scan.result_count,
    error: scan.error,
    progress: scan.progress,
  }

  const resultsR = await supaGet(
    'sleuth_scan_results',
    `scan_id=eq.${scanId}&select=person_id,source,match_score,signals&order=match_score.desc&limit=200`,
  )
  if (!resultsR.ok) {
    return NextResponse.json({ scan: scanEnvelope, results: [] })
  }
  const resultRows = (await resultsR.json()) as ResultRow[]
  if (resultRows.length === 0) {
    return NextResponse.json({ scan: scanEnvelope, results: [] })
  }

  // Hydrate
  const tupleFilter = resultRows
    .map((r) => `and(person_id.eq.${encodeURIComponent(r.person_id)},source.eq.${encodeURIComponent(r.source)})`)
    .join(',')
  const personIds = Array.from(new Set(resultRows.map((r) => r.person_id)))
  const personInList = `person_id=in.(${personIds.map((p) => `"${p}"`).join(',')})`

  const [personsR, emailsR, phonesR, addrR, usersR, breachR, courtR, bizR, licR, newsR] = await Promise.all([
    supaGet('sleuth_persons', `or=(${tupleFilter})&select=*`),
    supaGet('sleuth_emails', `${personInList}&select=*`),
    supaGet('sleuth_phones', `${personInList}&select=*`),
    supaGet('sleuth_addresses', `${personInList}&select=*`),
    supaGet('sleuth_usernames', `${personInList}&select=*`),
    supaGet('sleuth_breaches', `${personInList}&select=*`),
    supaGet('sleuth_court_records', `${personInList}&select=*`),
    supaGet('sleuth_businesses', `${personInList}&select=*`),
    supaGet('sleuth_licenses', `${personInList}&select=*`),
    supaGet('sleuth_news_mentions', `${personInList}&select=*`),
  ])
  const grab = async (r: Response) =>
    r.ok ? ((await r.json()) as Array<Record<string, unknown>>) : []

  const [persons, emails, phones, addresses, usernames, breaches, courts, biz, licenses, news] =
    await Promise.all([grab(personsR), grab(emailsR), grab(phonesR), grab(addrR), grab(usersR), grab(breachR), grab(courtR), grab(bizR), grab(licR), grab(newsR)])

  const profiles: PersonProfile[] = []
  for (const r of resultRows) {
    const pRow = persons.find((p) => p.person_id === r.person_id && p.source === r.source)
    if (!pRow) continue
    profiles.push({
      person: toPerson(pRow),
      emails: emails.filter((e) => e.person_id === r.person_id).map(toEmail),
      phones: phones.filter((p) => p.person_id === r.person_id).map(toPhone),
      addresses: addresses.filter((a) => a.person_id === r.person_id).map(toAddress),
      usernames: usernames.filter((u) => u.person_id === r.person_id).map(toUsername),
      breaches: breaches.filter((b) => b.person_id === r.person_id).map(toBreach),
      courtRecords: courts.filter((c) => c.person_id === r.person_id).map(toCourt),
      businesses: biz.filter((b) => b.person_id === r.person_id).map(toBusiness),
      licenses: licenses.filter((l) => l.person_id === r.person_id).map(toLicense),
      newsMentions: news.filter((n) => n.person_id === r.person_id).map(toNews),
      matchScore: r.match_score,
      signals: r.signals || [],
    })
  }

  return NextResponse.json({ scan: scanEnvelope, results: profiles })
}
