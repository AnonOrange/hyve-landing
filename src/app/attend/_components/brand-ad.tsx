// Inline brand-ad card. Used to drop a relevant marketing poster into
// otherwise-text-heavy Attend pages (wallet, payouts, promotion, etc.) so
// the section visually reinforces what each screen is for.
//
// The natural aspect of the source ads is 16:9; the card preserves that
// and uses Next.js Image's sizes hint so the optimizer picks the right
// variant for the layout slot.
import Image from 'next/image'

export function BrandAd({
  src,
  alt,
  caption,
  side = 'right',
}: {
  /** Path under /public e.g. "/attend/ads/ad-25.png" */
  src: string
  /** Required for accessibility — describe what the ad communicates. */
  alt: string
  /** Optional one-line caption rendered under the image. */
  caption?: string
  /** Visual hint for sizes — adjusts the responsive sizes attribute. */
  side?: 'right' | 'wide'
}) {
  const sizes =
    side === 'wide'
      ? '(min-width: 1024px) 800px, 100vw'
      : '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'
  return (
    <figure className="overflow-hidden rounded-xl border border-[#2a2135] bg-[#0E1E3A] transition hover:border-[#E8C456]">
      <Image
        src={src}
        alt={alt}
        width={1280}
        height={720}
        sizes={sizes}
        className="h-auto w-full"
      />
      {caption && (
        <figcaption className="border-t border-[#2a2135] px-4 py-3 text-xs text-[#9e8a55]">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
