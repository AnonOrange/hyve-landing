// The reaction-driven energy / applause meter. Pure: maps a count of recent
// reactions to a 0-100 level. Around SATURATION reactions in the client's
// rolling window pegs the meter at full.
const SATURATION = 20

export function energyLevel(reactionCount: number): number {
  if (reactionCount <= 0) return 0
  return Math.min(100, Math.round((reactionCount / SATURATION) * 100))
}
