// HYVE Attend promotion copy — turns event details into a starter ad creative
// (spec §19). Pure and deterministic; the tone follows §32 (calm, modern,
// human — no hype). The creator edits this freely afterwards.

export interface CreativeEventInput {
  title: string
  description: string | null
}

export interface AdCreative {
  headline: string
  body: string
}

const HEADLINE_MAX = 80
const BODY_MAX = 180

// Trim, collapse internal whitespace, and clamp to a length with an ellipsis.
function clamp(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ')
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`
}

/** A starter headline + body for an event's promotion campaign. */
export function generateStarterCreative(e: CreativeEventInput): AdCreative {
  const title = e.title.trim().replace(/\s+/g, ' ') || 'A live show'
  const headline = clamp(`${title} — live on HYVE`, HEADLINE_MAX)
  const description = e.description?.trim()
  const body = description
    ? clamp(description, BODY_MAX)
    : clamp(
        `Join ${title} live from any browser. Reserve your ticket on HYVE Attend.`,
        BODY_MAX,
      )
  return { headline, body }
}
