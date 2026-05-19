// Event slug generation for HYVE Attend.

/** Lowercase, strip punctuation, hyphenate. Falls back to 'event'. */
export function slugifyTitle(title: string): string {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s.length > 0 ? s : 'event'
}

/** The base slug, or base-N where N is the smallest free suffix >= 2. */
export function uniqueSlug(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base
  let n = 2
  while (taken.includes(`${base}-${n}`)) n++
  return `${base}-${n}`
}
