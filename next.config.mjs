/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  allowedDevOrigins: ['127.0.0.1'],

  // Force the tester APK to download with the correct MIME + filename
  async headers() {
    return [
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
    ]
  },
}

export default config
