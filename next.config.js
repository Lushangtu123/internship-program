/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.example.com',
      },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  async headers() {
    return [
      {
        source: '/uploads/hls/:path*.m3u8',
        headers: [
          { key: 'Content-Type', value: 'application/vnd.apple.mpegurl' },
          { key: 'Cache-Control', value: 'public, max-age=60' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/uploads/hls/:path*.ts',
        headers: [
          { key: 'Content-Type', value: 'video/mp2t' },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ];
  },
}

module.exports = nextConfig
