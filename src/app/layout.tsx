import type { Metadata } from 'next'
import './globals.css'
import LanguagePicker from '@/components/LanguagePicker'

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
          Translation infrastructure: a tiny gold-globe icon top-right
          (LanguagePicker) drives Google's Website Translator script
          underneath. The official widget mounts into #google_translate_element
          but we keep that hidden — it exists only to let the script
          monkey-patch the page's text when the user picks a language.
          Translation is triggered by setting the `googtrans` cookie and
          reloading; the script reads that on next mount and translates.
        */}
        <LanguagePicker />
        <div id="google_translate_element" style={{ display: 'none' }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              function googleTranslateElementInit() {
                new google.translate.TranslateElement({
                  pageLanguage: 'en',
                  includedLanguages: 'es,fr,de,it,pt,zh-CN,ja,ko,ar,ru,hi',
                  autoDisplay: false,
                }, 'google_translate_element');
              }
            `,
          }}
        />
        <script src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit" async />
        {/* Hide every visible artefact of the default Google widget so only
            our custom LanguagePicker chrome shows. */}
        <style dangerouslySetInnerHTML={{
          __html: `
            .skiptranslate.goog-te-banner-frame { display: none !important; }
            .goog-te-balloon-frame { display: none !important; }
            #google_translate_element { display: none !important; }
            body { top: 0 !important; }
            .goog-tooltip, .goog-tooltip:hover { display: none !important; }
            .goog-text-highlight { background: none !important; box-shadow: none !important; }
            font[style*="background-color"] { background: none !important; }
          `,
        }} />
      </body>
    </html>
  )
}
