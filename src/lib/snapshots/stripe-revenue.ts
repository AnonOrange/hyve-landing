// src/lib/snapshots/stripe-revenue.ts
//
// Queries Stripe subscriptions API + recent_purchases table to produce
// per-product revenue and sub-count snapshots.

import Stripe from 'stripe'
import { supaGet } from '@/lib/supabase'

export type Product = 'messenger' | 'spy' | 'spy_pro' | 'sentinel'

export interface ProductRevenue {
  revenue30d: number    // cents
  activeSubCount: number
  mrr: number           // cents — monthly recurring revenue
}

export interface RevenueSnapshot {
  byProduct: Record<Product, ProductRevenue>
  total: {
    revenue30d: number
    activeSubCount: number
    mrr: number
  }
  ts: number
}

function priceIdToProduct(priceId: string): Product | null {
  const {
    STRIPE_MONTHLY_PRICE_ID,
    STRIPE_ANNUAL_PRICE_ID,
    STRIPE_SPY_PRICE_ID,
    STRIPE_SPY_ANNUAL_PRICE_ID,
    STRIPE_SPY_PRO_PRICE_ID,
    STRIPE_SPY_PRO_ANNUAL_PRICE_ID,
    STRIPE_SENTINEL_PRICE_ID,
  } = process.env

  if (priceId === STRIPE_MONTHLY_PRICE_ID || priceId === STRIPE_ANNUAL_PRICE_ID) return 'messenger'
  if (priceId === STRIPE_SPY_PRICE_ID || priceId === STRIPE_SPY_ANNUAL_PRICE_ID) return 'spy'
  if (priceId === STRIPE_SPY_PRO_PRICE_ID || priceId === STRIPE_SPY_PRO_ANNUAL_PRICE_ID) return 'spy_pro'
  if (priceId === STRIPE_SENTINEL_PRICE_ID) return 'sentinel'
  return null
}

function emptyProduct(): ProductRevenue {
  return { revenue30d: 0, activeSubCount: 0, mrr: 0 }
}

export async function snapshotStripeRevenue(): Promise<RevenueSnapshot> {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY not set')

  const stripe = new Stripe(secretKey)
  const cutoff30d = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60

  // Active subscriptions — iterate all pages
  const subsByProduct: Record<Product, { count: number; mrr: number }> = {
    messenger: { count: 0, mrr: 0 },
    spy:       { count: 0, mrr: 0 },
    spy_pro:   { count: 0, mrr: 0 },
    sentinel:  { count: 0, mrr: 0 },
  }

  for await (const sub of stripe.subscriptions.list({ status: 'active', limit: 100 })) {
    for (const item of sub.items.data) {
      const product = priceIdToProduct(item.price.id)
      if (!product) continue
      subsByProduct[product].count++
      // Normalise interval to monthly cents
      const amount = item.price.unit_amount ?? 0
      const interval = item.price.recurring?.interval
      const intervalCount = item.price.recurring?.interval_count ?? 1
      const monthlyAmount =
        interval === 'year' ? Math.round(amount / (12 * intervalCount)) :
        interval === 'month' ? Math.round(amount / intervalCount) : 0
      subsByProduct[product].mrr += monthlyAmount
    }
  }

  // 30-day revenue from our recent_purchases table (populated by webhooks)
  const cutoffIso = new Date(cutoff30d * 1000).toISOString()
  const purchasesRes = await supaGet(
    'recent_purchases',
    `ts=gte.${encodeURIComponent(cutoffIso)}&select=product,amount`,
  )
  const revenueByProduct: Record<Product, number> = { messenger: 0, spy: 0, spy_pro: 0, sentinel: 0 }
  if (purchasesRes.ok) {
    const rows = await purchasesRes.json() as { product: string; amount: number }[]
    for (const row of rows) {
      if (row.product in revenueByProduct) {
        revenueByProduct[row.product as Product] += row.amount
      }
    }
  }

  const products: Product[] = ['messenger', 'spy', 'spy_pro', 'sentinel']
  const byProduct = Object.fromEntries(
    products.map((p) => [p, {
      revenue30d: revenueByProduct[p],
      activeSubCount: subsByProduct[p].count,
      mrr: subsByProduct[p].mrr,
    }]),
  ) as Record<Product, ProductRevenue>

  const total = {
    revenue30d: products.reduce((s, p) => s + byProduct[p].revenue30d, 0),
    activeSubCount: products.reduce((s, p) => s + byProduct[p].activeSubCount, 0),
    mrr: products.reduce((s, p) => s + byProduct[p].mrr, 0),
  }

  return { byProduct, total, ts: Date.now() }
}
