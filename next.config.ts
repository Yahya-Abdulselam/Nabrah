import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PWA Configuration
  experimental: {
    // Optimize package imports for smaller bundle
    optimizePackageImports: ['framer-motion', 'lucide-react'],
  },

  // Turbopack configuration (Next.js 16 default)
  turbopack: {},

  // Headers for PWA
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
