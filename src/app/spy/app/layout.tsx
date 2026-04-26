import type { Metadata, Viewport } from 'next';
import './spy-app.css';
import SpyBottomNav from './SpyBottomNav';

export const metadata: Metadata = {
  title: 'Hyve Spy — Live Scanner Map',
  description: 'Real-time public-safety scanner intelligence — works in any browser.',
  manifest: '/spy/app/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Hyve Spy',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    apple: '/spy-logo/hyve-spy-logo.png',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'Hyve Spy',
  },
};

export const viewport: Viewport = {
  themeColor: '#020D14',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function SpyAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#020D14] text-[#E2E8F0]">
      {/* PWA + iOS standalone hints (some are duplicated by Next metadata for safety) */}
      <link rel="manifest" href="/spy/app/manifest.json" />
      <link rel="apple-touch-icon" href="/spy-logo/hyve-spy-logo.png" />
      {children}
      <SpyBottomNav />
      <script
        dangerouslySetInnerHTML={{
          __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', function () { navigator.serviceWorker.register('/spy/app/sw.js').catch(function(){}); }); }`,
        }}
      />
    </div>
  );
}
