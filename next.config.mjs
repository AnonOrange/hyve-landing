/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  allowedDevOrigins: ['127.0.0.1'],

  // Force the tester APK to download with the correct MIME + filename
  async headers() {
    // Baseline security headers applied to every response. The CSP is
    // intentionally lenient because the marketing site embeds AdSense +
    // Google Translate + Stripe checkout redirects + Firebase auth — all
    // third-party scripts/iframes. We tighten via specific opt-ins below.
    const baselineSecurity = [
      // Clickjacking defense — frame-ancestors in CSP is the modern
      // version, plus the legacy X-Frame-Options header for older clients
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      // MIME sniffing — never let the browser second-guess Content-Type
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      // Strict referrer — leaks license keys etc. otherwise
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      // Limit risky browser features that we never use
      {
        key: 'Permissions-Policy',
        value: [
          'accelerometer=()',
          'autoplay=()',
          'camera=(self)',          // Co-App needs camera permission in the future
          'cross-origin-isolated=()',
          'display-capture=()',
          'fullscreen=(self)',
          'geolocation=()',
          'gyroscope=()',
          'magnetometer=()',
          'microphone=(self)',      // Co-App voice notes + live recordings
          'midi=()',
          'payment=(self)',         // Stripe Checkout
          'picture-in-picture=()',
          'sync-xhr=()',
          'usb=()',
        ].join(', '),
      },
      // HSTS — production already over HTTPS via Vercel + custom domain.
      // 2-year max-age + preload-eligible.
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      // Content Security Policy. NOTE: 'unsafe-inline' for script is
      // needed for Next.js's inline hydration script + the inline tracker
      // in layout.tsx; we accept this trade-off because every page is
      // server-rendered and we don't accept user-controlled HTML output.
      // 'unsafe-eval' is used by some libraries (e.g. older Firebase
      // bundles, AdSense). When we drop those we can tighten further.
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://www.googletagservices.com https://translate.google.com https://translate.googleapis.com https://*.gstatic.com https://js.stripe.com https://m.stripe.network",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://translate.googleapis.com https://www.gstatic.com",
          "font-src 'self' data: https://fonts.gstatic.com",
          "img-src 'self' data: blob: https:",
          "media-src 'self' blob: https:",
          "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://googleads.g.doubleclick.net https://*.googlesyndication.com https://translate.googleapis.com https://melvis-preview.vercel.app",
          "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://firebasestorage.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://*.gstatic.com https://api.stripe.com https://m.stripe.network https://r.stripe.com https://api.resend.com https://translate.googleapis.com https://*.supabase.co https://stream.mux.com wss://*.firebaseio.com wss://*.supabase.co https://pagead2.googlesyndication.com",
          "worker-src 'self' blob:",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self' https://checkout.stripe.com",
          "frame-ancestors 'self'",
          "upgrade-insecure-requests",
        ].join('; '),
      },
    ]

    return [
      // Global baseline — applied to everything except the assets that
      // Vercel/Next.js already short-circuits (_next/static, _next/image)
      { source: '/((?!_next/static|_next/image|favicon).*)', headers: baselineSecurity },

      // Force the tester APK to download with the correct MIME + filename
      {
        source: '/spy/downloads/:apk*.apk',
        headers: [
          { key: 'Content-Type', value: 'application/vnd.android.package-archive' },
          { key: 'Content-Disposition', value: 'attachment; filename="hyve-spy-tester.apk"' },
          { key: 'X-Robots-Tag', value: 'noindex' },
        ],
      },
    ]
  },

  async rewrites() {
    return [
      {
        source: '/RealityShield',
        destination: 'https://hyvetrus.vercel.app/RealityShield',
      },
      {
        source: '/RealityShield/:path*',
        destination: 'https://hyvetrus.vercel.app/RealityShield/:path*',
      },
      // hyveattend.com masking lives in src/middleware.ts now — the
      // regex-host rewrite that was here didn't fire reliably at Vercel's
      // edge.
    ]
  },
}

export default config
