// One-shot: creates the Hyve Spy Stripe product + recurring price.
// Idempotent — re-running is safe; it looks up by lookup_key first.
import { readFileSync } from 'fs'
import Stripe from 'stripe'

// Load .env.local manually (Node doesn't ship dotenv natively)
try {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/)
    if (m) process.env[m[1]] = process.env[m[1]] || m[2]
  }
} catch {}

const key = process.env.STRIPE_SECRET_KEY
if (!key) { console.error('STRIPE_SECRET_KEY missing'); process.exit(1) }
const stripe = new Stripe(key)

const LOOKUP = 'hyve_spy_monthly_5_99_72hr_trial'

async function main() {
  // Check if price already exists by lookup_key
  const existing = await stripe.prices.list({ lookup_keys: [LOOKUP], expand: ['data.product'] })
  if (existing.data.length > 0) {
    const p = existing.data[0]
    console.log(`✓ Already exists: ${p.id} (product: ${p.product?.id || p.product})`)
    console.log(`STRIPE_SPY_PRICE_ID=${p.id}`)
    return
  }

  // Create product
  const product = await stripe.products.create({
    name: 'Hyve Spy Premium',
    description:
      '4,300+ live scanner feeds. 25,000+ public cameras. Real-time crime data. FOIA generator. 72-hour free trial.',
    metadata: { product: 'hyve_spy' },
  })

  // Create $5.99/mo recurring price with 3-day trial baked into the price metadata
  const price = await stripe.prices.create({
    product: product.id,
    currency: 'usd',
    unit_amount: 599,
    recurring: { interval: 'month' },
    lookup_key: LOOKUP,
    metadata: { trial_days: '3', plan: 'hyve_spy_monthly' },
  })

  console.log(`✓ Created product:  ${product.id}`)
  console.log(`✓ Created price:    ${price.id}`)
  console.log(`STRIPE_SPY_PRICE_ID=${price.id}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
