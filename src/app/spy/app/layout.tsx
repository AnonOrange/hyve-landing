import type { Metadata, Viewport } from 'next';
import './spy-app.css';
import SpyBottomNav from './SpyBottomNav';
import AdSlot from '@/components/AdSlot';

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
  // Near-black warm tone matching the new gold-on-black brand (hyvealpha.com style)
  themeColor: '#08070a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || ''

export default function SpyAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#08070a] text-[#ede8d8]">
      {/* PWA + iOS standalone hints (some are duplicated by Next metadata for safety) */}
      <link rel="manifest" href="/spy/app/manifest.json" />
      <link rel="apple-touch-icon" href="/spy-logo/hyve-spy-logo.png" />
      {/*
        AdSense script — loads once globally on /spy/app/* when the operator
        has configured NEXT_PUBLIC_ADSENSE_CLIENT. Loading it for everyone
        (not just free users) is correct: <AdSlot /> components decide
        per-render whether to push an ad, and not loading the script at all
        means free users would see empty <ins> tags. Crossorigin=anonymous
        avoids credential leaks since AdSense responses don't need cookies.
      */}
      {ADSENSE_CLIENT && (
        // eslint-disable-next-line @next/next/no-sync-scripts
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
        />
      )}
      {children}
      {/*
        Free-tier banner ad — fixed above the bottom nav. AdSlot renders
        nothing for paying users (tier !== 'free' check inside the component),
        so this line is invisible chrome for Basic/Pro/comp tiers. The
        AdSlot also self-suppresses if the AdSense client/slot env vars
        aren't configured yet, so this is a no-op until you wire AdSense.
      */}
      <div className="fixed inset-x-0 bottom-[88px] z-[2900] mx-auto max-w-3xl px-2">
        <AdSlot format="auto" hideLabel className="bg-[#08070a]/95 backdrop-blur" />
      </div>
      <SpyBottomNav />
      <script
        dangerouslySetInnerHTML={{
          __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', function () { navigator.serviceWorker.register('/spy/app/sw.js').catch(function(){}); }); }`,
        }}
      />
    </div>
  );
}
