// /messenger — the dedicated Hyve Messenger product page.
//
// Was the homepage at / for the entire pre-2026-04 lifetime of the site.
// Moved here as part of the multi-app hub restructure: / is now the
// umbrella showcase for the whole Hyve ecosystem (Spy, Messenger, Sleuth,
// Residential, Sentinel + external sites Hyvealpha, Hyvecares).
//
// The component tree is unchanged — same hero, founders deal, tech section,
// pricing, etc. Only the route moved. Anything that linked to / for
// Messenger now links to /messenger. The new homepage at / has its own
// content geared at app discovery, not a single product.

import BetaBanner from '@/components/BetaBanner'
import Nav from '@/components/Nav'
import HeroSection from '@/components/HeroSection'
import FoundersDeal from '@/components/FoundersDeal'
import TechSection from '@/components/TechSection'
import LocationSection from '@/components/LocationSection'
import PricingSection from '@/components/PricingSection'
import DownloadSection from '@/components/DownloadSection'
import DisclaimerSection from '@/components/DisclaimerSection'
import ReportForm from '@/components/ReportForm'
import Footer from '@/components/Footer'

export const metadata = {
  title: 'Hyve Messenger — End-to-end encrypted, location-aware messaging',
  description:
    'A privacy-first messenger with location-aware features, founders pricing, and a no-tracking ethos. Beta on iOS + Android.',
}

export default function MessengerPage() {
  return (
    <>
      <BetaBanner />
      <Nav />
      <main>
        <HeroSection />
        <FoundersDeal />
        <TechSection />
        <LocationSection />
        <PricingSection />
        <DownloadSection />
        <DisclaimerSection />
        <ReportForm />
      </main>
      <Footer />
    </>
  )
}
