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
}

export default config
