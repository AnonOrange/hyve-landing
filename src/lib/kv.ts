// src/lib/kv.ts
//
// Single import point for Vercel KV. Re-exports the official client so tests
// can mock this module in one place: vi.mock('@/lib/kv', () => ({ kv: makeFakeKv() }))

import { kv as realKv } from '@vercel/kv'

export const kv = realKv
