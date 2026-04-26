import type { Metadata } from 'next'
import './globals.css'

// Root metadata reflects the new umbrella positioning — / is the hub for
// every Hyve app + site, not a single product. Per-route pages override
// title/description (see /messenger/page.tsx, /spy/page.tsx).
export const metadata: Metadata = {
  title: 'HYVE — One ecosystem, every app',
  description:
    'Hyve Spy · Hyve Messenger · Hyve Sleuth · Hyve Residential · Hyve Sentinel · Hyve Alpha · Hyve Cares. The whole Hyve ecosystem.',
  keywords: ['HYVE', 'Hyve Spy', 'Hyve Messenger', 'Hyve Alpha', 'privacy', 'OSINT', 'public safety'],
  icons: {
    icon: '/hyve-logo/hyve-messenger-emblem.png',
    apple: '/hyve-logo/hyve-messenger-emblem.png',
  },
  openGraph: {
    title: 'HYVE — One ecosystem, every app',
    description: 'Privacy-first apps for messaging, public-safety intel, OSINT, real-estate distress, and security audits.',
    siteName: 'HYVE',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen bg-black text-white antialiased">{children}</body>
    </html>
  )
}
