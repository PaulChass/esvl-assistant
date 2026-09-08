/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This is an unofficial, non-commercial demo. Keep it out of search indexes so it is
  // never mistaken for an official FFBB / ESVL source.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ]
  },
}

export default nextConfig
