import { Suspense } from 'react'
import WelcomeContent from './WelcomeContent'

export const metadata = {
  title: 'Welcome to Hyve Spy',
}

export default function SpyWelcomePage() {
  return (
    <main className="min-h-screen bg-[#020D14] text-white antialiased">
      <Suspense fallback={null}>
        <WelcomeContent />
      </Suspense>
    </main>
  )
}
