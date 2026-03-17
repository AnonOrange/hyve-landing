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

export default function HomePage() {
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
