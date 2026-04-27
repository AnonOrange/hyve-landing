// src/lib/snapshots/threat-level.ts
//
// Pure function — given active signals, returns composite threat level.

export type ThreatLevel = 'low' | 'guarded' | 'elevated' | 'high' | 'critical'

export type ThreatSignalKind =
  | 'tls_expiring_7d'
  | 'tls_expiring_14d'
  | 'tls_expiring_30d'
  | 'server_health_failed'
  | 'brute_force'
  | 'webhook_signature_failures'
  | 'dnssec_disabled'
  | 'cron_stale'
  | 'stripe_unreachable'

export const SEVERITY: Record<ThreatSignalKind, number> = {
  tls_expiring_7d:            30,
  tls_expiring_14d:           20,
  tls_expiring_30d:           10,
  server_health_failed:       20,
  brute_force:                15,
  webhook_signature_failures: 25,
  dnssec_disabled:             5,
  cron_stale:                 15,
  stripe_unreachable:         15,
}

export interface ThreatSignal {
  kind: ThreatSignalKind
  severity: number
  detail?: string
}

export interface ThreatResult {
  level: ThreatLevel
  score: number
  signals: ThreatSignal[]
}

export function computeThreatLevel(signals: ThreatSignal[]): ThreatResult {
  const score = signals.reduce((sum, s) => sum + s.severity, 0)
  const level: ThreatLevel =
    score >= 30 ? 'critical' :
    score >= 20 ? 'high' :
    score >= 10 ? 'elevated' :
    score >= 1  ? 'guarded' :
    'low'
  return { level, score, signals }
}
