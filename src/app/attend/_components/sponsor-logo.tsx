'use client'

// A single sponsor credit in the footer. Client component because the logo
// <img> needs an onError fallback (a bad/blocked URL degrades to a text
// wordmark instead of an empty box) and referrerPolicy="no-referrer" (so
// referer-protected CDNs like Wix actually serve the image). The link carries
// rel="sponsored" — the correct SEO disclosure for a paid/sponsor link.
import { useState } from 'react'

export function SponsorLogo({
  name,
  url,
  logoUrl,
  blurb,
}: {
  name: string
  url: string
  logoUrl: string | null
  blurb: string | null
}) {
  const [imgOk, setImgOk] = useState(true)
  const showImg = !!logoUrl && imgOk

  return (
    <a
      href={url}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className="flex flex-col items-center gap-2 text-center transition hover:opacity-90"
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl as string}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setImgOk(false)}
          className="h-12 w-auto max-w-[200px] rounded bg-white/95 object-contain p-1.5"
        />
      ) : (
        <span className="text-sm font-black tracking-wide text-[#ede8d8]">{name}</span>
      )}
      {blurb && <span className="max-w-[220px] text-[10px] text-[#9e8a55]">{blurb}</span>}
    </a>
  )
}
