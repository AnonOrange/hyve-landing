import BetaBanner from '@/components/BetaBanner'
import Nav from '@/components/Nav'
import HeroSection from '@/components/HeroSection'
import TechSection from '@/components/TechSection'
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
        <TechSection />
        <DownloadSection />
        <DisclaimerSection />
        <ReportForm />
      </main>
      <Footer />
    </>
  )
}
