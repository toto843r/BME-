/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // The existing lightweight SW is registered ONLY in production by PwaBits.tsx.
  // Revalidate worker updates on every deployment; never pin stale worker code.
  async headers() {
    return [{
      source: '/sw.js',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
    }];
  },
};
