import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/admin/api-auth'
import { supaGet } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50'), 200)

  const [purchasesRes, failedRes] = await Promise.all([
    supaGet('recent_purchases', `select=id,ts,product,plan,amount,currency,hyve_id,customer_id&order=ts.desc&limit=${limit}`),
    supaGet('failed_payments', `select=id,ts,customer_id,amount,reason&order=ts.desc&limit=20`),
  ])

  const purchases = purchasesRes.ok ? await purchasesRes.json() : []
  const failed = failedRes.ok ? await failedRes.json() : []

  return NextResponse.json({ purchases, failed })
}
