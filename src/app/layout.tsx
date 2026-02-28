import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HYVE — Encrypted Messaging',
  description:
    'HYVE uses five breakthrough cryptographic protocols to make your messages mathematically impossible to intercept — even by us.',
  keywords: ['encrypted messaging', 'privacy', 'end-to-end encryption', 'HYVE', 'secure communication'],
  openGraph: {
    title: 'HYVE — Encrypted Messaging',
    description: 'Privacy isn\'t a feature. It\'s the architecture.',
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
