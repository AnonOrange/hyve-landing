// src/lib/supabase.ts
//
// Thin helpers for the raw-REST Supabase pattern used throughout this codebase.
// No SDK — just fetch with consistent auth headers.

function baseHeaders(extra?: Record<string, string>): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_KEY!
  return {
    'Content-Type': 'application/json',
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra,
  }
}

function url(table: string, query?: string): string {
  return `${process.env.SUPABASE_URL!}/rest/v1/${table}${query ? `?${query}` : ''}`
}

export function supaGet(table: string, query?: string): Promise<Response> {
  return fetch(url(table, query), { headers: baseHeaders() })
}

export function supaPost(table: string, body: unknown, prefer = 'return=representation'): Promise<Response> {
  return fetch(url(table), {
    method: 'POST',
    headers: baseHeaders({ Prefer: prefer }),
    body: JSON.stringify(body),
  })
}

export function supaPatch(table: string, query: string, body: unknown, prefer = 'return=minimal'): Promise<Response> {
  return fetch(url(table, query), {
    method: 'PATCH',
    headers: baseHeaders({ Prefer: prefer }),
    body: JSON.stringify(body),
  })
}

export function supaDelete(table: string, query: string): Promise<Response> {
  return fetch(url(table, query), {
    method: 'DELETE',
    headers: baseHeaders({ Prefer: 'return=minimal' }),
  })
}
