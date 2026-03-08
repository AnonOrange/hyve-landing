/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Allow 127.0.0.1 in dev so preview tools can load /_next/* chunks
  allowedDevOrigins: ['127.0.0.1'],
}

export default config
