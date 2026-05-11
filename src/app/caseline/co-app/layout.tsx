// CaseLine Co-App nested layout. Drops the marketing-site chrome (header,
// language picker, tracker), wires the PWA manifest, and registers the
// service worker so the app is installable + offline-capable.

import type { Metadata, Viewport } from 'next'
import RegisterSW from './RegisterSW'

export const metadata: Metadata = {
  title: 'CaseLine Co-App',
  description: "The pocket companion for Hyve CaseLine — voice notes, CaSeY, synced files, live courtroom recording.",
  manifest: '/caseline-co-app/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/caseline-co-app/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/caseline-co-app/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: { url: '/caseline-co-app/icon-180.png', sizes: '180x180' },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CaseLine',
  },
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#00B4D8',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function CoAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RegisterSW />
      {children}
    </>
  )
}
