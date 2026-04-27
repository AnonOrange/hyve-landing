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
      <body className="min-h-screen bg-black text-white antialiased">
        {children}
        {/*
          Google Website Translator widget. Free, no API key, no quota.
          Renders an inline language picker into #google_translate_element
          (positioned top-right via CSS) that translates every visible string
          on the page, including content inside the spy-app WebView (which
          inherits this same layout). Mobile users get translation for free.

          12 languages enabled below — enough to cover the major audiences
          without overwhelming the dropdown. Users can request more by
          contacting support; adding to includedLanguages is one line.
        */}
        <div
          id="google_translate_element"
          style={{
            position: 'fixed',
            top: 'env(safe-area-inset-top, 0)',
            right: 12,
            zIndex: 9999,
            background: 'rgba(8,7,10,0.85)',
            backdropFilter: 'blur(8px)',
            padding: '4px 6px',
            borderRadius: 6,
            border: '1px solid #2a2135',
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              function googleTranslateElementInit() {
                new google.translate.TranslateElement({
                  pageLanguage: 'en',
                  includedLanguages: 'en,es,fr,de,it,pt,zh-CN,ja,ko,ar,ru,hi',
                  layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
                  autoDisplay: false,
                }, 'google_translate_element');
              }
            `,
          }}
        />
        <script src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit" async />
        {/* Hide the Google-default top banner that pushes content down on
            translated pages — we only want the inline picker we placed above. */}
        <style dangerouslySetInnerHTML={{
          __html: `
            .skiptranslate.goog-te-banner-frame { display: none !important; }
            body { top: 0 !important; }
            .goog-tooltip, .goog-tooltip:hover { display: none !important; }
            .goog-text-highlight { background: none !important; box-shadow: none !important; }
          `,
        }} />
      </body>
    </html>
  )
}
