// src/lib/tracker/source.ts
//
// Collapse a referrer URL + UTM params into a small set of source labels
// for storage in traffic_events.source.

const SEARCH_HOSTS = /^(?:www\.)?(google|bing|duckduckgo|brave|kagi|yandex)\./
const SOCIAL_HOSTS = /^(?:www\.)?(twitter\.com|x\.com|facebook\.com|reddit\.com|linkedin\.com|youtube\.com|news\.ycombinator\.com|hn\.algolia\.com|t\.co|lnkd\.in)$/

export interface UtmParams {
  source?: string | null
  medium?: string | null
  campaign?: string | null
}

export function classifySource(referrer: string | null, utm?: UtmParams): string {
  if (utm?.source) return `utm:${utm.source.toLowerCase().slice(0, 30)}`

  if (!referrer) return 'direct'

  let host: string
  try {
    host = new URL(referrer).hostname.toLowerCase()
  } catch {
    return 'unknown'
  }

  if (SEARCH_HOSTS.test(host)) return 'search'
  if (SOCIAL_HOSTS.test(host) || SOCIAL_HOSTS.test(host.replace(/^www\./, ''))) return 'social'

  return host.replace(/^www\./, '').slice(0, 40)
}

// Product attribution — ordered prefix matching. More-specific paths MUST
// come before their prefixes or Sentinel collapses into Spy.
export function classifyProduct(pathname: string): string | null {
  if (pathname === '/' || pathname.startsWith('/home')) return 'home'
  if (pathname.startsWith('/spy/app/sentinel')) return 'sentinel'
  if (pathname.startsWith('/messenger') || pathname.startsWith('/download') || pathname.startsWith('/whitepaper')) return 'messenger'
  if (pathname.startsWith('/spy')) return 'spy'
  return null
}
